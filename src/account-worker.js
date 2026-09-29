import app from "./final-worker.js";

const SESSION_COOKIE = "t5_session";
const SESSION_DAYS = 30;
const CODE_TTL_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 6;

function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders
  });
  return Response.json(data, { status, headers });
}

function nowIso() { return new Date().toISOString(); }
function addMinutesIso(n) { return new Date(Date.now() + n * 60000).toISOString(); }
function addDaysIso(n) { return new Date(Date.now() + n * 86400000).toISOString(); }

function randomHex(bytes = 24) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return Array.from(data, b => b.toString(16).padStart(2, "0")).join("");
}

function randomId(prefix) { return `${prefix}-${randomHex(10)}`; }

function randomCode() {
  const data = new Uint32Array(1);
  crypto.getRandomValues(data);
  return String(data[0] % 1000000).padStart(6, "0");
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, value) {
  if (!secret) throw new Error("ACCOUNT_AUTH_SECRET_NOT_CONFIGURED");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, "0")).join("");
}

async function constantTimeEqual(a, b) {
  const [x, y] = await Promise.all([sha256Hex(String(a || "")), sha256Hex(String(b || ""))]);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
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

function sessionCookie(token, maxAge = SESSION_DAYS * 86400) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

async function ensureAccountDb(env) {
  if (!env.BUILDER_DB) throw new Error("BUILDER_DB_NOT_CONFIGURED");
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      email_verified_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      marketing_consent INTEGER NOT NULL DEFAULT 0,
      marketing_consent_at TEXT,
      marketing_source TEXT,
      unsubscribed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS auth_challenges (
      challenge_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      ip_hash TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      consumed_at TEXT,
      created_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_challenges_email_created ON auth_challenges(email, created_at)`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      ip_hash TEXT,
      user_agent TEXT
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id)`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS marketing_consent_events (
      event_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      consent INTEGER NOT NULL,
      source TEXT NOT NULL,
      ip_hash TEXT,
      created_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_marketing_consent_user ON marketing_consent_events(user_id, created_at)`)
  ]);
}

async function ordersTableExists(env) {
  const row = await env.BUILDER_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='orders'").first();
  return Boolean(row?.name);
}

async function ensureOrderUserColumn(env) {
  if (!(await ordersTableExists(env))) return false;
  const info = await env.BUILDER_DB.prepare("PRAGMA table_info(orders)").all();
  const has = (info?.results || []).some(x => x.name === "user_id");
  if (!has) {
    try { await env.BUILDER_DB.prepare("ALTER TABLE orders ADD COLUMN user_id TEXT").run(); }
    catch (error) {
      if (!String(error?.message || error).toLowerCase().includes("duplicate")) throw error;
    }
  }
  await env.BUILDER_DB.prepare("CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)").run();
  return true;
}

function authConfigured(env) {
  return Boolean(env.RESEND_API_KEY && env.AUTH_EMAIL_FROM && env.ACCOUNT_AUTH_SECRET);
}

async function ipHash(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  return hmacHex(env.ACCOUNT_AUTH_SECRET, `ip:${ip}`);
}

async function sendLoginCode(env, email, code, challengeId) {
  if (!authConfigured(env)) throw new Error("EMAIL_AUTH_NOT_CONFIGURED");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `t5-login-${challengeId}`
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: [email],
      subject: "T5 Quant Lab 登录验证码",
      text: `你的 T5 Quant Lab 登录验证码是：${code}\n\n验证码 ${CODE_TTL_MINUTES} 分钟内有效。如果不是你本人操作，请忽略此邮件。`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#102033"><h2>T5 Quant Lab</h2><p>你的登录验证码：</p><div style="font-size:34px;font-weight:800;letter-spacing:8px;margin:18px 0">${code}</div><p>验证码 ${CODE_TTL_MINUTES} 分钟内有效。</p><p style="color:#66788a;font-size:13px">如果不是你本人操作，请忽略此邮件。</p></div>`
    })
  });
  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const err = new Error(data?.message || data?.name || `RESEND_HTTP_${response.status}`);
    err.status = response.status;
    throw err;
  }
  return data;
}

async function requestCode(request, env) {
  if (!authConfigured(env)) {
    return json({ ok: false, error: "邮箱登录服务尚未完成配置。需要 RESEND_API_KEY、AUTH_EMAIL_FROM 和 ACCOUNT_AUTH_SECRET。", code: "EMAIL_AUTH_NOT_CONFIGURED" }, 503);
  }
  await ensureAccountDb(env);
  let body = {};
  try { body = await request.json(); } catch {}
  const email = normalizeEmail(body.email);
  if (!email) return json({ ok: false, error: "请输入有效邮箱", code: "INVALID_EMAIL" }, 400);
  const ip = await ipHash(request, env);
  const since = new Date(Date.now() - 15 * 60000).toISOString();
  const [emailCount, ipCount] = await Promise.all([
    env.BUILDER_DB.prepare("SELECT COUNT(*) AS n FROM auth_challenges WHERE email = ? AND created_at > ?").bind(email, since).first(),
    env.BUILDER_DB.prepare("SELECT COUNT(*) AS n FROM auth_challenges WHERE ip_hash = ? AND created_at > ?").bind(ip, since).first()
  ]);
  if (Number(emailCount?.n || 0) >= 5 || Number(ipCount?.n || 0) >= 12) return json({ ok: false, error: "验证码请求过于频繁，请稍后再试。", code: "AUTH_RATE_LIMIT" }, 429);
  const challengeId = randomId("AUTH");
  const code = randomCode();
  const codeHash = await hmacHex(env.ACCOUNT_AUTH_SECRET, `code:${challengeId}:${code}`);
  const created = nowIso();
  await env.BUILDER_DB.prepare(`INSERT INTO auth_challenges (challenge_id, email, code_hash, ip_hash, attempts, expires_at, created_at) VALUES (?, ?, ?, ?, 0, ?, ?)`)
    .bind(challengeId, email, codeHash, ip, addMinutesIso(CODE_TTL_MINUTES), created).run();
  try { await sendLoginCode(env, email, code, challengeId); }
  catch (error) {
    await env.BUILDER_DB.prepare("DELETE FROM auth_challenges WHERE challenge_id = ?").bind(challengeId).run();
    console.error("T5 login email send failed", error);
    return json({ ok: false, error: "验证码邮件发送失败，请稍后再试。", code: "EMAIL_SEND_FAILED" }, 502);
  }
  return json({ ok: true, challenge_id: challengeId, expires_in_seconds: CODE_TTL_MINUTES * 60 });
}

async function createOrUpdateUser(env, email, marketingOptIn, request) {
  const now = nowIso();
  const candidateId = randomId("USR");
  await env.BUILDER_DB.prepare(`INSERT INTO users
    (user_id, email, email_verified_at, status, marketing_consent, created_at, updated_at, last_login_at)
    VALUES (?, ?, ?, 'active', 0, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET email_verified_at = COALESCE(users.email_verified_at, excluded.email_verified_at), updated_at = excluded.updated_at, last_login_at = excluded.last_login_at`)
    .bind(candidateId, email, now, now, now, now).run();
  let user = await env.BUILDER_DB.prepare(`SELECT user_id, email, status, marketing_consent, marketing_consent_at, marketing_source, unsubscribed_at, created_at, last_login_at FROM users WHERE email = ?`).bind(email).first();
  if (!user) throw new Error("USER_CREATE_FAILED");
  if (marketingOptIn === true && Number(user.marketing_consent || 0) !== 1) {
    const ip = await ipHash(request, env);
    await env.BUILDER_DB.batch([
      env.BUILDER_DB.prepare(`UPDATE users SET marketing_consent = 1, marketing_consent_at = ?, marketing_source = 'login', unsubscribed_at = NULL, updated_at = ? WHERE user_id = ?`).bind(now, now, user.user_id),
      env.BUILDER_DB.prepare(`INSERT INTO marketing_consent_events (event_id, user_id, consent, source, ip_hash, created_at) VALUES (?, ?, 1, 'login', ?, ?)`).bind(randomId("MKT"), user.user_id, ip, now)
    ]);
    user = await env.BUILDER_DB.prepare(`SELECT user_id, email, status, marketing_consent, marketing_consent_at, marketing_source, unsubscribed_at, created_at, last_login_at FROM users WHERE user_id = ?`).bind(user.user_id).first();
  }
  return user;
}

async function verifyCode(request, env) {
  if (!authConfigured(env)) return json({ ok: false, error: "邮箱登录服务尚未配置。", code: "EMAIL_AUTH_NOT_CONFIGURED" }, 503);
  await ensureAccountDb(env);
  let body = {}; try { body = await request.json(); } catch {}
  const email = normalizeEmail(body.email), challengeId = String(body.challenge_id || "").trim(), code = String(body.code || "").trim();
  if (!email || !challengeId || !/^\d{6}$/.test(code)) return json({ ok: false, error: "验证码信息不完整", code: "INVALID_AUTH_INPUT" }, 400);
  const challenge = await env.BUILDER_DB.prepare(`SELECT challenge_id, email, code_hash, attempts, expires_at, consumed_at FROM auth_challenges WHERE challenge_id = ? AND email = ?`).bind(challengeId, email).first();
  if (!challenge || challenge.consumed_at || Date.parse(challenge.expires_at) <= Date.now()) return json({ ok: false, error: "验证码已失效，请重新获取。", code: "AUTH_CHALLENGE_EXPIRED" }, 400);
  if (Number(challenge.attempts || 0) >= MAX_CODE_ATTEMPTS) return json({ ok: false, error: "验证码尝试次数过多，请重新获取。", code: "AUTH_TOO_MANY_ATTEMPTS" }, 429);
  const suppliedHash = await hmacHex(env.ACCOUNT_AUTH_SECRET, `code:${challengeId}:${code}`);
  if (!(await constantTimeEqual(challenge.code_hash, suppliedHash))) {
    await env.BUILDER_DB.prepare("UPDATE auth_challenges SET attempts = attempts + 1 WHERE challenge_id = ?").bind(challengeId).run();
    return json({ ok: false, error: "验证码不正确", code: "AUTH_CODE_INVALID" }, 400);
  }
  const now = nowIso();
  await env.BUILDER_DB.prepare("UPDATE auth_challenges SET consumed_at = ? WHERE challenge_id = ? AND consumed_at IS NULL").bind(now, challengeId).run();
  const user = await createOrUpdateUser(env, email, body.marketing_opt_in === true, request);
  if (user.status !== "active") return json({ ok: false, error: "账户当前不可用", code: "ACCOUNT_DISABLED" }, 403);
  const token = randomHex(32), tokenHash = await sha256Hex(token), ip = await ipHash(request, env);
  await env.BUILDER_DB.prepare(`INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(tokenHash, user.user_id, now, addDaysIso(SESSION_DAYS), ip, (request.headers.get("User-Agent") || "").slice(0, 500)).run();
  return json({ ok: true, authenticated: true, user: { user_id: user.user_id, email: user.email, marketing_consent: Number(user.marketing_consent || 0) === 1 } }, 200, { "Set-Cookie": sessionCookie(token) });
}

async function resolveSession(request, env) {
  const token = parseCookies(request)[SESSION_COOKIE] || "";
  if (!token || !env.BUILDER_DB) return null;
  await ensureAccountDb(env);
  const tokenHash = await sha256Hex(token), now = nowIso();
  return env.BUILDER_DB.prepare(`SELECT u.user_id, u.email, u.status, u.marketing_consent, u.marketing_consent_at, u.marketing_source, u.unsubscribed_at, u.created_at, u.last_login_at, s.token_hash AS session_token_hash, s.expires_at AS session_expires_at
    FROM auth_sessions s JOIN users u ON u.user_id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ? AND u.status = 'active'`).bind(tokenHash, now).first();
}

async function me(request, env) {
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: true, authenticated: false });
  return json({ ok: true, authenticated: true, user: { user_id: user.user_id, email: user.email, marketing_consent: Number(user.marketing_consent || 0) === 1, created_at: user.created_at, last_login_at: user.last_login_at } });
}

async function logout(request, env) {
  const user = await resolveSession(request, env);
  if (user?.session_token_hash) await env.BUILDER_DB.prepare("UPDATE auth_sessions SET revoked_at = ? WHERE token_hash = ?").bind(nowIso(), user.session_token_hash).run();
  return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
}

async function updateMarketing(request, env) {
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: false, error: "请先登录", code: "ACCOUNT_REQUIRED" }, 401);
  let body = {}; try { body = await request.json(); } catch {}
  if (typeof body.subscribed !== "boolean") return json({ ok: false, error: "缺少 subscribed", code: "INVALID_INPUT" }, 400);
  const now = nowIso(), ip = await ipHash(request, env), subscribed = body.subscribed;
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`UPDATE users SET marketing_consent = ?, marketing_consent_at = ?, marketing_source = 'account', unsubscribed_at = ?, updated_at = ? WHERE user_id = ?`).bind(subscribed ? 1 : 0, subscribed ? now : user.marketing_consent_at, subscribed ? null : now, now, user.user_id),
    env.BUILDER_DB.prepare(`INSERT INTO marketing_consent_events (event_id, user_id, consent, source, ip_hash, created_at) VALUES (?, ?, ?, 'account', ?, ?)`).bind(randomId("MKT"), user.user_id, subscribed ? 1 : 0, ip, now)
  ]);
  return json({ ok: true, subscribed });
}

async function accountSummary(request, env) {
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: false, error: "请先登录", code: "ACCOUNT_REQUIRED" }, 401);
  await ensureOrderUserColumn(env);
  let orders = [], grant = null;
  if (await ordersTableExists(env)) {
    const result = await env.BUILDER_DB.prepare(`SELECT order_id, product_code, product_name, amount_minor, currency, status, grant_id, created_at, paid_at, granted_at, updated_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`).bind(user.user_id).all();
    orders = result?.results || [];
    const grantsTable = await env.BUILDER_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='builder_access_grants'").first();
    if (grantsTable?.name) {
      grant = await env.BUILDER_DB.prepare(`SELECT g.grant_id, g.plan, g.status, g.analyze_remaining, g.modify_remaining, g.expires_at, o.order_id, o.granted_at
        FROM orders o JOIN builder_access_grants g ON g.grant_id = o.grant_id WHERE o.user_id = ? AND o.status = 'granted' AND g.status = 'active' AND (g.expires_at IS NULL OR g.expires_at > ?) ORDER BY o.granted_at DESC LIMIT 1`).bind(user.user_id, nowIso()).first();
    }
  }
  return json({ ok: true, user: { user_id: user.user_id, email: user.email, marketing_consent: Number(user.marketing_consent || 0) === 1, created_at: user.created_at, last_login_at: user.last_login_at }, builder: grant || null, orders });
}

async function adminAccounts(request, env) {
  try {
    const supplied = request.headers.get("X-Builder-Access-Key") || "";
    if (!env.BUILDER_ACCESS_KEY || !(await constantTimeEqual(env.BUILDER_ACCESS_KEY, supplied))) return json({ ok: false, error: "Unauthorized" }, 403);
    await ensureAccountDb(env);
    const hasOrders = await ordersTableExists(env);
    if (hasOrders) await ensureOrderUserColumn(env);
    const sql = hasOrders
      ? `SELECT u.user_id, u.email, u.marketing_consent, u.marketing_consent_at, u.unsubscribed_at, u.created_at, u.last_login_at,
          (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.user_id AND o.status = 'granted') AS paid_orders
        FROM users u ORDER BY u.created_at DESC LIMIT 500`
      : `SELECT u.user_id, u.email, u.marketing_consent, u.marketing_consent_at, u.unsubscribed_at, u.created_at, u.last_login_at,
          0 AS paid_orders FROM users u ORDER BY u.created_at DESC LIMIT 500`;
    const result = await env.BUILDER_DB.prepare(sql).all();
    return json({ ok: true, users: result?.results || [] });
  } catch (error) {
    console.error("T5 admin accounts failed", error);
    return json({ ok: false, error: "后台读取失败", code: "ADMIN_ACCOUNTS_FAILED", detail: String(error?.message || error).slice(0, 300) }, 500);
  }
}

async function signedUnsubscribeToken(env, userId) { return hmacHex(env.ACCOUNT_AUTH_SECRET, `unsubscribe:${userId}`); }
async function unsubscribe(request, env) {
  if (!env.ACCOUNT_AUTH_SECRET) return json({ ok: false, error: "退订服务尚未配置", code: "ACCOUNT_AUTH_NOT_CONFIGURED" }, 503);
  await ensureAccountDb(env);
  let body = {}; try { body = await request.json(); } catch {}
  const userId = String(body.user_id || "").trim(), token = String(body.token || "").trim();
  if (!userId || !token) return json({ ok: false, error: "退订链接无效", code: "INVALID_UNSUBSCRIBE_LINK" }, 400);
  const expected = await signedUnsubscribeToken(env, userId);
  if (!(await constantTimeEqual(expected, token))) return json({ ok: false, error: "退订链接无效", code: "INVALID_UNSUBSCRIBE_LINK" }, 403);
  const now = nowIso();
  const result = await env.BUILDER_DB.prepare(`UPDATE users SET marketing_consent = 0, unsubscribed_at = ?, updated_at = ? WHERE user_id = ?`).bind(now, now, userId).run();
  if (Number(result?.meta?.changes || 0) !== 1) return json({ ok: false, error: "账户不存在", code: "USER_NOT_FOUND" }, 404);
  await env.BUILDER_DB.prepare(`INSERT INTO marketing_consent_events (event_id, user_id, consent, source, ip_hash, created_at) VALUES (?, ?, 0, 'email_unsubscribe', NULL, ?)`).bind(randomId("MKT"), userId, now).run();
  return json({ ok: true, unsubscribed: true });
}

async function bindOrderToAccount(request, env, ctx) {
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: false, error: "购买 Builder Pass 前请先使用邮箱登录。", code: "ACCOUNT_REQUIRED" }, 401);
  let body = {}; try { body = await request.clone().json(); } catch {}
  body.email = user.email;
  const headers = new Headers(request.headers); headers.set("Content-Type", "application/json");
  const forwarded = new Request(request.url, { method: request.method, headers, body: JSON.stringify(body) });
  const response = await app.fetch(forwarded, env, ctx);
  if (!response.ok) return response;
  let payload = null; try { payload = await response.clone().json(); } catch {}
  const orderId = payload?.order?.order_id || "";
  if (orderId) {
    await ensureOrderUserColumn(env);
    await env.BUILDER_DB.prepare("UPDATE orders SET user_id = ?, customer_email = ?, updated_at = ? WHERE order_id = ?").bind(user.user_id, user.email, nowIso(), orderId).run();
  }
  const outHeaders = new Headers(response.headers); outHeaders.delete("Set-Cookie");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: outHeaders });
}

async function forwardOwnedOrderAction(request, env, ctx) {
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: false, error: "请先登录", code: "ACCOUNT_REQUIRED" }, 401);
  await ensureAccountDb(env);
  if (!(await ensureOrderUserColumn(env))) return json({ ok: false, error: "订单系统尚未初始化", code: "ORDER_SYSTEM_NOT_READY" }, 503);

  let orderId = new URL(request.url).searchParams.get("order_id") || "";
  if (!orderId && request.method !== "GET") {
    try {
      const body = await request.clone().json();
      orderId = String(body?.order_id || "").trim();
    } catch {}
  }
  if (!orderId) return json({ ok: false, error: "缺少订单号", code: "ORDER_ID_REQUIRED" }, 400);

  let order = await env.BUILDER_DB.prepare("SELECT order_id, user_id, customer_email FROM orders WHERE order_id = ?").bind(orderId).first();
  if (!order) return json({ ok: false, error: "订单不存在", code: "ORDER_NOT_FOUND" }, 404);

  // Compatibility for legacy account-era orders created before user_id was populated:
  // only the same verified T5 email may claim an unowned order, and only once.
  if (!order.user_id && normalizeEmail(order.customer_email) === user.email) {
    await env.BUILDER_DB.prepare("UPDATE orders SET user_id = ?, updated_at = ? WHERE order_id = ? AND user_id IS NULL")
      .bind(user.user_id, nowIso(), orderId).run();
    order = await env.BUILDER_DB.prepare("SELECT order_id, user_id, customer_email FROM orders WHERE order_id = ?").bind(orderId).first();
  }

  if (order.user_id !== user.user_id) {
    return json({ ok: false, error: "该订单不属于当前 T5 账户", code: "ORDER_ACCOUNT_MISMATCH" }, 403);
  }
  return app.fetch(request, env, ctx);
}

async function activeGrantForUser(env, userId) {
  if (!(await ordersTableExists(env))) return null;
  await ensureOrderUserColumn(env);
  const grantsTable = await env.BUILDER_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='builder_access_grants'").first();
  if (!grantsTable?.name) return null;
  return env.BUILDER_DB.prepare(`SELECT g.grant_id, g.token_hash, g.plan, g.status, g.analyze_remaining, g.modify_remaining, g.expires_at, o.order_id FROM orders o JOIN builder_access_grants g ON g.grant_id = o.grant_id WHERE o.user_id = ? AND o.status = 'granted' AND g.status = 'active' AND (g.expires_at IS NULL OR g.expires_at > ?) ORDER BY o.granted_at DESC LIMIT 1`).bind(userId, nowIso()).first();
}

async function bridgeBuilderAccess(request, env, ctx) {
  const user = await resolveSession(request, env);
  if (!user) return app.fetch(request, env, ctx);
  const grant = await activeGrantForUser(env, user.user_id);
  if (!grant) return app.fetch(request, env, ctx);
  const derivedToken = await hmacHex(env.ACCOUNT_AUTH_SECRET, `grant:${user.user_id}:${grant.grant_id}`), derivedHash = await sha256Hex(derivedToken);
  if (grant.token_hash !== derivedHash) {
    await env.BUILDER_DB.batch([
      env.BUILDER_DB.prepare("UPDATE builder_access_grants SET token_hash = ?, updated_at = ? WHERE grant_id = ?").bind(derivedHash, nowIso(), grant.grant_id),
      env.BUILDER_DB.prepare("UPDATE orders SET builder_token_hash = ?, updated_at = ? WHERE order_id = ?").bind(derivedHash, nowIso(), grant.order_id)
    ]);
  }
  const headers = new Headers(request.headers); headers.set("X-Builder-Access-Token", derivedToken);
  return app.fetch(new Request(request, { headers }), env, ctx);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url), p = url.pathname;
      if (p === "/api/auth/config" && request.method === "GET") return json({ ok: true, email_login_ready: authConfigured(env), provider: "resend" });
      if (p === "/api/auth/request-code" && request.method === "POST") return requestCode(request, env);
      if (p === "/api/auth/verify-code" && request.method === "POST") return verifyCode(request, env);
      if (p === "/api/auth/me" && request.method === "GET") return me(request, env);
      if (p === "/api/auth/logout" && request.method === "POST") return logout(request, env);
      if (p === "/api/account/summary" && request.method === "GET") return accountSummary(request, env);
      if (p === "/api/account/marketing" && request.method === "POST") return updateMarketing(request, env);
      if (p === "/api/admin/accounts" && request.method === "GET") return adminAccounts(request, env);
      if (p === "/api/marketing/unsubscribe" && request.method === "POST") return unsubscribe(request, env);
      if (p === "/api/orders/create" && request.method === "POST") return bindOrderToAccount(request, env, ctx);
      if (p === "/api/orders/status" && request.method === "GET") return forwardOwnedOrderAction(request, env, ctx);
      if (p === "/api/orders/cancel" && request.method === "POST") return forwardOwnedOrderAction(request, env, ctx);
      if (p === "/api/orders/refund-eligibility" && request.method === "GET") return forwardOwnedOrderAction(request, env, ctx);
      if (p === "/api/payment/paypal/create" && request.method === "POST") return forwardOwnedOrderAction(request, env, ctx);
      if (p === "/api/payment/paypal/capture" && request.method === "POST") return forwardOwnedOrderAction(request, env, ctx);
      if (p.startsWith("/api/builder/")) return bridgeBuilderAccess(request, env, ctx);
      return app.fetch(request, env, ctx);
    } catch (error) {
      console.error("T5 account worker uncaught error", error);
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) return json({ ok: false, error: "服务器内部错误", code: "ACCOUNT_WORKER_ERROR", detail: String(error?.message || error).slice(0, 300) }, 500);
      throw error;
    }
  }
};