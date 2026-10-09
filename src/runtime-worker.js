import app from "./marketing-worker.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

async function constantTimeEqual(a, b) {
  if (!a || !b) return false;
  const [x, y] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

async function isAdmin(request, env) {
  const supplied = request.headers.get("X-Builder-Access-Key") || "";
  return Boolean(env.BUILDER_ACCESS_KEY) && constantTimeEqual(env.BUILDER_ACCESS_KEY, supplied);
}

function configState(env) {
  const d1 = Boolean(env.BUILDER_DB);
  const r2 = Boolean(env.USER_CODE_BUCKET);
  const assets = Boolean(env.ASSETS);
  const openai = Boolean(env.OPENAI_API_KEY);
  const accountSecret = Boolean(env.ACCOUNT_AUTH_SECRET);
  const resend = Boolean(env.RESEND_API_KEY && env.AUTH_EMAIL_FROM);
  const paypal = Boolean(
    String(env.PAYPAL_CLIENT_ID || "").trim()
    && String(env.PAYPAL_CLIENT_SECRET || "").trim()
    && String(env.PAYPAL_WEBHOOK_ID || "").trim()
  );
  const auditSalt = String(env.AUDIT_HASH_SALT || "").trim().length >= 16;
  const paypalEnvironment = String(env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase() === "live" ? "live" : "sandbox";
  const paymentTestMode = String(env.ENABLE_PAYMENT_TEST_MODE || "").toLowerCase() === "true";
  const accountReady = d1 && accountSecret && resend;
  const paidBuilderReady = d1 && r2 && openai && accountReady && paypal && auditSalt;
  const indicatorCheckoutReady = d1 && r2 && accountReady && paypal && auditSalt;
  const checkoutReady = paidBuilderReady && (paypalEnvironment === "live" || paymentTestMode);
  const indicatorCheckoutOpen = indicatorCheckoutReady && (paypalEnvironment === "live" || paymentTestMode);
  const marketingReady = d1 && accountSecret && Boolean(env.RESEND_API_KEY && (env.MARKETING_EMAIL_FROM || env.AUTH_EMAIL_FROM));
  return {
    assets,
    d1,
    r2,
    openai,
    account_secret: accountSecret,
    email_auth: resend,
    paypal,
    audit_salt: auditSalt,
    account_ready: accountReady,
    paid_builder_ready: paidBuilderReady,
    indicator_checkout_ready: indicatorCheckoutOpen,
    checkout_ready: checkoutReady,
    marketing_ready: marketingReady,
    free_source_inspector_ready: assets,
    paypal_environment: paypalEnvironment,
    payment_test_mode: paymentTestMode
  };
}

async function publicHealth(env) {
  const state = configState(env);
  return json({
    ok: true,
    service: "t5quantlab",
    runtime: "runtime-guard-v4",
    public_site_ready: state.assets,
    free_source_inspector_ready: state.free_source_inspector_ready,
    account_ready: state.account_ready,
    paid_builder_ready: state.paid_builder_ready,
    checkout_ready: state.checkout_ready,
    payment_environment: state.paypal_environment
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function paypalBase(env) {
  return String(env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function senderDomain(value) {
  const raw = String(value || "").trim();
  const email = raw.match(/<([^>]+)>/)?.[1] || raw;
  const at = email.lastIndexOf("@");
  return at > 0 ? email.slice(at + 1).trim().toLowerCase() : "";
}

async function checkOpenAIModel(env, model) {
  if (!env.OPENAI_API_KEY) return { ok: false, detail: "not configured" };
  try {
    const r = await fetchWithTimeout(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      headers: { "Authorization": `Bearer ${env.OPENAI_API_KEY}` }
    });
    return { ok: r.ok, http_status: r.status, detail: r.ok ? `${model} accessible` : `OpenAI HTTP ${r.status}` };
  } catch (error) {
    return { ok: false, detail: `OpenAI check failed: ${String(error?.name || error).slice(0, 80)}` };
  }
}

async function externalDeepChecks(request, env) {
  const result = {
    requested: true,
    openai_model: { ok: false, detail: "not configured" },
    openai_modify_model: { ok: false, detail: "not configured" },
    paypal_oauth: { ok: false, detail: "not configured" },
    paypal_webhook: { ok: false, detail: "not configured", missing_events: [] },
    resend_domains: { ok: false, detail: "not configured", domains: [] }
  };

  const analyzeModel = String(env.OPENAI_ANALYZE_MODEL || "gpt-5.6-terra");
  const modifyModel = String(env.OPENAI_MODIFY_MODEL || "gpt-5.6-sol");
  if (env.OPENAI_API_KEY) {
    result.openai_model = await checkOpenAIModel(env, analyzeModel);
    result.openai_modify_model = analyzeModel === modifyModel
      ? { ...result.openai_model }
      : await checkOpenAIModel(env, modifyModel);
  }

  let paypalToken = "";
  const paypalClientId = String(env.PAYPAL_CLIENT_ID || "").trim();
  const paypalClientSecret = String(env.PAYPAL_CLIENT_SECRET || "").trim();
  const paypalWebhookId = String(env.PAYPAL_WEBHOOK_ID || "").trim();
  if (paypalClientId && paypalClientSecret) {
    try {
      const auth = btoa(`${paypalClientId}:${paypalClientSecret}`);
      const r = await fetchWithTimeout(`${paypalBase(env)}/v1/oauth2/token`, {
        method: "POST",
        headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials"
      });
      let d = {};
      try { d = await r.json(); } catch {}
      paypalToken = r.ok ? String(d.access_token || "") : "";
      result.paypal_oauth = { ok: r.ok && Boolean(paypalToken), http_status: r.status, detail: r.ok && paypalToken ? "OAuth credentials accepted" : `PayPal OAuth HTTP ${r.status}` };
    } catch (error) {
      result.paypal_oauth = { ok: false, detail: `PayPal OAuth failed: ${String(error?.name || error).slice(0, 80)}` };
    }
  }

  if (paypalToken && paypalWebhookId) {
    try {
      const r = await fetchWithTimeout(`${paypalBase(env)}/v1/notifications/webhooks?page_size=20`, {
        headers: { "Authorization": `Bearer ${paypalToken}`, "Accept": "application/json" }
      });
      let d = {};
      try { d = await r.json(); } catch {}
      const expectedUrl = `${new URL(request.url).origin}/api/payment/paypal/webhook`.replace(/\/$/, "");
      const webhooks = Array.isArray(d.webhooks) ? d.webhooks : [];
      const webhookById = webhooks.find(x => String(x?.id || "").trim() === paypalWebhookId);
      const webhookByUrl = webhooks.find(x => String(x?.url || "").replace(/\/$/, "") === expectedUrl);
      const webhook = webhookById || webhookByUrl || null;
      const actualId = String(webhook?.id || "").trim();
      const actualUrl = String(webhook?.url || "").replace(/\/$/, "");
      const idMatch = actualId === paypalWebhookId;
      const urlMatch = actualUrl === expectedUrl;
      const names = (webhook?.event_types || []).map(x => String(x?.name || ""));
      const wildcard = names.includes("*");
      const required = [
        "PAYMENT.CAPTURE.COMPLETED",
        "PAYMENT.CAPTURE.REFUNDED",
        "PAYMENT.CAPTURE.REVERSED",
        "CUSTOMER.DISPUTE.CREATED",
        "CUSTOMER.DISPUTE.UPDATED",
        "CUSTOMER.DISPUTE.RESOLVED"
      ];
      const missing = wildcard ? [] : required.filter(name => !names.includes(name));
      const ok = r.ok && Boolean(webhook) && idMatch && urlMatch && missing.length === 0;
      result.paypal_webhook = {
        ok,
        http_status: r.status,
        detail: !r.ok
          ? `PayPal webhook list HTTP ${r.status}`
          : !webhook
            ? "No webhook found for the production callback URL"
            : !idMatch
              ? "Configured webhook ID does not match the production callback"
              : !urlMatch
                ? "Webhook URL mismatch"
                : missing.length
                  ? "Required webhook events missing"
                  : "Webhook ID, URL and required events verified",
        id_match: idMatch,
        url_match: urlMatch,
        missing_events: missing
      };
    } catch (error) {
      result.paypal_webhook = { ok: false, detail: `PayPal webhook check failed: ${String(error?.name || error).slice(0, 80)}`, missing_events: [] };
    }
  }

  if (env.RESEND_API_KEY) {
    try {
      const r = await fetchWithTimeout("https://api.resend.com/domains?limit=100", {
        headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Accept": "application/json" }
      });
      let d = {};
      try { d = await r.json(); } catch {}
      const expected = [...new Set([senderDomain(env.AUTH_EMAIL_FROM), senderDomain(env.MARKETING_EMAIL_FROM || env.AUTH_EMAIL_FROM)].filter(Boolean))];
      const listed = Array.isArray(d.data) ? d.data : [];
      const domains = expected.map(name => {
        const found = listed.find(x => String(x?.name || "").toLowerCase() === name);
        const status = String(found?.status || "missing").toLowerCase();
        const sending = String(found?.capabilities?.sending || "").toLowerCase();
        return { domain: name, status, sending: sending || "unknown", ok: status === "verified" && sending !== "disabled" };
      });
      result.resend_domains = {
        ok: r.ok && expected.length > 0 && domains.every(x => x.ok),
        http_status: r.status,
        detail: !r.ok ? `Resend HTTP ${r.status}` : expected.length === 0 ? "Sender domain could not be parsed" : domains.every(x => x.ok) ? "Sender domain(s) verified" : "One or more sender domains are not verified for sending",
        domains
      };
    } catch (error) {
      result.resend_domains = { ok: false, detail: `Resend domain check failed: ${String(error?.name || error).slice(0, 80)}`, domains: [] };
    }
  }

  result.all_ok = result.openai_model.ok && result.openai_modify_model.ok && result.paypal_oauth.ok && result.paypal_webhook.ok && result.resend_domains.ok;
  return result;
}

async function adminHealth(request, env) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 403);

  const state = configState(env);
  const checks = {
    d1_query: { ok: false, detail: state.d1 ? "not checked" : "binding missing" },
    r2_access: { ok: false, detail: state.r2 ? "not checked" : "binding missing" }
  };
  let tables = [];

  if (state.d1) {
    try {
      await env.BUILDER_DB.prepare("SELECT 1 AS ok").first();
      checks.d1_query = { ok: true, detail: "SELECT 1 succeeded" };
      const rows = await env.BUILDER_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
      tables = (rows?.results || []).map(x => String(x.name || "")).filter(Boolean);
    } catch (error) {
      checks.d1_query = { ok: false, detail: String(error?.message || error).slice(0, 240) };
    }
  }

  if (state.r2) {
    try {
      await env.USER_CODE_BUCKET.list({ limit: 1 });
      checks.r2_access = { ok: true, detail: "bucket list succeeded" };
    } catch (error) {
      checks.r2_access = { ok: false, detail: String(error?.message || error).slice(0, 240) };
    }
  }

  const expectedCoreTables = [
    "users", "auth_challenges", "auth_sessions", "orders", "builder_access_grants",
    "projects", "jobs", "versions", "payment_intents", "payment_events",
    "order_terms", "entitlement_adjustments", "service_events", "payment_disputes"
  ];
  const expectedMarketingTables = ["marketing_consent_events", "marketing_campaigns", "marketing_deliveries"];
  const missingCoreTables = expectedCoreTables.filter(name => !tables.includes(name));
  const missingMarketingTables = expectedMarketingTables.filter(name => !tables.includes(name));
  const missingSecrets = [];
  if (!env.OPENAI_API_KEY) missingSecrets.push("OPENAI_API_KEY");
  if (!env.ACCOUNT_AUTH_SECRET) missingSecrets.push("ACCOUNT_AUTH_SECRET");
  if (!env.RESEND_API_KEY) missingSecrets.push("RESEND_API_KEY");
  if (!env.AUTH_EMAIL_FROM) missingSecrets.push("AUTH_EMAIL_FROM");
  if (!env.PAYPAL_CLIENT_ID) missingSecrets.push("PAYPAL_CLIENT_ID");
  if (!env.PAYPAL_CLIENT_SECRET) missingSecrets.push("PAYPAL_CLIENT_SECRET");
  if (!env.PAYPAL_WEBHOOK_ID) missingSecrets.push("PAYPAL_WEBHOOK_ID");
  if (String(env.AUDIT_HASH_SALT || "").trim().length < 16) missingSecrets.push("AUDIT_HASH_SALT");

  const coreHealthy = state.assets && checks.d1_query.ok && checks.r2_access.ok && state.paid_builder_ready && missingCoreTables.length === 0;
  const marketingHealthy = state.marketing_ready && missingMarketingTables.length === 0;
  const productionReady = coreHealthy && state.paypal_environment === "live" && !state.payment_test_mode;
  const deepRequested = new URL(request.url).searchParams.get("deep") === "1";
  const external = deepRequested ? await externalDeepChecks(request, env) : null;
  const productionVerified = deepRequested ? Boolean(productionReady && external?.all_ok) : null;
  return json({
    ok: true,
    healthy: coreHealthy,
    production_ready: productionReady,
    production_verified: productionVerified,
    marketing_healthy: marketingHealthy,
    runtime: "runtime-guard-v4",
    configuration: state,
    checks,
    external,
    database: {
      table_count: tables.length,
      expected_tables: expectedCoreTables,
      missing_tables: missingCoreTables,
      expected_marketing_tables: expectedMarketingTables,
      missing_marketing_tables: missingMarketingTables
    },
    missing_secrets: missingSecrets,
    models: {
      analyze: String(env.OPENAI_ANALYZE_MODEL || "gpt-5.6-terra"),
      modify: String(env.OPENAI_MODIFY_MODEL || "gpt-5.6-sol")
    },
    email_from: String(env.AUTH_EMAIL_FROM || ""),
    marketing_email_from: String(env.MARKETING_EMAIL_FROM || env.AUTH_EMAIL_FROM || "")
  }, coreHealthy ? 200 : 503);
}

async function accountSummaryPrecheck(request, env, ctx) {
  const u = new URL(request.url);
  u.pathname = "/api/account/summary";
  u.search = "";
  const headers = new Headers(request.headers);
  const probe = new Request(u.toString(), { method: "GET", headers });
  let response;
  try {
    response = await app.fetch(probe, env, ctx);
  } catch (error) {
    return { status: 503, data: null, error: String(error?.message || error) };
  }
  let data = null;
  try { data = await response.clone().json(); } catch {}
  return { status: response.status, data, error: null };
}

function grantStillUsable(builder) {
  if (!builder || builder.status !== "active") return false;
  if (builder.expires_at && Date.parse(builder.expires_at) <= Date.now()) return false;
  return Number(builder.analyze_remaining || 0) > 0 || Number(builder.modify_remaining || 0) > 0;
}

function indicatorMembershipStillActive(entitlements) {
  return (entitlements || []).some(item => ["indicator_membership", "premium_membership"].includes(item.product_code));
}

async function requestedProduct(request) {
  try { return String((await request.clone().json())?.product_code || "code_workshop_single"); }
  catch { return "code_workshop_single"; }
}

async function guardedCatalog(request, env, ctx) {
  const response = await app.fetch(request, env, ctx);
  if (!response.ok) return response;
  let data;
  try { data = await response.clone().json(); } catch { return response; }
  const state = configState(env);
  if (data?.providers?.paypal) {
    data.providers.paypal.environment = state.paypal_environment;
    data.providers.paypal.launch_ready = state.checkout_ready;
    data.providers.paypal.enabled = Boolean(data.providers.paypal.configured && state.checkout_ready);
    data.providers.paypal.blocked_reason = state.checkout_ready ? null
      : !state.paypal ? "PAYPAL_NOT_CONFIGURED"
      : !state.paid_builder_ready ? "PAID_SERVICE_NOT_READY"
      : state.paypal_environment !== "live" && !state.payment_test_mode ? "PAYPAL_NOT_LIVE"
      : "CHECKOUT_NOT_READY";
  }
  return json(data, response.status);
}

function checkoutNotReady() {
  return json({
    ok: false,
    error: "付费源码处理当前尚未完成全部运行配置，因此暂不创建或发起付款。",
    code: "CHECKOUT_NOT_READY"
  }, 503);
}

async function guardedCreateOrder(request, env, ctx) {
  const state = configState(env);
  const productCode = await requestedProduct(request);
  const ready = productCode === "indicator_membership" ? state.indicator_checkout_ready : state.checkout_ready;
  if (!ready) return checkoutNotReady();

  const precheck = await accountSummaryPrecheck(request, env, ctx);
  if (precheck.status === 401) return app.fetch(request, env, ctx);
  if (precheck.status !== 200 || !precheck.data?.ok) {
    return json({
      ok: false,
      error: "账户权限预检暂时失败。为避免重复订单或错误收费，本次不会创建付款订单，请稍后重试。",
      code: "ACCOUNT_PRECHECK_FAILED"
    }, 503);
  }
  const summary = precheck.data;
  if (productCode === "indicator_membership" && indicatorMembershipStillActive(summary.entitlements)) {
    return json({
      ok: false,
      error: "当前账户已有有效的指标下载权限，无需重复购买。",
      code: "ACTIVE_MEMBERSHIP_REMAINS"
    }, 409);
  }
  if (productCode === "code_workshop_single" && grantStillUsable(summary.builder)) {
    return json({
      ok: false,
      error: "当前账户仍有可用 AI 次数，无需重复购买。",
      code: "ACTIVE_ACCESS_REMAINS",
      builder: {
        analyze_remaining: Number(summary.builder.analyze_remaining || 0),
        modify_remaining: Number(summary.builder.modify_remaining || 0),
        expires_at: summary.builder.expires_at || null
      }
    }, 409);
  }
  return app.fetch(request, env, ctx);
}

async function guardedPayPalCreate(request, env, ctx) {
  if (!configState(env).checkout_ready) return checkoutNotReady();
  return app.fetch(request, env, ctx);
}

async function guardedPayPalCapture(request, env, ctx) {
  const state = configState(env);
  if (!state.paid_builder_ready && !state.indicator_checkout_ready) {
    return json({
      ok: false,
      error: "付款确认前检测到数字服务履约环境未就绪。本次不会执行 PayPal Capture，请稍后重试。",
      code: "FULFILLMENT_NOT_READY_BEFORE_CAPTURE"
    }, 503);
  }
  return app.fetch(request, env, ctx);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") return publicHealth(env);
    if (url.pathname === "/api/admin/runtime-health" && request.method === "GET") return adminHealth(request, env);
    if (url.pathname === "/api/payments/catalog" && request.method === "GET") return guardedCatalog(request, env, ctx);
    if (url.pathname === "/api/orders/create" && request.method === "POST") return guardedCreateOrder(request, env, ctx);
    if (url.pathname === "/api/payment/paypal/create" && request.method === "POST") return guardedPayPalCreate(request, env, ctx);
    if (url.pathname === "/api/payment/paypal/capture" && request.method === "POST") return guardedPayPalCapture(request, env, ctx);
    return app.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === "function") return app.scheduled(controller, env, ctx);
  }
};
