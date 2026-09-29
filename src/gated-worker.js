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

function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  return Response.json(data, { status, headers });
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
      ON orders(payment_provider, provider_trade_id) WHERE provider_trade_id IS NOT NULL`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS payment_events (
      event_key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      event_type TEXT NOT NULL,
      order_id TEXT,
      provider_trade_id TEXT,
      created_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_payment_events_order
      ON payment_events(order_id)`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS payment_intents (
      provider TEXT NOT NULL,
      provider_order_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      approval_url TEXT,
      status TEXT NOT NULL DEFAULT 'created',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY(provider, provider_order_id),
      UNIQUE(provider, order_id)
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_payment_intents_order
      ON payment_intents(order_id)`)
  ]);
}

function parseCookies(request) {
  const out = {};
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function bearerToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const cookies = parseCookies(request);
  return (match?.[1] || request.headers.get("X-Builder-Access-Token") || cookies.t5_builder_access || "").trim();
}

function builderCookie(token, maxAgeSeconds = 2592000) {
  return `t5_builder_access=${encodeURIComponent(token)}; Path=/api/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
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

function paypalConfigured(env) {
  return Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID);
}

function providerStatus(env) {
  return {
    alipay: {
      enabled: false,
      configured: Boolean(env.ALIPAY_APP_ID && env.ALIPAY_PRIVATE_KEY && env.ALIPAY_PUBLIC_KEY),
      adapter_ready: false,
      currency: "CNY"
    },
    wechat: {
      enabled: false,
      configured: Boolean(env.WECHATPAY_MCH_ID && env.WECHATPAY_API_V3_KEY && env.WECHATPAY_PRIVATE_KEY),
      adapter_ready: false,
      currency: "CNY"
    },
    paypal: {
      enabled: paypalConfigured(env),
      configured: paypalConfigured(env),
      adapter_ready: true,
      currency: "USD"
    }
  };
}

function handleCatalog(env) {
  const product = PRODUCT_CATALOG.code_workshop_single;
  const cny = priceFor(env, "code_workshop_single", "CNY");
  const usd = priceFor(env, "code_workshop_single", "USD");
  return json({
    ok: true,
    products: [{
      code: "code_workshop_single",
      name: product.name,
      analyze_credits: product.analyzeCredits,
      modify_credits: product.modifyCredits,
      expires_days: product.expiresDays,
      prices: { CNY: cny, USD: usd }
    }],
    providers: providerStatus(env)
  });
}

async function handleCreateOrder(request, env) {
  await ensureAccessDb(env);
  const body = await request.json();
  const productCode = String(body.product_code || "code_workshop_single");
  const product = PRODUCT_CATALOG[productCode];
  if (!product) return json({ ok: false, error: "产品不存在" }, 400);

  const currency = String(body.currency || "CNY").toUpperCase();
  if (!["CNY", "USD"].includes(currency)) return json({ ok: false, error: "暂不支持该币种" }, 400);
  const amountMinor = priceFor(env, productCode, currency);
  if (!amountMinor) {
    return json({
      ok: false,
      error: "该支付币种的产品价格尚未配置，暂不能创建真实付款订单。",
      code: "PRODUCT_PRICE_NOT_CONFIGURED"
    }, 503);
  }

  const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: "请输入有效邮箱" }, 400);

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
    .bind(orderId, orderTokenHash, builderTokenHash, email, productCode, product.name,
      amountMinor, currency, now, now).run();

  return json({
    ok: true,
    order: {
      order_id: orderId,
      order_token: orderToken,
      product_code: productCode,
      product_name: product.name,
      amount_minor: amountMinor,
      currency,
      status: "pending"
    }
  }, 200);
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

async function handleCancelOrder(request, env) {
  await ensureAccessDb(env);
  const body = await request.json();
  const orderId = String(body.order_id || "");
  const order = await getAuthorizedOrder(request, env, orderId);
  if (!order) return json({ ok: false, error: "订单不存在或订单令牌无效" }, 403);
  if (order.status !== "pending") return json({ ok: false, error: "仅未付款订单可以取消" }, 409);
  await env.BUILDER_DB.prepare("UPDATE orders SET status = 'canceled', updated_at = ? WHERE order_id = ? AND status = 'pending'")
    .bind(nowIso(), orderId).run();
  return json({ ok: true, order_id: orderId, status: "canceled" });
}

async function recordPaymentEvent(env, { provider, eventId, eventType, orderId = null, providerTradeId = null }) {
  if (!eventId) return true;
  const result = await env.BUILDER_DB.prepare(`INSERT INTO payment_events
    (event_key, provider, event_type, order_id, provider_trade_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(event_key) DO NOTHING`)
    .bind(`${provider}:${eventId}`, provider, eventType, orderId, providerTradeId, nowIso()).run();
  return Number(result?.meta?.changes || 0) === 1;
}

async function completePaidOrder(env, { orderId, provider, providerTradeId, paidAmountMinor, currency, eventId = null }) {
  await ensureAccessDb(env);
  const order = await env.BUILDER_DB.prepare(`SELECT order_id, builder_token_hash, product_code, amount_minor, currency, status, grant_id
    FROM orders WHERE order_id = ?`).bind(orderId).first();
  if (!order) throw new Error("ORDER_NOT_FOUND");

  if (order.status === "granted" && order.grant_id) {
    return { orderId, grantId: order.grant_id, duplicate: true };
  }
  if (order.status !== "pending" && order.status !== "paid") throw new Error("ORDER_NOT_GRANTABLE");
  if (Number(paidAmountMinor) !== Number(order.amount_minor)) throw new Error("PAYMENT_AMOUNT_MISMATCH");
  if (String(currency || "").toUpperCase() !== String(order.currency).toUpperCase()) throw new Error("PAYMENT_CURRENCY_MISMATCH");
  if (!provider || !providerTradeId) throw new Error("PAYMENT_REFERENCE_REQUIRED");

  const product = PRODUCT_CATALOG[order.product_code];
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  let existingEvent = null;
  if (eventId) {
    existingEvent = await env.BUILDER_DB.prepare(`SELECT provider, order_id, provider_trade_id
      FROM payment_events WHERE event_key = ?`).bind(`${provider}:${eventId}`).first();
    if (existingEvent) {
      if (String(existingEvent.provider || "") !== provider
        || (existingEvent.order_id && String(existingEvent.order_id) !== orderId)
        || (existingEvent.provider_trade_id && String(existingEvent.provider_trade_id) !== providerTradeId)) {
        throw new Error("PAYMENT_EVENT_CONFLICT");
      }
    }
  }

  // Deterministic for a given order so concurrent capture/webhook fulfillment attempts
  // cannot point the order at different random grant IDs.
  const grantId = order.grant_id || `GRANT-${orderId}`;
  const created = nowIso();
  const expiresAt = new Date(Date.now() + product.expiresDays * 86400000).toISOString();
  const statements = [];

  if (eventId) {
    statements.push(env.BUILDER_DB.prepare(`INSERT INTO payment_events
      (event_key, provider, event_type, order_id, provider_trade_id, created_at)
      VALUES (?, ?, 'payment_completed', ?, ?, ?) ON CONFLICT(event_key) DO NOTHING`)
      .bind(`${provider}:${eventId}`, provider, orderId, providerTradeId, created));
  }

  statements.push(
    env.BUILDER_DB.prepare(`INSERT INTO builder_access_grants
      (grant_id, token_hash, label, plan, status, analyze_remaining, modify_remaining, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING`)
      .bind(grantId, order.builder_token_hash, `Order ${orderId}`, order.product_code,
        product.analyzeCredits, product.modifyCredits, expiresAt, created, created),
    env.BUILDER_DB.prepare(`UPDATE orders SET status = 'granted', payment_provider = ?, provider_trade_id = ?,
      grant_id = ?, paid_at = COALESCE(paid_at, ?), granted_at = COALESCE(granted_at, ?), updated_at = ?
      WHERE order_id = ? AND status IN ('pending','paid','granted')`)
      .bind(provider, providerTradeId, grantId, created, created, created, orderId)
  );

  // D1 batch is transactional: payment event de-duplication, grant creation, and
  // order fulfillment either commit together or roll back together.
  await env.BUILDER_DB.batch(statements);

  const fulfilled = await env.BUILDER_DB.prepare(`SELECT o.status, o.grant_id, g.grant_id AS live_grant
    FROM orders o LEFT JOIN builder_access_grants g ON g.grant_id = o.grant_id
    WHERE o.order_id = ?`).bind(orderId).first();
  if (fulfilled?.status !== "granted" || !fulfilled?.grant_id || !fulfilled?.live_grant) {
    throw new Error("PAYMENT_FULFILLMENT_INCOMPLETE");
  }

  return { orderId, grantId: fulfilled.grant_id, duplicate: Boolean(existingEvent) };
}

async function revokePaidOrder(env, { orderId, provider, eventId = null, providerTradeId = null, eventType = "payment_refunded" }) {
  await ensureAccessDb(env);
  const order = await env.BUILDER_DB.prepare("SELECT order_id, status, grant_id FROM orders WHERE order_id = ?").bind(orderId).first();
  if (!order) throw new Error("ORDER_NOT_FOUND");

  let existingEvent = null;
  if (eventId) {
    existingEvent = await env.BUILDER_DB.prepare(`SELECT provider, event_type, order_id, provider_trade_id
      FROM payment_events WHERE event_key = ?`).bind(`${provider}:${eventId}`).first();
    if (existingEvent) {
      if (String(existingEvent.provider || "") !== provider
        || String(existingEvent.event_type || "") !== eventType
        || (existingEvent.order_id && String(existingEvent.order_id) !== orderId)
        || (existingEvent.provider_trade_id && providerTradeId && String(existingEvent.provider_trade_id) !== providerTradeId)) {
        throw new Error("PAYMENT_EVENT_CONFLICT");
      }
    }
  }

  const updated = nowIso();
  const statements = [];
  if (eventId) {
    statements.push(env.BUILDER_DB.prepare(`INSERT INTO payment_events
      (event_key, provider, event_type, order_id, provider_trade_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(event_key) DO NOTHING`)
      .bind(`${provider}:${eventId}`, provider, eventType, orderId, providerTradeId, updated));
  }
  statements.push(
    env.BUILDER_DB.prepare("UPDATE orders SET status = 'refunded', updated_at = ? WHERE order_id = ?")
      .bind(updated, orderId)
  );
  if (order.grant_id) {
    statements.push(env.BUILDER_DB.prepare("UPDATE builder_access_grants SET status = 'revoked', updated_at = ? WHERE grant_id = ?")
      .bind(updated, order.grant_id));
  }

  // The provider event ledger and local access revocation must commit together.
  await env.BUILDER_DB.batch(statements);

  const revoked = await env.BUILDER_DB.prepare(`SELECT o.status AS order_status, o.grant_id, g.status AS grant_status
    FROM orders o LEFT JOIN builder_access_grants g ON g.grant_id = o.grant_id
    WHERE o.order_id = ?`).bind(orderId).first();
  if (revoked?.order_status !== "refunded" || (revoked?.grant_id && revoked?.grant_status !== "revoked")) {
    throw new Error("PAYMENT_REVOCATION_INCOMPLETE");
  }
  return { orderId, duplicate: Boolean(existingEvent) };
}

function paypalBase(env) {
  return String(env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function paypalAccessToken(env) {
  if (!paypalConfigured(env)) throw new Error("PAYPAL_NOT_CONFIGURED");
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data?.error_description || data?.error || "PAYPAL_OAUTH_FAILED");
  return data.access_token;
}

function paypalMinor(value) {
  const m = String(value || "").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] || "").padEnd(2, "0"));
}

async function paypalJson(env, path, { method = "GET", body = null, requestId = null } = {}) {
  const token = await paypalAccessToken(env);
  const headers = new Headers({
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  });
  if (requestId) headers.set("PayPal-Request-Id", requestId.slice(0, 108));
  const response = await fetch(`${paypalBase(env)}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  let data = null;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    const err = new Error(data?.message || data?.name || `PAYPAL_HTTP_${response.status}`);
    err.status = response.status;
    err.paypal = data;
    throw err;
  }
  return data;
}

function paypalSafeDiagnostics(error) {
  const payload = error?.paypal && typeof error.paypal === "object" ? error.paypal : {};
  const detail = Array.isArray(payload.details)
    ? payload.details.find(item => item && typeof item === "object") || {}
    : {};
  const clean = (value, max) => String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
  return {
    issue: clean(detail.issue || payload.name, 120) || null,
    description: clean(detail.description, 400) || null,
    debug_id: clean(payload.debug_id, 120) || null,
    http_status: Number.isInteger(error?.status) ? error.status : null
  };
}

async function handlePayPalCreate(request, env) {
  if (!paypalConfigured(env)) return paymentAdapterNotConfigured("PayPal");
  await ensureAccessDb(env);
  const body = await request.json();
  const orderId = String(body.order_id || "");
  const order = await getAuthorizedOrder(request, env, orderId);
  if (!order) return json({ ok: false, error: "订单不存在或订单令牌无效" }, 403);
  if (order.status === "granted") return json({ ok: true, already_paid: true, order_id: orderId });
  if (order.status !== "pending") return json({ ok: false, error: "该订单当前不能发起付款" }, 409);
  if (order.currency !== "USD") return json({ ok: false, error: "PayPal 订单必须使用 USD" }, 400);

  const existing = await env.BUILDER_DB.prepare(`SELECT provider_order_id, approval_url, status
    FROM payment_intents WHERE provider = 'paypal' AND order_id = ?`).bind(orderId).first();
  if (existing?.provider_order_id && existing?.approval_url && existing.status !== "failed") {
    return json({
      ok: true,
      order_id: orderId,
      paypal_order_id: existing.provider_order_id,
      approval_url: existing.approval_url,
      reused: true
    });
  }

  const origin = new URL(request.url).origin;
  const returnUrl = `${origin}/checkout/?provider=paypal&status=return&order_id=${encodeURIComponent(orderId)}`;
  const cancelUrl = `${origin}/checkout/?provider=paypal&status=cancel&order_id=${encodeURIComponent(orderId)}`;
  const value = (Number(order.amount_minor) / 100).toFixed(2);

  try {
    const pp = await paypalJson(env, "/v2/checkout/orders", {
      method: "POST",
      requestId: `create-${orderId}`,
      body: {
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: orderId,
          custom_id: orderId,
          invoice_id: orderId,
          amount: { currency_code: "USD", value }
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "T5 Quant Lab",
              shipping_preference: "NO_SHIPPING",
              user_action: "PAY_NOW",
              return_url: returnUrl,
              cancel_url: cancelUrl
            }
          }
        }
      }
    });
    const approvalUrl = (pp.links || []).find(x => x.rel === "payer-action")?.href
      || (pp.links || []).find(x => x.rel === "approve")?.href;
    if (!pp.id || !approvalUrl) throw new Error("PAYPAL_APPROVAL_LINK_MISSING");
    const now = nowIso();
    await env.BUILDER_DB.prepare(`INSERT INTO payment_intents
      (provider, provider_order_id, order_id, approval_url, status, created_at, updated_at)
      VALUES ('paypal', ?, ?, ?, 'created', ?, ?)
      ON CONFLICT(provider, order_id) DO UPDATE SET provider_order_id = excluded.provider_order_id,
        approval_url = excluded.approval_url, status = 'created', updated_at = excluded.updated_at`)
      .bind(pp.id, orderId, approvalUrl, now, now).run();
    return json({ ok: true, order_id: orderId, paypal_order_id: pp.id, approval_url: approvalUrl });
  } catch (error) {
    const diagnostics = paypalSafeDiagnostics(error);
    console.error("paypal_create_failed", JSON.stringify(diagnostics));
    const reason = diagnostics.issue
      ? `${diagnostics.issue}${diagnostics.description ? ` · ${diagnostics.description}` : ""}`
      : String(error?.message || error || "PAYPAL_CREATE_FAILED").slice(0, 400);
    return json({
      ok: false,
      error: `PayPal下单失败：${reason}`,
      code: "PAYPAL_CREATE_FAILED",
      issue: diagnostics.issue,
      description: diagnostics.description,
      debug_id: diagnostics.debug_id
    }, 502);
  }
}

function paypalCaptureFromOrder(ppOrder) {
  for (const unit of ppOrder?.purchase_units || []) {
    for (const capture of unit?.payments?.captures || []) {
      if (capture?.status === "COMPLETED") return { capture, unit };
    }
  }
  return null;
}

async function handlePayPalCapture(request, env) {
  if (!paypalConfigured(env)) return paymentAdapterNotConfigured("PayPal");
  await ensureAccessDb(env);
  const body = await request.json();
  const orderId = String(body.order_id || "");
  const paypalOrderId = String(body.paypal_order_id || "");
  const order = await getAuthorizedOrder(request, env, orderId);
  if (!order) return json({ ok: false, error: "订单不存在或订单令牌无效" }, 403);
  if (order.status === "granted") return json({ ok: true, order_id: orderId, status: "granted", duplicate: true });
  if (order.status !== "pending" && order.status !== "paid") return json({ ok: false, error: "该订单当前不能完成付款" }, 409);
  if (!paypalOrderId) return json({ ok: false, error: "缺少 PayPal order id" }, 400);

  const intent = await env.BUILDER_DB.prepare(`SELECT provider_order_id FROM payment_intents
    WHERE provider = 'paypal' AND order_id = ?`).bind(orderId).first();
  if (!intent || intent.provider_order_id !== paypalOrderId) return json({ ok: false, error: "PayPal订单与T5订单不匹配" }, 409);

  let ppOrder;
  try {
    try {
      ppOrder = await paypalJson(env, `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
        method: "POST",
        requestId: `capture-${orderId}`,
        body: {}
      });
    } catch (captureError) {
      if (captureError.status !== 422) throw captureError;
      ppOrder = await paypalJson(env, `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
    }

    const found = paypalCaptureFromOrder(ppOrder);
    if (!found) throw new Error("PAYPAL_CAPTURE_NOT_COMPLETED");
    const { capture, unit } = found;
    if (String(unit?.custom_id || unit?.invoice_id || "") !== orderId) throw new Error("PAYPAL_ORDER_REFERENCE_MISMATCH");
    const paidMinor = paypalMinor(capture?.amount?.value);
    const currency = String(capture?.amount?.currency_code || "").toUpperCase();
    const result = await completePaidOrder(env, {
      orderId,
      provider: "paypal",
      providerTradeId: String(capture.id || ""),
      paidAmountMinor: paidMinor,
      currency,
      eventId: `capture:${capture.id}`
    });
    await env.BUILDER_DB.prepare(`UPDATE payment_intents SET status = 'captured', updated_at = ?
      WHERE provider = 'paypal' AND provider_order_id = ?`).bind(nowIso(), paypalOrderId).run();
    return json({ ok: true, order_id: orderId, status: "granted", ...result });
  } catch (error) {
    return json({ ok: false, error: `PayPal收款确认失败：${error.message || error}` }, 502);
  }
}

async function verifyPayPalWebhook(request, env) {
  if (!paypalConfigured(env)) throw new Error("PAYPAL_NOT_CONFIGURED");
  const raw = await request.text();
  let event;
  try { event = JSON.parse(raw); } catch { throw new Error("PAYPAL_WEBHOOK_INVALID_JSON"); }
  const payload = {
    auth_algo: request.headers.get("PAYPAL-AUTH-ALGO") || "",
    cert_url: request.headers.get("PAYPAL-CERT-URL") || "",
    transmission_id: request.headers.get("PAYPAL-TRANSMISSION-ID") || "",
    transmission_sig: request.headers.get("PAYPAL-TRANSMISSION-SIG") || "",
    transmission_time: request.headers.get("PAYPAL-TRANSMISSION-TIME") || "",
    webhook_id: env.PAYPAL_WEBHOOK_ID,
    webhook_event: event
  };
  if (!payload.auth_algo || !payload.cert_url || !payload.transmission_id || !payload.transmission_sig || !payload.transmission_time) {
    throw new Error("PAYPAL_WEBHOOK_HEADERS_MISSING");
  }
  const verification = await paypalJson(env, "/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: payload
  });
  if (verification?.verification_status !== "SUCCESS") throw new Error("PAYPAL_WEBHOOK_SIGNATURE_INVALID");
  return event;
}

async function localOrderFromPayPalEvent(env, event) {
  const resource = event?.resource || {};
  const providerOrderId = resource?.supplementary_data?.related_ids?.order_id || "";
  if (providerOrderId) {
    const intent = await env.BUILDER_DB.prepare(`SELECT order_id FROM payment_intents
      WHERE provider = 'paypal' AND provider_order_id = ?`).bind(providerOrderId).first();
    if (intent?.order_id) return { orderId: intent.order_id, providerOrderId };
  }
  const direct = String(resource.custom_id || resource.invoice_id || "");
  if (direct) return { orderId: direct, providerOrderId };

  const up = (resource.links || []).find(x => x.rel === "up")?.href || "";
  const captureMatch = up.match(/\/captures\/([^/?#]+)/);
  if (captureMatch) {
    const order = await env.BUILDER_DB.prepare(`SELECT order_id FROM orders
      WHERE payment_provider = 'paypal' AND provider_trade_id = ?`).bind(captureMatch[1]).first();
    if (order?.order_id) return { orderId: order.order_id, providerOrderId };
  }
  return null;
}

async function handlePayPalWebhook(request, env) {
  if (!paypalConfigured(env)) return paymentAdapterNotConfigured("PayPal");
  await ensureAccessDb(env);
  let event;
  try {
    event = await verifyPayPalWebhook(request, env);
  } catch (error) {
    return json({ ok: false, error: String(error.message || error) }, 400);
  }

  const eventType = String(event.event_type || "");
  const eventId = String(event.id || "");
  const resource = event.resource || {};
  const local = await localOrderFromPayPalEvent(env, event);

  try {
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      if (!local?.orderId) throw new Error("PAYPAL_LOCAL_ORDER_NOT_FOUND");
      const paidMinor = paypalMinor(resource?.amount?.value);
      const currency = String(resource?.amount?.currency_code || "").toUpperCase();
      await completePaidOrder(env, {
        orderId: local.orderId,
        provider: "paypal",
        providerTradeId: String(resource.id || ""),
        paidAmountMinor: paidMinor,
        currency,
        eventId: eventId || `capture:${resource.id}`
      });
      if (local.providerOrderId) {
        await env.BUILDER_DB.prepare(`UPDATE payment_intents SET status = 'captured', updated_at = ?
          WHERE provider = 'paypal' AND provider_order_id = ?`).bind(nowIso(), local.providerOrderId).run();
      }
      return json({ ok: true });
    }

    if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
      if (!local?.orderId) return json({ ok: true, ignored: true });
      const order = await env.BUILDER_DB.prepare("SELECT amount_minor, currency FROM orders WHERE order_id = ?")
        .bind(local.orderId).first();
      const refundMinor = paypalMinor(resource?.amount?.value);
      const currency = String(resource?.amount?.currency_code || "").toUpperCase();
      if (order && refundMinor === Number(order.amount_minor) && currency === String(order.currency).toUpperCase()) {
        await revokePaidOrder(env, {
          orderId: local.orderId,
          provider: "paypal",
          providerTradeId: String(resource.id || ""),
          eventId: eventId || `refund:${resource.id}`
        });
      } else {
        await recordPaymentEvent(env, {
          provider: "paypal",
          eventId: eventId || `partial-refund:${resource.id}`,
          eventType: "payment_partial_refund",
          orderId: local.orderId,
          providerTradeId: String(resource.id || "")
        });
      }
      return json({ ok: true });
    }

    if (eventType === "PAYMENT.CAPTURE.REVERSED") {
      if (local?.orderId) {
        await revokePaidOrder(env, {
          orderId: local.orderId,
          provider: "paypal",
          providerTradeId: String(resource.id || ""),
          eventId: eventId || `reversal:${resource.id}`,
          eventType: "payment_reversed"
        });
      }
      return json({ ok: true });
    }

    if (eventId) {
      await recordPaymentEvent(env, {
        provider: "paypal",
        eventId,
        eventType: eventType || "unhandled",
        orderId: local?.orderId || null,
        providerTradeId: String(resource.id || "") || null
      });
    }
    return json({ ok: true, ignored: true });
  } catch (error) {
    return json({ ok: false, error: String(error.message || error) }, 500);
  }
}

async function handleAdminMarkPaid(request, env) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 403);
  if (String(env.ENABLE_PAYMENT_TEST_MODE || "").toLowerCase() !== "true") {
    return json({ ok: false, error: "Payment test mode is disabled" }, 403);
  }
  const body = await request.json();
  const orderId = String(body.order_id || "");
  if (!orderId) return json({ ok: false, error: "缺少 order_id" }, 400);
  const order = await env.BUILDER_DB.prepare("SELECT amount_minor, currency FROM orders WHERE order_id = ?").bind(orderId).first();
  if (!order) return json({ ok: false, error: "ORDER_NOT_FOUND" }, 404);
  try {
    const result = await completePaidOrder(env, {
      orderId,
      provider: "admin_test",
      providerTradeId: String(body.provider_trade_id || randomId("TESTPAY")),
      paidAmountMinor: Number(order.amount_minor),
      currency: order.currency,
      eventId: String(body.event_id || randomId("TESTEVENT"))
    });
    return json({ ok: true, ...result });
  } catch (error) {
    return json({ ok: false, error: String(error.message || error) }, 409);
  }
}

async function handleAdminRefund(request, env) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 403);
  if (String(env.ENABLE_PAYMENT_TEST_MODE || "").toLowerCase() !== "true") {
    return json({ ok: false, error: "Payment test mode is disabled" }, 403);
  }
  const body = await request.json();
  const orderId = String(body.order_id || "");
  if (!orderId) return json({ ok: false, error: "缺少 order_id" }, 400);
  try {
    const result = await revokePaidOrder(env, {
      orderId,
      provider: "admin_test",
      providerTradeId: String(body.provider_trade_id || ""),
      eventId: String(body.event_id || randomId("TESTREFUND"))
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

    if (url.pathname === "/api/payments/catalog" && request.method === "GET") {
      return handleCatalog(env);
    }

    if (url.pathname === "/api/orders/create" && request.method === "POST") {
      return handleCreateOrder(request, env);
    }

    if (url.pathname === "/api/orders/status" && request.method === "GET") {
      return handleOrderStatus(request, env);
    }

    if (url.pathname === "/api/orders/cancel" && request.method === "POST") {
      return handleCancelOrder(request, env);
    }

    if (url.pathname === "/api/payment/paypal/create" && request.method === "POST") {
      return handlePayPalCreate(request, env);
    }

    if (url.pathname === "/api/payment/paypal/capture" && request.method === "POST") {
      return handlePayPalCapture(request, env);
    }

    if (url.pathname === "/api/admin/orders/mark-paid" && request.method === "POST") {
      return handleAdminMarkPaid(request, env);
    }

    if (url.pathname === "/api/admin/orders/refund" && request.method === "POST") {
      return handleAdminRefund(request, env);
    }

    if (url.pathname === "/api/payment/alipay/webhook" && request.method === "POST") {
      return paymentAdapterNotConfigured("Alipay");
    }
    if (url.pathname === "/api/payment/wechat/webhook" && request.method === "POST") {
      return paymentAdapterNotConfigured("WeChat Pay");
    }
    if (url.pathname === "/api/payment/paypal/webhook" && request.method === "POST") {
      return handlePayPalWebhook(request, env);
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
