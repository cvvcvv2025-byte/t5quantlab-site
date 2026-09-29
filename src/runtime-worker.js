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
  const paypal = Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID);
  const auditSalt = Boolean(env.AUDIT_HASH_SALT);
  const accountReady = d1 && accountSecret && resend;
  const paidBuilderReady = d1 && r2 && openai && accountReady && paypal && auditSalt;
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
    free_source_inspector_ready: true,
    paypal_environment: String(env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase() === "live" ? "live" : "sandbox"
  };
}

async function publicHealth(env) {
  const state = configState(env);
  return json({
    ok: true,
    service: "t5quantlab",
    runtime: "runtime-guard-v1",
    public_site_ready: state.assets,
    free_source_inspector_ready: state.free_source_inspector_ready,
    account_ready: state.account_ready,
    paid_builder_ready: state.paid_builder_ready,
    payment_environment: state.paypal_environment
  });
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

  const expectedTables = [
    "users", "auth_challenges", "auth_sessions", "orders", "builder_access_grants",
    "projects", "jobs", "versions", "payment_intents", "payment_events",
    "order_terms", "entitlement_adjustments", "service_events", "payment_disputes"
  ];
  const missingTables = expectedTables.filter(name => !tables.includes(name));
  const missingSecrets = [];
  if (!env.OPENAI_API_KEY) missingSecrets.push("OPENAI_API_KEY");
  if (!env.ACCOUNT_AUTH_SECRET) missingSecrets.push("ACCOUNT_AUTH_SECRET");
  if (!env.RESEND_API_KEY) missingSecrets.push("RESEND_API_KEY");
  if (!env.PAYPAL_CLIENT_ID) missingSecrets.push("PAYPAL_CLIENT_ID");
  if (!env.PAYPAL_CLIENT_SECRET) missingSecrets.push("PAYPAL_CLIENT_SECRET");
  if (!env.PAYPAL_WEBHOOK_ID) missingSecrets.push("PAYPAL_WEBHOOK_ID");
  if (!env.AUDIT_HASH_SALT) missingSecrets.push("AUDIT_HASH_SALT");

  const healthy = state.assets && checks.d1_query.ok && checks.r2_access.ok && state.paid_builder_ready && missingTables.length === 0;
  return json({
    ok: true,
    healthy,
    runtime: "runtime-guard-v1",
    configuration: state,
    checks,
    database: {
      table_count: tables.length,
      expected_tables: expectedTables,
      missing_tables: missingTables
    },
    missing_secrets: missingSecrets,
    models: {
      analyze: String(env.OPENAI_ANALYZE_MODEL || "gpt-5.6-terra"),
      modify: String(env.OPENAI_MODIFY_MODEL || "gpt-5.6-terra")
    },
    email_from: String(env.AUTH_EMAIL_FROM || ""),
    marketing_email_from: String(env.MARKETING_EMAIL_FROM || env.AUTH_EMAIL_FROM || "")
  }, healthy ? 200 : 503);
}

async function accountSummary(request, env, ctx) {
  const u = new URL(request.url);
  u.pathname = "/api/account/summary";
  u.search = "";
  const headers = new Headers(request.headers);
  const probe = new Request(u.toString(), { method: "GET", headers });
  const response = await app.fetch(probe, env, ctx);
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
}

function grantStillUsable(builder) {
  if (!builder || builder.status !== "active") return false;
  if (builder.expires_at && Date.parse(builder.expires_at) <= Date.now()) return false;
  return Number(builder.analyze_remaining || 0) > 0 || Number(builder.modify_remaining || 0) > 0;
}

async function guardedCreateOrder(request, env, ctx) {
  const summary = await accountSummary(request, env, ctx);
  if (grantStillUsable(summary?.builder)) {
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") return publicHealth(env);
    if (url.pathname === "/api/admin/runtime-health" && request.method === "GET") return adminHealth(request, env);
    if (url.pathname === "/api/orders/create" && request.method === "POST") return guardedCreateOrder(request, env, ctx);
    return app.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    if (typeof app.scheduled === "function") return app.scheduled(controller, env, ctx);
  }
};
