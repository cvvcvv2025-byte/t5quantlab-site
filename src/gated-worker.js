import app from "./worker.js";

const PAID_BUILDER_ROUTES = new Set([
  "/api/builder/upload",
  "/api/builder/analyze",
  "/api/builder/modify"
]);

const BILLABLE_ACTION = new Map([
  ["/api/builder/analyze", "analyze"],
  ["/api/builder/modify", "modify"]
]);

const PRODUCT_CATALOG = {
  code_workshop_single: {
    name: "T5 Code Workshop · 单次完整处理",
    analyzeCredits: 1,
    modifyCredits: 1,
    expiresDays: 30
  }
};

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function nowIso() {
  return new Date().toISOString();
}

function randomHex(bytes = 24) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, b => b.toString(16).padStart(2, "0")).join("");
}

function randomId(prefix) {
  return `${prefix}-${randomHex(10)}`;
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(String(value || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

async function constantTimeSecretMatch(expected, supplied) {
  if (!expected || !supplied) return false;
  const [aHex, bHex] = await Promise.all([sha256Hex(expected), sha256Hex(supplied)]);
  let diff = 0;
  for (let i = 0; i < aHex.length; i += 1) diff |= aHex.charCodeAt(i) ^ bHex.charCodeAt(i);
  return diff === 0;
}

async function ensureAccessDb(env) {
  if (!env.BUILDER_DB) return;
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS builder_access_grants (
      grant_id TEXT PRIMARY KEY,
      token_hash TEXT UNIQUE NOT NULL,
      label TEXT,
      plan TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      analyze_remaining INTEGER NOT NULL DEFAULT 0,
      modify_remaining INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_builder_access_token_hash
      ON builder_access_grants(token_hash)`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS orders (
      order_id TEXT PRIMARY KEY,
      order_token_hash TEXT NOT NULL,
      builder_token_hash TEXT NOT NULL,
      customer_email TEXT,
      product_code TEXT NOT NULL,
      product_name TEXT NOT NULL,
      amount_minor INTEGER NOT NULL,
      currency TEXT NOT NULL,
      payment_provider TEXT,
      provider_trade_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      grant_id TEXT,
      created_at TEXT NOT NULL,
      paid_at TEXT,
      granted_at TEXT,
      updated_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`),
    env.BUILDER_DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_trade
      ON orders(payment_provider, provider_trade_id) WHERE provider_trade_id IS NOT NULL`)
  ]);
}

function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return (match?.[1] || request.headers.get("X-Builder-Access-Token") || "").trim();
}

async function isAdmin(request, env) {
  const supplied = request.headers.get("X-Builder-Access-Key") || "";
  return constantTimeSecretMatch(env.BUILDER_ACCESS_KEY || "", supplied);
}

async function resolveAccess(request, env) {
  if (await isAdmin(request, env)) {
    return {
      kind: "admin",
      grant_id: "admin",
      plan: "admin",
      analyze_remaining: null,
      modify_remaining: null,
      expires_at: null
    };
  }

  const token = bearerToken(request);
  if (!token || !env.BUILDER_DB) return null;

  await ensureAccessDb(env);
  const tokenHash = await sha256Hex(token);
  const grant = await env.BUILDER_DB.prepare(`SELECT grant_id, plan, status, analyze_remaining, modify_remaining, expires_at
    FROM builder_access_grants WHERE token_hash = ?`).bind(tokenHash).first();

  if (!grant || grant.status !== "active") return null;
  if (grant.expires_at && Date.parse(grant.expires_at) <= Date.now()) return null;
  return { kind: "grant", ...grant };
}

function paidRequired() {
  return json({
    ok: false,
    error: "AI 源码处理属于付费功能。当前订单尚未获得有效使用权限，因此不会调用 OpenAI API，也不会产生 Token 费用。",
    code: "PAID_ACCESS_REQUIRED"
  }, 402);
}

function quotaRequired(action) {
  const label = action === "modify" ? "AI修改" : "AI分析";
  return json({
    ok: false,
    error: `${label}额度已用完。系统已阻止本次请求，不会调用 OpenAI API，也不会产生新的 Token 费用。`,
    code: "PAID_QUOTA_EXHAUSTED",
    action
  }, 402);
}

async function reserveCredit(env, access, action) {
  if (access.kind === "admin") return true;
  const column = action === "modify" ? "modify_remaining" : "analyze_remaining";
  const now = nowIso();
  const result = await env.BUILDER_DB.prepare(`UPDATE builder_access_grants
    SET ${column} = ${column} - 1, updated_at = ?
    WHERE grant_id = ? AND status = 'active' AND ${column} > 0
      AND (expires_at IS NULL OR expires_at > ?)`)
    .bind(now, access.grant_id, now).run();
  return Number(result?.meta?.changes || 0) === 1;
}

async function restoreCredit(env, access, action) {
  if (access.kind === "admin") return;
  const column = action === "modify" ? "modify_remaining" : "analyze_remaining";
  await env.BUILDER_DB.prepare(`UPDATE builder_access_grants
    SET ${column} = ${column} + 1, updated_at = ? WHERE grant_id = ?`)
    .bind(nowIso(), access.grant_id).run();
}

async function rejectDuplicateBillableRequest(request, env, action) {
  if (!env.BUILDER_DB) return null;
  let body;
  try {
    body = await request.clone().json();
  } catch {
    return null;
  }
  const projectId = String(body?.projectId || "");
  if (!projectId) return null;

  const project = await env.BUILDER_DB.prepare("SELECT status FROM projects WHERE project_id = ?").bind(projectId).first();
  if (!project) return null;

  if (action === "analyze" && ["analyzed", "modified", "needs_clarification"].includes(project.status)) {
    return json({
      ok: false,
      error: "该项目已完成 AI 分析。为防止重复扣费，系统不会再次调用 OpenAI。",
      code: "DUPLICATE_ANALYSIS_BLOCKED"
    }, 409);
  }

  if (action === "modify" && project.status === "modified") {
    return json({
      ok: false,
      error: "该版本已经生成修改结果。为防止重复扣费，系统不会再次调用 OpenAI。",
      code: "DUPLICATE_MODIFICATION_BLOCKED"
    }, 409);
  }

  return null;
}

function accessStatus(access) {
  if (!access) return json({ ok: true, paid: false, plan: null, analyze_remaining: 0, modify_remaining: 0 });
  return json({
    ok: true,
    paid: true,
    plan: access.plan,
    analyze_remaining: access.analyze_remaining,
    modify_remaining: access.modify_remaining,
    expires_at: access.expires_at
  });
}

function priceFor(env, productCode, currency) {
  if (productCode !== "code_workshop_single") return null;
  const c = String(currency || "").toUpperCase();
  const raw = c === "CNY" ? env.CODE_WORKSHOP_PRICE_CNY_MINOR : c === "USD" ? env.CODE_WORKSHOP_PRICE_USD_MINOR : null;
  if (raw == null || raw === "") return null;
  const amount = Number(raw);
  if (!Number.isInteger(amount) || amount <= 0) return null;
  return amount;
}

async function handleCreateOrder(request, env) {
  await ensureAccessDb(env);
  const body = await request.json();
  const productCode = String(body.product_code || "code_workshop_single");
  const product = PRODUCT_CATALOG[productCode];
  if (!product) return json({ ok: false, error: "产品不存在" }, 400);

  const currency = String(body.currency || "CNY").toUpperCase();
  const amountMinor = priceFor(env, productCode, currency);
  if (!amountMinor) {
    return json({
      ok: false,
      error: "该支付币种的产品价格尚未配置，暂不能创建真实付款订单。",
      code: "PRODUCT_PRICE_NOT_CONFIGURED"
    }, 503);
  }

  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "邮箱格式不正确" }, 400);

  const orderId = randomId("T5O");
  const orderToken = randomHex(24);
  const builderAccessToken = randomHex(32);
  const [orderTokenHash, builderTokenHash] = await Promise.all([
    sha256Hex(orderToken),
    sha256Hex(builderAccessToken)
  ]);
  const now = nowIso();

  await env.BUILDER_DB.prepare(`INSERT INTO orders
    (order_id, order_token_hash, builder_token_hash, customer_email, product_code, product_name,
     amount_minor, currency, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`)
    .bind(orderId, orderTokenHash, builderTokenHash, email || null, productCode, product.name,
      amountMinor, currency, now, now).run();

  return json({
    ok: true,
    order: {
      order_id: orderId,
      order_token: orderToken,
      builder_access_token: builderAccessToken,
      product_code: productCode,
      product_name: product.name,
      amount_minor: amountMinor,
      currency,
      status: "pending"
    }
  });
}

async function getAuthorizedOrder(request, env, orderId) {
  if (!orderId || !env.BUILDER_DB) return null;
  const token = request.headers.get("X-Order-Token") || "";
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  return env.BUILDER_DB.prepare(`SELECT order_id, product_code, product_name, amount_minor, currency,
      payment_provider, provider_trade_id, status, grant_id, created_at, paid_at, granted_at, updated_at
    FROM orders WHERE order_id = ? AND order_token_hash = ?`).bind(orderId, tokenHash).first();
}

async function handleOrderStatus(request, env) {
  await ensureAccessDb(env);
  const url = new URL(request.url);
  const order = await getAuthorizedOrder(request, env, url.searchParams.get("order_id") || "");
  if (!order) return json({ ok: false, error: "订单不存在或订单令牌无效" }, 403);
  return json({ ok: true, order });
}

async function completePaidOrder(env, { orderId, provider, providerTradeId }) {
  await ensureAccessDb(env);
  const order = await env.BUILDER_DB.prepare(`SELECT order_id, builder_token_hash, product_code, status, grant_id
    FROM orders WHERE order_id = ?`).bind(orderId).first();
  if (!order) throw new Error("ORDER_NOT_FOUND");

  if (order.status === "granted" && order.grant_id) {
    return { orderId, grantId: order.grant_id, duplicate: true };
  }
  if (order.status !== "pending" && order.status !== "paid") throw new Error("ORDER_NOT_GRANTABLE");

  const product = PRODUCT_CATALOG[order.product_code];
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  const grantId = order.grant_id || randomId("GRANT");
  const created = nowIso();
  const expiresAt = new Date(Date.now() + product.expiresDays * 86400000).toISOString();

  try {
    await env.BUILDER_DB.batch([
      env.BUILDER_DB.prepare(`INSERT INTO builder_access_grants
        (grant_id, token_hash, label, plan, status, analyze_remaining, modify_remaining, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
        ON CONFLICT(token_hash) DO NOTHING`)
        .bind(grantId, order.builder_token_hash, `Order ${orderId}`, order.product_code,
          product.analyzeCredits, product.modifyCredits, expiresAt, created, created),
      env.BUILDER_DB.prepare(`UPDATE orders SET status = 'granted', payment_provider = ?, provider_trade_id = ?,
        grant_id = ?, paid_at = COALESCE(paid_at, ?), granted_at = COALESCE(granted_at, ?), updated_at = ?
        WHERE order_id = ? AND status IN ('pending','paid','granted')`)
        .bind(provider, providerTradeId, grantId, created, created, created, orderId)
    ]);
  } catch (error) {
    const refreshed = await env.BUILDER_DB.prepare("SELECT status, grant_id FROM orders WHERE order_id = ?").bind(orderId).first();
    if (refreshed?.status === "granted" && refreshed?.grant_id) {
      return { orderId, grantId: refreshed.grant_id, duplicate: true };
    }
    throw error;
  }

  return { orderId, grantId, duplicate: false };
}

async function handleAdminMarkPaid(request, env) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 403);
  const body = await request.json();
  const orderId = String(body.order_id || "");
  if (!orderId) return json({ ok: false, error: "缺少 order_id" }, 400);
  try {
    const result = await completePaidOrder(env, {
      orderId,
      provider: "admin_test",
      providerTradeId: String(body.provider_trade_id || randomId("TESTPAY"))
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: String(error.message || error) }, 409);
  }
}

function paymentAdapterNotConfigured(provider) {
  return json({
    ok: false,
    error: `${provider} 支付适配器尚未配置。接口已预留，但在完成商户签约与验签密钥配置前不会接受任何“支付成功”通知，也不会发放 AI 权限。`,
    code: "PAYMENT_ADAPTER_NOT_CONFIGURED",
    provider
  }, 503);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/builder/access" && request.method === "GET") {
      const access = await resolveAccess(request, env);
      return accessStatus(access);
    }

    if (url.pathname === "/api/orders/create" && request.method === "POST") {
      return handleCreateOrder(request, env);
    }

    if (url.pathname === "/api/orders/status" && request.method === "GET") {
      return handleOrderStatus(request, env);
    }

    if (url.pathname === "/api/admin/orders/mark-paid" && request.method === "POST") {
      return handleAdminMarkPaid(request, env);
    }

    if (url.pathname === "/api/payment/alipay/webhook" && request.method === "POST") {
      return paymentAdapterNotConfigured("Alipay");
    }
    if (url.pathname === "/api/payment/wechat/webhook" && request.method === "POST") {
      return paymentAdapterNotConfigured("WeChat Pay");
    }
    if (url.pathname === "/api/payment/paypal/webhook" && request.method === "POST") {
      return paymentAdapterNotConfigured("PayPal");
    }

    if (PAID_BUILDER_ROUTES.has(url.pathname)) {
      const access = await resolveAccess(request, env);
      if (!access) return paidRequired();

      const action = BILLABLE_ACTION.get(url.pathname);
      if (action) {
        const duplicate = await rejectDuplicateBillableRequest(request, env, action);
        if (duplicate) return duplicate;

        const reserved = await reserveCredit(env, access, action);
        if (!reserved) return quotaRequired(action);

        const response = await app.fetch(request, env, ctx);
        if (!response.ok) await restoreCredit(env, access, action);
        return response;
      }
    }

    return app.fetch(request, env, ctx);
  }
};
