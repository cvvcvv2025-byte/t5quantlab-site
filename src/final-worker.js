import app from "./commercial-worker.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  });
}

function nowIso() { return new Date().toISOString(); }

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

async function authorizedOrder(request, env, orderId) {
  const token = request.headers.get("X-Order-Token") || "";
  if (!token || !orderId || !env.BUILDER_DB) return null;
  const hash = await sha256Hex(token);
  return env.BUILDER_DB.prepare(`SELECT order_id, status, grant_id, payment_provider, provider_trade_id
    FROM orders WHERE order_id = ? AND order_token_hash = ?`).bind(orderId, hash).first();
}

async function refundEligibility(request, env) {
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id") || "";
  const order = await authorizedOrder(request, env, orderId);
  if (!order) return json({ ok: false, error: "订单不存在或订单令牌无效" }, 403);
  const row = await env.BUILDER_DB.prepare(`SELECT COUNT(*) AS n FROM service_events
    WHERE order_id = ? AND status = 'success' AND action IN ('analyze','modify')`).bind(orderId).first();
  const successfulPaidActions = Number(row?.n || 0);
  const eligible = successfulPaidActions === 0;
  return json({
    ok: true,
    order_id: orderId,
    refund_eligible_under_t5_policy: eligible,
    successful_paid_ai_actions: successfulPaidActions,
    reason: eligible
      ? "尚未发现成功执行的付费 AI 分析或修改，可按退款规则申请。"
      : "该订单已经成功执行过付费 AI 数字服务，不属于普通无理由退款范围。",
    payment_provider_rules_still_apply: true
  });
}

function paypalBase(env) {
  return String(env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function paypalAccessToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) return null;
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const r = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  const d = await r.json();
  return r.ok ? d.access_token || null : null;
}

async function getDispute(env, disputeId) {
  const token = await paypalAccessToken(env);
  if (!token || !disputeId) return null;
  const r = await fetch(`${paypalBase(env)}/v1/customer/disputes/${encodeURIComponent(disputeId)}`, {
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
  });
  if (!r.ok) return null;
  return r.json();
}

function sellerTransactionId(dispute) {
  for (const tx of dispute?.disputed_transactions || []) {
    if (tx?.seller_transaction_id) return String(tx.seller_transaction_id);
  }
  return "";
}

function outcomeCode(dispute) {
  return String(dispute?.dispute_outcome?.outcome_code || "").toUpperCase();
}

async function enforceDisputeState(event, env) {
  const type = String(event?.event_type || "");
  if (!["CUSTOMER.DISPUTE.CREATED", "CUSTOMER.DISPUTE.UPDATED", "CUSTOMER.DISPUTE.RESOLVED"].includes(type)) return;
  const resource = event?.resource || {};
  const disputeId = String(resource.dispute_id || resource.id || "");
  if (!disputeId || !env.BUILDER_DB) return;

  const details = await getDispute(env, disputeId) || resource;
  const captureId = sellerTransactionId(details) || sellerTransactionId(resource);
  if (!captureId) return;
  const order = await env.BUILDER_DB.prepare(`SELECT order_id, grant_id FROM orders
    WHERE payment_provider = 'paypal' AND provider_trade_id = ? LIMIT 1`).bind(captureId).first();
  if (!order?.order_id) return;

  const out = outcomeCode(details);
  const reason = String(details?.reason || resource?.reason || "").slice(0, 200);
  const stage = String(details?.dispute_life_cycle_stage || resource?.dispute_life_cycle_stage || "").slice(0, 120);
  const disputeStatus = String(details?.status || resource?.status || "").slice(0, 120);
  const now = nowIso();
  await env.BUILDER_DB.prepare(`INSERT INTO payment_disputes
    (dispute_id, order_id, provider_trade_id, status, reason, life_cycle_stage, outcome_code, created_at, updated_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dispute_id) DO UPDATE SET
      order_id = excluded.order_id,
      provider_trade_id = excluded.provider_trade_id,
      status = excluded.status,
      reason = excluded.reason,
      life_cycle_stage = excluded.life_cycle_stage,
      outcome_code = excluded.outcome_code,
      updated_at = excluded.updated_at,
      resolved_at = COALESCE(excluded.resolved_at, payment_disputes.resolved_at)`)
    .bind(disputeId, order.order_id, captureId, disputeStatus || type, reason, stage, out, now, now,
      type === "CUSTOMER.DISPUTE.RESOLVED" ? now : null).run();

  if (!order.grant_id) return;
  let grantStatus = "suspended";
  if (type === "CUSTOMER.DISPUTE.RESOLVED") {
    if (["RESOLVED_SELLER_FAVOUR", "CANCELED_BY_BUYER", "DENIED"].includes(out)) grantStatus = "active";
    else if (["RESOLVED_BUYER_FAVOUR", "ACCEPTED"].includes(out)) grantStatus = "revoked";
  }
  await env.BUILDER_DB.prepare(`UPDATE builder_access_grants SET status = ?, updated_at = ? WHERE grant_id = ?`)
    .bind(grantStatus, now, order.grant_id).run();
}

async function paypalWebhook(request, env, ctx) {
  let event = null;
  try { event = await request.clone().json(); } catch {}
  const response = await app.fetch(request, env, ctx);
  // The inner PayPal adapter verifies the signature. Only enforce extra dispute state after it accepted the webhook.
  if (response.ok && event && String(event.event_type || "").startsWith("CUSTOMER.DISPUTE.")) {
    try { await enforceDisputeState(event, env); } catch (error) {
      console.error("T5 dispute safeguard failed", error);
    }
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/orders/refund-eligibility" && request.method === "GET") {
      return refundEligibility(request, env);
    }
    if (url.pathname === "/api/payment/paypal/webhook" && request.method === "POST") {
      return paypalWebhook(request, env, ctx);
    }
    return app.fetch(request, env, ctx);
  }
};
