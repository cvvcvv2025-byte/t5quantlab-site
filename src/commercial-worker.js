import core from "./gated-worker.js";

const PASS_PRODUCT_CODE = "code_workshop_single";
const PASS_NAME = "T5 Builder Pass · 30天";
const PASS_ANALYZE_CREDITS = 3;
const PASS_MODIFY_CREDITS = 2;
const PASS_EXPIRES_DAYS = 30;
const DEFAULT_USD_PRICE_MINOR = 1490;
const TERMS_VERSION = "refund-v1-2026-09-28";

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix = "EV") {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}-${Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

function parseCookies(request) {
  const out = {};
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function accessTokenFromRequest(request) {
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const cookies = parseCookies(request);
  return (bearer || request.headers.get("X-Builder-Access-Token") || cookies.t5_builder_access || "").trim();
}

async function auditIpHash(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const salt = String(env.AUDIT_HASH_SALT || "t5-audit-v1");
  return sha256Hex(`${salt}:${ip}`);
}

async function ensureCommercialDb(env) {
  if (!env.BUILDER_DB) return;
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS order_terms (
      order_id TEXT PRIMARY KEY,
      terms_version TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      accepted_ip_hash TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS entitlement_adjustments (
      grant_id TEXT PRIMARY KEY,
      adjustment_code TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS service_events (
      event_id TEXT PRIMARY KEY,
      order_id TEXT,
      grant_id TEXT,
      project_id TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      filename TEXT,
      source_sha256 TEXT,
      source_size INTEGER,
      ip_hash TEXT,
      user_agent TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      http_status INTEGER,
      error_code TEXT
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_service_events_order ON service_events(order_id)`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_service_events_project ON service_events(project_id)`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS payment_disputes (
      dispute_id TEXT PRIMARY KEY,
      order_id TEXT,
      provider_trade_id TEXT,
      status TEXT NOT NULL,
      reason TEXT,
      life_cycle_stage TEXT,
      outcome_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_payment_disputes_order ON payment_disputes(order_id)`)
  ]);
}

function passPriceUsdMinor(env) {
  const raw = env.T5_BUILDER_PASS_PRICE_USD_MINOR;
  if (raw == null || raw === "") return DEFAULT_USD_PRICE_MINOR;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_USD_PRICE_MINOR;
}

function coreEnv(env) {
  return {
    ...env,
    CODE_WORKSHOP_PRICE_USD_MINOR: String(passPriceUsdMinor(env)),
    CODE_WORKSHOP_PRICE_CNY_MINOR: ""
  };
}

function paypalConfigured(env) {
  return Boolean(
    String(env.PAYPAL_CLIENT_ID || "").trim()
    && String(env.PAYPAL_CLIENT_SECRET || "").trim()
    && String(env.PAYPAL_WEBHOOK_ID || "").trim()
  );
}

function handleCatalog(env) {
  return json({
    ok: true,
    terms_version: TERMS_VERSION,
    products: [{
      code: PASS_PRODUCT_CODE,
      name: PASS_NAME,
      analyze_credits: PASS_ANALYZE_CREDITS,
      modify_credits: PASS_MODIFY_CREDITS,
      expires_days: PASS_EXPIRES_DAYS,
      prices: { CNY: null, USD: passPriceUsdMinor(env) }
    }],
    providers: {
      alipay: { enabled: false, configured: false, adapter_ready: false, currency: "CNY" },
      wechat: { enabled: false, configured: false, adapter_ready: false, currency: "CNY" },
      paypal: {
        enabled: paypalConfigured(env),
        configured: paypalConfigured(env),
        adapter_ready: true,
        currency: "USD"
      }
    }
  });
}

async function grantContext(request, env) {
  const token = accessTokenFromRequest(request);
  if (!token || !env.BUILDER_DB) return null;
  const tokenHash = await sha256Hex(token);
  const grant = await env.BUILDER_DB.prepare(`SELECT grant_id, status, analyze_remaining, modify_remaining, expires_at
    FROM builder_access_grants WHERE token_hash = ?`).bind(tokenHash).first();
  if (!grant) return null;
  const order = await env.BUILDER_DB.prepare(`SELECT order_id, customer_email, payment_provider, provider_trade_id
    FROM orders WHERE grant_id = ? ORDER BY created_at DESC LIMIT 1`).bind(grant.grant_id).first();
  return { ...grant, order_id: order?.order_id || null, customer_email: order?.customer_email || null };
}

async function hasUsableAccess(request, env) {
  const grant = await grantContext(request, env);
  if (!grant || grant.status !== "active") return false;
  if (grant.expires_at && Date.parse(grant.expires_at) <= Date.now()) return false;
  return Number(grant.analyze_remaining || 0) > 0 || Number(grant.modify_remaining || 0) > 0;
}

async function handleCreateOrder(request, env, ctx) {
  await ensureCommercialDb(env);
  let body;
  try { body = await request.clone().json(); } catch { return json({ ok: false, error: "订单参数无效" }, 400); }

  if (body?.terms_accepted !== true || String(body?.terms_version || "") !== TERMS_VERSION) {
    return json({
      ok: false,
      error: "请先阅读并确认数字服务退款与交付条款。",
      code: "TERMS_ACCEPTANCE_REQUIRED",
      terms_version: TERMS_VERSION
    }, 400);
  }
  if (String(body?.currency || "USD").toUpperCase() !== "USD") {
    return json({ ok: false, error: "当前首发阶段仅开放 PayPal / USD。", code: "PAYPAL_ONLY_LAUNCH" }, 400);
  }
  if (await hasUsableAccess(request, env)) {
    return json({ ok: false, error: "当前账户仍有可用 AI 次数，无需重复购买。", code: "ACTIVE_ACCESS_REMAINS" }, 409);
  }

  const response = await core.fetch(request, coreEnv(env), ctx);
  if (!response.ok) return response;

  let data;
  try { data = await response.clone().json(); } catch { return response; }
  const orderId = data?.order?.order_id;
  if (!orderId) return response;

  const acceptedAt = nowIso();
  const ipHash = await auditIpHash(request, env);
  const ua = String(request.headers.get("User-Agent") || "").slice(0, 500);
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`INSERT INTO order_terms
      (order_id, terms_version, accepted_at, accepted_ip_hash, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(order_id) DO NOTHING`)
      .bind(orderId, TERMS_VERSION, acceptedAt, ipHash, ua, acceptedAt),
    env.BUILDER_DB.prepare(`UPDATE orders SET product_name = ?, updated_at = ? WHERE order_id = ?`)
      .bind(PASS_NAME, acceptedAt, orderId)
  ]);
  return response;
}

async function applyPassEntitlement(env, orderId) {
  if (!orderId || !env.BUILDER_DB) return;
  await ensureCommercialDb(env);
  const order = await env.BUILDER_DB.prepare(`SELECT grant_id FROM orders WHERE order_id = ?`).bind(orderId).first();
  if (!order?.grant_id) return;
  const now = nowIso();

  // D1 batch() is transactional. The marker and 3+2 normalization therefore either
  // commit together or roll back together. The plan predicate also makes webhook/
  // capture retries idempotent and repairs a legacy partial state where the marker
  // exists but the old 1+1 seed grant was never normalized.
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`INSERT INTO entitlement_adjustments (grant_id, adjustment_code, created_at)
      VALUES (?, 'builder-pass-3a-2m-v1', ?) ON CONFLICT(grant_id) DO NOTHING`)
      .bind(order.grant_id, now),
    env.BUILDER_DB.prepare(`UPDATE builder_access_grants
      SET plan = 't5_builder_pass_30d',
          analyze_remaining = analyze_remaining + ?,
          modify_remaining = modify_remaining + ?,
          updated_at = ?
      WHERE grant_id = ? AND plan <> 't5_builder_pass_30d'`)
      .bind(PASS_ANALYZE_CREDITS - 1, PASS_MODIFY_CREDITS - 1, now, order.grant_id)
  ]);
}

async function orderFromPayPalCapture(env, captureId) {
  if (!captureId) return null;
  return env.BUILDER_DB.prepare(`SELECT order_id, grant_id FROM orders
    WHERE payment_provider = 'paypal' AND provider_trade_id = ? LIMIT 1`).bind(captureId).first();
}

async function orderFromPayPalIntent(env, paypalOrderId) {
  if (!paypalOrderId) return null;
  return env.BUILDER_DB.prepare(`SELECT o.order_id, o.grant_id FROM payment_intents p
    JOIN orders o ON o.order_id = p.order_id
    WHERE p.provider = 'paypal' AND p.provider_order_id = ? LIMIT 1`).bind(paypalOrderId).first();
}

async function paypalAccessToken(env) {
  const base = String(env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  const d = await r.json();
  if (!r.ok || !d.access_token) throw new Error("PAYPAL_OAUTH_FAILED");
  return { token: d.access_token, base };
}

async function paypalDisputeDetails(env, disputeId) {
  if (!paypalConfigured(env) || !disputeId) return null;
  const { token, base } = await paypalAccessToken(env);
  const r = await fetch(`${base}/v1/customer/disputes/${encodeURIComponent(disputeId)}`, {
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
  });
  if (!r.ok) return null;
  return r.json();
}

function sellerTransactionId(dispute) {
  for (const t of dispute?.disputed_transactions || []) {
    if (t?.seller_transaction_id) return String(t.seller_transaction_id);
  }
  return "";
}

async function resolveDisputeOrder(env, resource) {
  let captureId = sellerTransactionId(resource);
  if (!captureId && resource?.dispute_id) {
    const details = await paypalDisputeDetails(env, String(resource.dispute_id));
    captureId = sellerTransactionId(details);
    if (captureId) return { order: await orderFromPayPalCapture(env, captureId), details, captureId };
  }
  if (captureId) return { order: await orderFromPayPalCapture(env, captureId), details: resource, captureId };
  return { order: null, details: resource, captureId: "" };
}

async function setGrantStatus(env, orderId, status) {
  const order = await env.BUILDER_DB.prepare(`SELECT grant_id FROM orders WHERE order_id = ?`).bind(orderId).first();
  if (!order?.grant_id) return;
  await env.BUILDER_DB.prepare(`UPDATE builder_access_grants SET status = ?, updated_at = ? WHERE grant_id = ?`)
    .bind(status, nowIso(), order.grant_id).run();
}

function outcomeCode(dispute) {
  return String(dispute?.dispute_outcome?.outcome_code || dispute?.outcome_code || "").toUpperCase();
}

async function processVerifiedDisputeEvent(event, env) {
  const type = String(event?.event_type || "");
  if (!["CUSTOMER.DISPUTE.CREATED", "CUSTOMER.DISPUTE.UPDATED", "CUSTOMER.DISPUTE.RESOLVED"].includes(type)) return;

  await ensureCommercialDb(env);
  const resource = event?.resource || {};
  const disputeId = String(resource.dispute_id || resource.id || "");
  if (!disputeId) return;
  const resolved = await resolveDisputeOrder(env, resource);
  const details = resolved.details || resource;
  const orderId = resolved.order?.order_id || null;
  const out = outcomeCode(details);
  const reason = String(details?.reason || resource?.reason || "").slice(0, 200);
  const stage = String(details?.dispute_life_cycle_stage || resource?.dispute_life_cycle_stage || "").slice(0, 120);
  const status = String(details?.status || resource?.status || type.replace("CUSTOMER.DISPUTE.", "")).slice(0, 120);
  const now = nowIso();

  await env.BUILDER_DB.prepare(`INSERT INTO payment_disputes
    (dispute_id, order_id, provider_trade_id, status, reason, life_cycle_stage, outcome_code, created_at, updated_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dispute_id) DO UPDATE SET
      order_id = COALESCE(excluded.order_id, payment_disputes.order_id),
      provider_trade_id = COALESCE(excluded.provider_trade_id, payment_disputes.provider_trade_id),
      status = excluded.status,
      reason = excluded.reason,
      life_cycle_stage = excluded.life_cycle_stage,
      outcome_code = excluded.outcome_code,
      updated_at = excluded.updated_at,
      resolved_at = COALESCE(excluded.resolved_at, payment_disputes.resolved_at)`)
    .bind(disputeId, orderId, resolved.captureId || null, status, reason, stage, out, now, now,
      type === "CUSTOMER.DISPUTE.RESOLVED" ? now : null).run();

  if (!orderId) return;
  if (type === "CUSTOMER.DISPUTE.CREATED" || type === "CUSTOMER.DISPUTE.UPDATED") {
    await setGrantStatus(env, orderId, "suspended");
    return;
  }

  if (["RESOLVED_SELLER_FAVOUR", "CANCELED_BY_BUYER", "DENIED"].includes(out)) {
    await setGrantStatus(env, orderId, "active");
  } else if (["RESOLVED_BUYER_FAVOUR", "ACCEPTED"].includes(out)) {
    await setGrantStatus(env, orderId, "revoked");
  } else {
    await setGrantStatus(env, orderId, "suspended");
  }
}

async function recordServiceStart(request, env, action, projectId = null, extra = {}) {
  await ensureCommercialDb(env);
  const grant = await grantContext(request, env);
  const eventId = randomId("SVC");
  const started = nowIso();
  const ipHash = await auditIpHash(request, env);
  const ua = String(request.headers.get("User-Agent") || "").slice(0, 500);
  await env.BUILDER_DB.prepare(`INSERT INTO service_events
    (event_id, order_id, grant_id, project_id, action, status, filename, source_sha256, source_size,
     ip_hash, user_agent, started_at)
    VALUES (?, ?, ?, ?, ?, 'started', ?, ?, ?, ?, ?, ?)`)
    .bind(eventId, grant?.order_id || null, grant?.grant_id || null, projectId, action,
      extra.filename || null, extra.source_sha256 || null, extra.source_size ?? null,
      ipHash, ua, started).run();
  return eventId;
}

async function finishServiceEvent(env, eventId, response, errorCode = null) {
  if (!eventId || !env.BUILDER_DB) return;
  await env.BUILDER_DB.prepare(`UPDATE service_events
    SET status = ?, completed_at = ?, http_status = ?, error_code = ? WHERE event_id = ?`)
    .bind(response.ok ? "success" : "failed", nowIso(), response.status, errorCode, eventId).run();
}

async function auditPaidRoute(request, env, ctx, action) {
  let projectId = null;
  try { projectId = String((await request.clone().json())?.projectId || "") || null; } catch {}
  const eventId = await recordServiceStart(request, env, action, projectId);
  const response = await core.fetch(request, coreEnv(env), ctx);
  let errorCode = null;
  if (!response.ok) {
    try { errorCode = String((await response.clone().json())?.code || "") || null; } catch {}
  }
  await finishServiceEvent(env, eventId, response, errorCode);
  return response;
}

async function auditUpload(request, env, ctx) {
  let extra = {};
  try {
    const form = await request.clone().formData();
    const file = form.get("source");
    if (file instanceof File) {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      extra = {
        filename: String(file.name || "").slice(0, 200),
        source_size: file.size,
        source_sha256: Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("")
      };
    }
  } catch {}
  const response = await core.fetch(request, coreEnv(env), ctx);
  if (!response.ok) return response;
  let projectId = null;
  try { projectId = String((await response.clone().json())?.projectId || "") || null; } catch {}
  const eventId = await recordServiceStart(request, env, "upload", projectId, extra);
  await finishServiceEvent(env, eventId, response);
  return response;
}

async function auditDownload(request, env, ctx) {
  const response = await core.fetch(request, coreEnv(env), ctx);
  if (!response.ok) return response;
  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id") || null;
  const type = url.searchParams.get("type") || "source";
  await ensureCommercialDb(env);
  const previous = projectId ? await env.BUILDER_DB.prepare(`SELECT order_id, grant_id FROM service_events
    WHERE project_id = ? AND order_id IS NOT NULL ORDER BY started_at DESC LIMIT 1`).bind(projectId).first() : null;
  const eventId = randomId("SVC");
  await env.BUILDER_DB.prepare(`INSERT INTO service_events
    (event_id, order_id, grant_id, project_id, action, status, ip_hash, user_agent, started_at, completed_at, http_status)
    VALUES (?, ?, ?, ?, ?, 'success', ?, ?, ?, ?, ?)`)
    .bind(eventId, previous?.order_id || null, previous?.grant_id || null, projectId,
      type === "changelog" ? "download_changelog" : "download_source",
      await auditIpHash(request, env), String(request.headers.get("User-Agent") || "").slice(0, 500),
      nowIso(), nowIso(), response.status).run();
  return response;
}

async function handlePayPalCapture(request, env, ctx) {
  let body = {};
  try { body = await request.clone().json(); } catch {}
  const response = await core.fetch(request, coreEnv(env), ctx);
  if (response.ok) await applyPassEntitlement(env, String(body.order_id || ""));
  return response;
}

async function handlePayPalWebhook(request, env, ctx) {
  let event = null;
  try { event = await request.clone().json(); } catch {}
  const response = await core.fetch(request, coreEnv(env), ctx);
  if (!response.ok || !event) return response;

  const type = String(event.event_type || "");
  const resource = event.resource || {};
  if (type === "PAYMENT.CAPTURE.COMPLETED") {
    const captureId = String(resource.id || "");
    let order = await orderFromPayPalCapture(env, captureId);
    if (!order) {
      const paypalOrderId = String(resource?.supplementary_data?.related_ids?.order_id || "");
      order = await orderFromPayPalIntent(env, paypalOrderId);
    }
    if (order?.order_id) await applyPassEntitlement(env, order.order_id);
  }
  if (type.startsWith("CUSTOMER.DISPUTE.")) {
    await processVerifiedDisputeEvent(event, env);
  }
  return response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    await ensureCommercialDb(env);

    if (url.pathname === "/api/payments/catalog" && request.method === "GET") {
      return handleCatalog(env);
    }
    if (url.pathname === "/api/orders/create" && request.method === "POST") {
      return handleCreateOrder(request, env, ctx);
    }
    if (url.pathname === "/api/payment/paypal/capture" && request.method === "POST") {
      return handlePayPalCapture(request, env, ctx);
    }
    if (url.pathname === "/api/admin/paypal-sandbox/capture" && request.method === "POST") {
      return handlePayPalCapture(request, env, ctx);
    }
    if (url.pathname === "/api/payment/paypal/webhook" && request.method === "POST") {
      return handlePayPalWebhook(request, env, ctx);
    }
    if (url.pathname === "/api/payment/paypal-sandbox/webhook" && request.method === "POST") {
      return handlePayPalWebhook(request, env, ctx);
    }
    if (url.pathname === "/api/builder/upload" && request.method === "POST") {
      return auditUpload(request, env, ctx);
    }
    if (url.pathname === "/api/builder/analyze" && request.method === "POST") {
      return auditPaidRoute(request, env, ctx, "analyze");
    }
    if (url.pathname === "/api/builder/modify" && request.method === "POST") {
      return auditPaidRoute(request, env, ctx, "modify");
    }
    if (url.pathname === "/api/builder/download" && request.method === "GET") {
      return auditDownload(request, env, ctx);
    }

    return core.fetch(request, coreEnv(env), ctx);
  }
};
