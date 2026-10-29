import {signingKeyAdmin,signingPublicKey,signedLeaseResponse,ownerProfileResponse,installProfileResponse} from './signed-runtime-license.js';
import {boundInstallPackage} from './install-package.js';
import app from "./final-worker.js";
import { TRAINING_TERMS } from './training-product.js';
import { trainingResponse, TRAINING_CONTENT_KEY } from './training-worker.js';
import { runtimeLicenseResponse, adminRuntimeLicenseQa } from './runtime-license.js';

const SESSION_COOKIE = "t5_session";
const SESSION_DAYS = 30;
const CODE_TTL_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 6;
const INDICATOR_PERFORMANCE_AUDIT = { qualified: false, report: "/verification/indicator-audit-2026-10-23/", date: "2026-10-23" };
const INDICATOR_ARTIFACTS = {
  "mtf-structure-panel-mt5": {
    "membershipRequired": false,
    "code": "mtf_structure_panel_mt4",
    "releaseStatus": "awaiting_upload",
    "maxBytes": 1048576,
    "version": "0.1.1-display.1-license.3",
    "filename": "T5_mtf_structure_panel_mt5_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/mtf-structure-panel-mt5/0.1.1-display.1-license.3/T5_mtf_structure_panel_mt5_LicenseV3_Customer_Pack.zip",
    "sha256": "77818578ebfbc3f870d1fd2074f55dc00d0cf7692a280805194bb53f4f63d63f",
    "license_product": "mtf_structure_panel_mt4",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367"
  },
  "neckline-mtf-mt5": {
    "membershipRequired": false,
    "code": "neckline_mtf_mt4",
    "releaseStatus": "awaiting_upload",
    "maxBytes": 1048576,
    "version": "0.1.2-display.1-license.3",
    "filename": "T5_neckline_mtf_mt5_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/neckline-mtf-mt5/0.1.2-display.1-license.3/T5_neckline_mtf_mt5_LicenseV3_Customer_Pack.zip",
    "sha256": "71e7e0d424ca8939215998a7338f2d38a6f92d636ff7d47157c3ce371386b738",
    "license_product": "neckline_mtf_mt4",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367"
  },
  "progress-candle-mt5": {
    "membershipRequired": false,
    "code": "progress_candle_mt4",
    "releaseStatus": "awaiting_upload",
    "maxBytes": 1048576,
    "version": "0.1.2-display.1-license.3",
    "filename": "T5_progress_candle_mt5_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/progress-candle-mt5/0.1.2-display.1-license.3/T5_progress_candle_mt5_LicenseV3_Customer_Pack.zip",
    "sha256": "8d52e157f304a05651c2a88e2c67473680dde164570e535d93e9bc422dbe86e4",
    "license_product": "progress_candle_mt4",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367"
  },
  "mtf-structure-panel": {
    "code": "mtf_structure_panel_mt4",
    "maxBytes": 1048576,
    "version": "0.1.1-license.3",
    "filename": "T5_mtf_structure_panel_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/mtf-structure-panel/0.1.1-license.3/T5_mtf_structure_panel_LicenseV3_Customer_Pack.zip",
    "sha256": "780f39d9da869d61b8dce6e6b1d439b111435137f22151d10c231def92eab88c",
    "license_product": "mtf_structure_panel_mt4",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367",
    "releaseStatus": "awaiting_upload"
  },
  "neckline-mtf": {
    "code": "neckline_mtf_mt4",
    "maxBytes": 1048576,
    "version": "0.1.2-license.3",
    "filename": "T5_neckline_mtf_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/neckline-mtf/0.1.2-license.3/T5_neckline_mtf_LicenseV3_Customer_Pack.zip",
    "sha256": "bc8b4620630a05a1982396caa27471b84816e0ac9255b2bfb559f5088a4f10c8",
    "license_product": "neckline_mtf_mt4",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367",
    "releaseStatus": "awaiting_upload"
  },
  "progress-candle": {
    "code": "progress_candle_mt4",
    "maxBytes": 1048576,
    "version": "0.1.2-license.3",
    "filename": "T5_progress_candle_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/progress-candle/0.1.2-license.3/T5_progress_candle_LicenseV3_Customer_Pack.zip",
    "sha256": "39246be933880c47daa840af23f7733146cb537b24714f233d326934243e58b6",
    "license_product": "progress_candle_mt4",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367",
    "releaseStatus": "awaiting_upload"
  },
  "structure-decision-map-mt5": {
    "membershipRequired": false,
    "code": "structure_decision_map_mt4",
    "releaseStatus": "awaiting_upload",
    "maxBytes": 1048576,
    "version": "0.3.0-license.3",
    "filename": "T5_structure_decision_map_mt5_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/structure-decision-map-mt5/0.3.0-license.3/T5_structure_decision_map_mt5_LicenseV3_Customer_Pack.zip",
    "sha256": "99fc491d22c9000e8a85a8c973ddc153de945b37972224b752fecdecc3ba2bdd",
    "license_product": "structure_decision_map_mt4",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367"
  },
  "structure-decision-map": {
    "membershipRequired": true,
    "code": "structure_decision_map_mt4",
    "releaseStatus": "awaiting_upload",
    "maxBytes": 1048576,
    "version": "0.3.0-license.3",
    "filename": "T5_structure_decision_map_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/structure-decision-map/0.3.0-license.3/T5_structure_decision_map_LicenseV3_Customer_Pack.zip",
    "sha256": "bc83b63c2987644e6c5ec61894920807ac288533c502c7f3f3293a73e1f5a7e1",
    "license_product": "structure_decision_map_mt4",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367"
  }
};
const INDICATOR_MEMBERSHIP_PRODUCTS = ["indicator_membership", "premium_membership"];
const INDICATOR_PRODUCT_CODES = [...INDICATOR_MEMBERSHIP_PRODUCTS, ...Object.values(INDICATOR_ARTIFACTS).map(item => item.code)];
const EA_ARTIFACTS = {
  "trend-capture": {
    "license_product": "trend_capture_mt5_v3",
    "code": "trend_capture_mt5",
    "releaseStatus": "awaiting_upload",
    "maxBytes": 2097152,
    "version": "0.1.0-license.3",
    "filename": "T5_trend_capture_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/ea/trend-capture/0.1.0-license.3/T5_trend_capture_LicenseV3_Customer_Pack.zip",
    "sha256": "30bed5655073e725706d4582fdd695d29591a8fc9a150ade2d6e6960c5de2940",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367"
  },
  "attack-completion-c": {
    "license_product": "attack_completion_c_mt5_v3",
    "code": "attack_completion_c_mt5",
    "releaseStatus": "awaiting_upload",
    "maxBytes": 2097152,
    "version": "6.10.8-license.3",
    "filename": "T5_attack_completion_c_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/ea/attack-completion-c/6.10.8-license.3/T5_attack_completion_c_LicenseV3_Customer_Pack.zip",
    "sha256": "cb0a6f5d3633e0ef2960833d65a4a23a05bbca2e1eb7237c7b239ee95c2150e5",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367"
  },
  "range-martingale": {
    "license_product": "range_martingale_mt4_v3",
    "code": "range_martingale_mt4",
    "releaseStatus": "awaiting_upload",
    "maxBytes": 2097152,
    "version": "0.3.4-license.3",
    "filename": "T5_range_martingale_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/ea/range-martingale/0.3.4-license.3/T5_range_martingale_LicenseV3_Customer_Pack.zip",
    "sha256": "b1e62f026d9cf0564c97981a2801f529ae918d40e996777f694f74825dc1b0b3",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367"
  },
  "range-aggressive": {
    "license_product": "range_aggressive_mt4_mt5_v3",
    "code": "range_aggressive_mt4_mt5",
    "releaseStatus": "awaiting_upload",
    "maxBytes": 2097152,
    "version": "0.3.6-license.3",
    "filename": "T5_range_aggressive_LicenseV3_Customer_Pack.zip",
    "r2Key": "member-artifacts/ea/range-aggressive/0.3.6-license.3/T5_range_aggressive_LicenseV3_Customer_Pack.zip",
    "sha256": "f6bd510c57800c5e01f3e1d19d3af43aeb95e7167cff7e767ef4205ea3d63fab",
    "runtime_client_version": 3,
    "runtime_signing_key_id": "c93c6e5e8bce9367"
  }
};
const EA_MEMBERSHIP_PRODUCTS = ["premium_membership"];
const EA_PRODUCT_CODES = [...EA_MEMBERSHIP_PRODUCTS, ...Object.values(EA_ARTIFACTS).map(item => item.code)];
const MEMBER_PRODUCT_CODES = [...new Set([...INDICATOR_PRODUCT_CODES, ...EA_PRODUCT_CODES])];

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

async function sha256BytesHex(value) {
  const digest = await crypto.subtle.digest("SHA-256", value);
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
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS product_entitlements (
      entitlement_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      product_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TEXT NOT NULL,
      expires_at TEXT,
      source TEXT NOT NULL,
      source_order_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, product_code)
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_product_entitlements_user_status ON product_entitlements(user_id, status, expires_at)`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS member_download_events (
      event_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      entitlement_id TEXT NOT NULL,
      source_order_id TEXT,
      artifact_code TEXT NOT NULL,
      artifact_version TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_member_download_events_user ON member_download_events(user_id, created_at)`),
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
  await env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS builder_project_owners (
    project_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL
  )`).run();
  await env.BUILDER_DB.prepare("CREATE TABLE IF NOT EXISTS schema_migrations (migration_id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)").run();
  await ensureDownloadOrderColumn(env);
}

async function ensureDownloadOrderColumn(env) {
  const columns = await env.BUILDER_DB.prepare('PRAGMA table_info(member_download_events)').all();
  if (!(columns.results || []).some(x => x.name === 'source_order_id')) try { await env.BUILDER_DB.prepare('ALTER TABLE member_download_events ADD COLUMN source_order_id TEXT').run(); }
  catch (error) { if (!String(error.message).toLowerCase().includes('duplicate')) throw error; }
  const migrated = await env.BUILDER_DB.prepare("SELECT migration_id FROM schema_migrations WHERE migration_id = 'download-order-v1'").first();
  if (!migrated && await ordersTableExists(env)) {
    // Legacy renewal rows reuse entitlement_id. Attribute by purchase time, not its current source_order_id.
    await env.BUILDER_DB.batch([env.BUILDER_DB.prepare(`UPDATE member_download_events AS d SET source_order_id = (
      SELECT o.order_id FROM orders o JOIN product_entitlements e ON e.entitlement_id = d.entitlement_id
      WHERE o.user_id = d.user_id AND o.product_code = e.product_code AND o.granted_at IS NOT NULL
        AND o.granted_at <= d.created_at ORDER BY o.granted_at DESC LIMIT 1
    ) WHERE source_order_id IS NULL`), env.BUILDER_DB.prepare("INSERT INTO schema_migrations (migration_id, applied_at) VALUES ('download-order-v1', ?) ON CONFLICT DO NOTHING").bind(nowIso())]);
  }
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
        FROM orders o JOIN builder_access_grants g ON g.grant_id = o.grant_id WHERE o.user_id = ? AND o.product_code = 'code_workshop_single' AND o.status = 'granted' AND g.status = 'active' AND (g.expires_at IS NULL OR g.expires_at > ?) ORDER BY o.granted_at DESC LIMIT 1`).bind(user.user_id, nowIso()).first();
    }
  }
  const entitlementResult = await env.BUILDER_DB.prepare(`SELECT product_code, status, starts_at, expires_at, source
    FROM product_entitlements WHERE user_id = ? AND status = 'active' AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY created_at DESC`).bind(user.user_id, nowIso(), nowIso()).all();
  return json({ ok: true, delivery_owner: deliveryOwner(user), user: { user_id: user.user_id, email: user.email, marketing_consent: Number(user.marketing_consent || 0) === 1, created_at: user.created_at, last_login_at: user.last_login_at }, builder: grant || null, entitlements: entitlementResult?.results || [], orders });
}

async function isAdmin(request, env) {
  const supplied = request.headers.get("X-Builder-Access-Key") || "";
  return Boolean(env.BUILDER_ACCESS_KEY) && constantTimeEqual(env.BUILDER_ACCESS_KEY, supplied);
}

async function activeIndicatorEntitlement(env, userId, artifact) {
  const products = [...INDICATOR_MEMBERSHIP_PRODUCTS, artifact.code];
  const placeholders = products.map(() => "?").join(",");
  return env.BUILDER_DB.prepare(`SELECT entitlement_id, product_code, expires_at, source_order_id
    FROM product_entitlements
    WHERE user_id = ? AND product_code IN (${placeholders}) AND status = 'active'
      AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY expires_at DESC LIMIT 1`)
    .bind(userId, ...products, nowIso(), nowIso()).first();
}

// Owner exemption is derived only from the verified account session. It does
// not grant membership, change existing executables, or trust a supplied email.
function deliveryOwner(user) {
  return String(user?.email || '').trim().toLowerCase() === 'cvvcvv2025@gmail.com';
}
function protectedRelease(env, artifact) {
  const registered = Object.values(INDICATOR_ARTIFACTS).includes(artifact) || Object.values(EA_ARTIFACTS).includes(artifact);
  if (artifact.runtime_client_version === 3) {
    const signed = String(env.RUNTIME_SIGNED3_PRODUCTS || '').split(',').map(x => x.trim());
    return registered && artifact.runtime_signing_key_id === 'c93c6e5e8bce9367' && Boolean(artifact.license_product) && signed.includes(artifact.license_product);
  }
  const accepted = Object.values(EA_ARTIFACTS).some(a => a === artifact);
  const enabled = String(env.RUNTIME_LICENSE_PRODUCTS || '').split(',').map(x => x.trim());
  const v2 = String(env.RUNTIME_LICENSE_V2_PRODUCTS || '').split(',').map(x => x.trim());
  return accepted && Boolean(artifact.license_product) && enabled.includes(artifact.license_product) && v2.includes(artifact.license_product);
}
function deliveryPolicy(env, artifact, user = null) {
  const protectedReady = protectedRelease(env, artifact);
  return { runtime_license_ready: protectedReady, owner_download_exemption: deliveryOwner(user),
    download_allowed: protectedReady || deliveryOwner(user),
    blocked_reason: protectedReady || deliveryOwner(user) ? null : 'LICENSE_UPGRADE_PENDING' };
}
function protectedDeliveryPending() {
  return json({ ok: false, code: 'LICENSE_UPGRADE_PENDING', error: '防共享授权版升级中，当前安装包暂停客户下载；已有会员和手工授权权益保留。' }, 503);
}

async function artifactState(env, artifact) {
  if (artifact.releaseStatus === 'awaiting_binary' || !env.USER_CODE_BUCKET) return { ready: false, size: null };
  try {
    const stored = await env.USER_CODE_BUCKET.head(artifact.r2Key);
    return { ready: Boolean(stored && stored.customMetadata?.sha256 === artifact.sha256 && stored.customMetadata?.version === artifact.version), size: stored?.size || null };
  } catch { return { ready: false, size: null }; }
}

async function resolveIndicatorArtifact(env, artifact) {
  // A signed client may never fall back to a legacy unprotected executable.
  if (artifact.runtime_client_version === 3) return artifact;
  if (!artifact.previous || (await artifactState(env, artifact)).ready) return artifact;
  const previous = { ...artifact, ...artifact.previous, previous: undefined };
  return (await artifactState(env, previous)).ready ? previous : artifact;
}

async function deliveryCatalog(env, verify = false) {
  const items = [...Object.entries(INDICATOR_ARTIFACTS).map(([slug, a]) => [slug, a, 'indicator']), ...Object.entries(EA_ARTIFACTS).map(([slug, a]) => [slug, a, 'ea'])];
  const artifacts = await Promise.all(items.map(async ([slug, artifact, kind]) => {
    if (kind === 'indicator') artifact = await resolveIndicatorArtifact(env, artifact);
    const state = await artifactState(env, artifact);
    const out = { slug, kind, version: artifact.version, filename: artifact.filename, ...state };
    if (artifact.membershipRequired === false) out.membership_required = false;
    out.performance_qualified = kind === 'indicator' ? INDICATOR_PERFORMANCE_AUDIT.qualified : null;
    Object.assign(out, deliveryPolicy(env, artifact));
    out.download_allowed = state.ready && out.download_allowed;
    if (kind === 'indicator') out.audit_report = INDICATOR_PERFORMANCE_AUDIT.report;
    if (verify) {
      const object = env.USER_CODE_BUCKET ? await env.USER_CODE_BUCKET.get(artifact.r2Key) : null;
      const bytes = object ? await object.arrayBuffer() : null;
      out.content_verified = Boolean(bytes && await sha256BytesHex(bytes) === artifact.sha256);
      out.size = bytes?.byteLength || null;
      out.ready = out.ready && out.content_verified;
      out.download_allowed = out.download_allowed && out.ready;
      out.sha256 = artifact.sha256;
    }
    return out;
  }));
  return json({ ok: true, artifacts, ready_count: artifacts.filter(x => x.ready).length, downloadable_count: artifacts.filter(x => x.download_allowed).length, total_count: artifacts.length });
}

async function indicatorAccess(request, env, artifact) {
  artifact = await resolveIndicatorArtifact(env, artifact);
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: false, error: "请先登录 T5 账户", code: "ACCOUNT_REQUIRED" }, 401);
  await ensureAccountDb(env);
  const entitlement = await activeIndicatorEntitlement(env, user.user_id, artifact);
  return json({
    ok: true,
    artifact: { code: artifact.code, version: artifact.version, filename: artifact.filename, ...await artifactState(env, artifact), performance_qualified: INDICATOR_PERFORMANCE_AUDIT.qualified, ...deliveryPolicy(env, artifact, user) },
    entitled: Boolean(entitlement),
    entitlement: entitlement || null
  });
}

async function downloadIndicator(request, env, artifact) {
  artifact = await resolveIndicatorArtifact(env, artifact);
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: false, error: "请先登录后下载", code: "ACCOUNT_REQUIRED" }, 401);
  await ensureAccountDb(env);
  const entitlement = await activeIndicatorEntitlement(env, user.user_id, artifact);
  if (!entitlement) return json({ ok: false, error: "当前账户没有有效的指标会员权限", code: "INDICATOR_ENTITLEMENT_REQUIRED" }, 403);
  if (!deliveryPolicy(env, artifact, user).download_allowed) return protectedDeliveryPending();
  if (!env.USER_CODE_BUCKET) return json({ ok: false, error: "下载存储尚未就绪", code: "ARTIFACT_STORAGE_NOT_READY" }, 503);
  const object = await env.USER_CODE_BUCKET.get(artifact.r2Key);
  if (!object) return json({ ok: false, error: "安装包尚未上传，请稍后再试", code: "ARTIFACT_NOT_READY" }, 503);
  const bytes = await object.arrayBuffer();
  const actualHash = await sha256BytesHex(bytes);
  if (!(await constantTimeEqual(actualHash, artifact.sha256))) {
    return json({ ok: false, error: "安装包内容校验失败，下载已暂停", code: "ARTIFACT_CONTENT_MISMATCH" }, 503);
  }
  await env.BUILDER_DB.prepare(`INSERT INTO member_download_events
    (event_id, user_id, entitlement_id, artifact_code, artifact_version, ip_hash, user_agent, created_at, source_order_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(randomId("DL"), user.user_id, entitlement.entitlement_id, artifact.code, artifact.version,
      await ipHash(request, env), (request.headers.get("User-Agent") || "").slice(0, 500), nowIso(), entitlement.source_order_id || null).run();
  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${artifact.filename}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-T5-Artifact-Version": artifact.version,
    "X-T5-Artifact-SHA256": artifact.sha256
  });
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(bytes, { status: 200, headers });
}

async function activeEaEntitlement(env, userId, artifact) {
  const products = [...EA_MEMBERSHIP_PRODUCTS, artifact.code];
  const placeholders = products.map(() => "?").join(",");
  return env.BUILDER_DB.prepare(`SELECT entitlement_id, product_code, expires_at, source_order_id
    FROM product_entitlements
    WHERE user_id = ? AND product_code IN (${placeholders}) AND status = 'active'
      AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY expires_at DESC LIMIT 1`)
    .bind(userId, ...products, nowIso(), nowIso()).first();
}
async function eaAccess(request, env, artifact) {
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: false, error: "请先登录 T5 账户", code: "ACCOUNT_REQUIRED" }, 401);
  await ensureAccountDb(env);
  const entitlement = await activeEaEntitlement(env, user.user_id, artifact);
  const { ready } = await artifactState(env, artifact);
  return json({ ok: true, artifact: { code: artifact.code, version: artifact.version, filename: artifact.filename, ready, ...deliveryPolicy(env, artifact, user) }, entitled: Boolean(entitlement), entitlement: entitlement || null });
}
async function downloadEa(request, env, artifact) {
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: false, error: "请先登录后下载", code: "ACCOUNT_REQUIRED" }, 401);
  await ensureAccountDb(env);
  const entitlement = await activeEaEntitlement(env, user.user_id, artifact);
  if (!entitlement) return json({ ok: false, error: "当前账户没有有效的自动化会员权限", code: "EA_ENTITLEMENT_REQUIRED" }, 403);
  if (!deliveryPolicy(env, artifact, user).download_allowed) return protectedDeliveryPending();
  if (artifact.releaseStatus === "awaiting_binary") return json({ ok: false, error: "该版本客户安装包尚未就绪，请查看产品页的交付状态", code: "ARTIFACT_NOT_RELEASED" }, 503);
  if (!env.USER_CODE_BUCKET) return json({ ok: false, error: "下载存储尚未就绪", code: "ARTIFACT_STORAGE_NOT_READY" }, 503);
  const object = await env.USER_CODE_BUCKET.get(artifact.r2Key);
  if (!object) return json({ ok: false, error: "安装包正在同步，请稍后再试", code: "ARTIFACT_NOT_READY" }, 503);
  const bytes = await object.arrayBuffer();
  const actualHash = await sha256BytesHex(bytes);
  if (!(await constantTimeEqual(actualHash, artifact.sha256))) return json({ ok: false, error: "安装包内容校验失败，下载已暂停", code: "ARTIFACT_CONTENT_MISMATCH" }, 503);
  await env.BUILDER_DB.prepare(`INSERT INTO member_download_events
    (event_id, user_id, entitlement_id, artifact_code, artifact_version, ip_hash, user_agent, created_at, source_order_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(randomId("DL"), user.user_id, entitlement.entitlement_id, artifact.code, artifact.version,
      await ipHash(request, env), (request.headers.get("User-Agent") || "").slice(0, 500), nowIso(), entitlement.source_order_id || null).run();
  const headers = new Headers({
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${artifact.filename}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "X-T5-Artifact-Version": artifact.version,
    "X-T5-Artifact-SHA256": artifact.sha256
  });
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(bytes, { status: 200, headers });
}
async function adminUploadIndicator(request, env, artifact) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Unauthorized", code: "ADMIN_REQUIRED" }, 403);
  if (artifact.releaseStatus === "awaiting_binary") return json({ ok: false, error: "请先完成编译文件与客户安装包的校验登记", code: "ARTIFACT_NOT_RELEASED" }, 409);
  if (!env.USER_CODE_BUCKET) return json({ ok: false, error: "R2 storage is not configured", code: "ARTIFACT_STORAGE_NOT_READY" }, 503);
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > artifact.maxBytes) return json({ ok: false, error: "文件过大", code: "ARTIFACT_TOO_LARGE" }, 413);
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > artifact.maxBytes) return json({ ok: false, error: "文件为空或过大", code: "INVALID_ARTIFACT_SIZE" }, 400);
  const actualHash = await sha256BytesHex(bytes);
  if (!(await constantTimeEqual(actualHash, artifact.sha256))) {
    return json({ ok: false, error: "文件校验失败，拒绝上传", code: "ARTIFACT_HASH_MISMATCH" }, 400);
  }
  await env.USER_CODE_BUCKET.put(artifact.r2Key, bytes, {
    httpMetadata: { contentType: "application/zip" },
    customMetadata: { version: artifact.version, sha256: artifact.sha256 }
  });
  let storageVerified = false;
  if (artifact.releaseStatus === "awaiting_upload") {
    const stored = await env.USER_CODE_BUCKET.get(artifact.r2Key);
    if (!stored || !(await constantTimeEqual(await sha256BytesHex(await stored.arrayBuffer()), artifact.sha256))) {
      return json({ ok: false, error: "安装包上传后回读校验失败，请重试", code: "ARTIFACT_STORAGE_MISMATCH" }, 503);
    }
    storageVerified = true;
  }
  return json({ ok: true, storage_verified: storageVerified, artifact: { code: artifact.code, filename: artifact.filename, version: artifact.version, sha256: artifact.sha256, size: bytes.byteLength } });
}

async function adminEntitlement(request, env) {
  if (!(await isAdmin(request, env))) return json({ ok: false, error: "Unauthorized", code: "ADMIN_REQUIRED" }, 403);
  await ensureAccountDb(env);
  let body = {}; try { body = await request.json(); } catch {}
  const email = normalizeEmail(body.email);
  const action = String(body.action || "grant");
  const productCode = String(body.product_code || "indicator_membership");
  if (!email) return json({ ok: false, error: "请输入有效邮箱", code: "INVALID_EMAIL" }, 400);
  if (!["grant", "revoke"].includes(action)) return json({ ok: false, error: "无效操作", code: "INVALID_ACTION" }, 400);
  if (!MEMBER_PRODUCT_CODES.includes(productCode)) return json({ ok: false, error: "无效产品权限", code: "INVALID_PRODUCT_CODE" }, 400);
  const user = await env.BUILDER_DB.prepare("SELECT user_id, email FROM users WHERE email = ? AND status = 'active'").bind(email).first();
  if (!user) return json({ ok: false, error: "该邮箱尚未注册 T5 账户", code: "USER_NOT_FOUND" }, 404);
  const now = nowIso();
  if (action === "revoke") {
    await env.BUILDER_DB.prepare("UPDATE product_entitlements SET status = 'revoked', updated_at = ? WHERE user_id = ? AND product_code = ?")
      .bind(now, user.user_id, productCode).run();
    return json({ ok: true, action, email: user.email, product_code: productCode });
  }
  const expiryMs = body.expires_at ? Date.parse(String(body.expires_at)) : NaN;
  if (body.expires_at && !Number.isFinite(expiryMs)) return json({ ok: false, error: "到期时间格式无效", code: "INVALID_EXPIRY" }, 400);
  const expiresAt = body.expires_at ? new Date(expiryMs).toISOString() : null;
  if (expiresAt && Date.parse(expiresAt) <= Date.now()) return json({ ok: false, error: "到期时间必须晚于当前时间", code: "INVALID_EXPIRY" }, 400);
  await env.BUILDER_DB.prepare(`INSERT INTO product_entitlements
    (entitlement_id, user_id, product_code, status, starts_at, expires_at, source, created_at, updated_at)
    VALUES (?, ?, ?, 'active', ?, ?, 'admin', ?, ?)
    ON CONFLICT(user_id, product_code) DO UPDATE SET status = 'active', starts_at = excluded.starts_at,
      expires_at = excluded.expires_at, source = 'admin', updated_at = excluded.updated_at`)
    .bind(randomId("ENT"), user.user_id, productCode, now, expiresAt, now, now).run();
  return json({ ok: true, action, email: user.email, product_code: productCode, expires_at: expiresAt });
}

async function adminAccounts(request, env) {
  try {
    if (!(await isAdmin(request, env))) return json({ ok: false, error: "Unauthorized" }, 403);
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
  if (!user) return json({ ok: false, error: "购买前请先使用邮箱登录。", code: "ACCOUNT_REQUIRED" }, 401);
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
  return env.BUILDER_DB.prepare(`SELECT g.grant_id, g.token_hash, g.plan, g.status, g.analyze_remaining, g.modify_remaining, g.expires_at, o.order_id FROM orders o JOIN builder_access_grants g ON g.grant_id = o.grant_id WHERE o.user_id = ? AND o.product_code = 'code_workshop_single' AND o.status = 'granted' AND g.status = 'active' AND (g.expires_at IS NULL OR g.expires_at > ?) ORDER BY o.granted_at DESC LIMIT 1`).bind(userId, nowIso()).first();
}

async function claimLegacyProject(request, env) {
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: false, code: 'ACCOUNT_REQUIRED', error: '请先登录' }, 401);
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: '请求无效' }, 400); }
  const id = String(body.project_id || ''), supplied = String(body.project_token || '');
  if (!id || !supplied) return json({ ok: false, error: '旧项目凭据不完整' }, 400);
  const tokenHash = await sha256Hex(supplied);
  const project = await env.BUILDER_DB.prepare('SELECT project_id FROM projects WHERE project_id = ? AND token_hash = ?').bind(id, tokenHash).first();
  if (!project) return json({ ok: false, error: '旧项目凭据无效' }, 403);
  const derived = await hmacHex(env.ACCOUNT_AUTH_SECRET, `project:${user.user_id}:${id}`);
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare('INSERT INTO builder_project_owners (project_id,user_id,created_at) VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(id, user.user_id, nowIso()),
    env.BUILDER_DB.prepare('UPDATE projects SET token_hash=? WHERE project_id=? AND token_hash=? AND EXISTS (SELECT 1 FROM builder_project_owners WHERE project_id=? AND user_id=?)').bind(await sha256Hex(derived), id, tokenHash, id, user.user_id)
  ]);
  const owner = await env.BUILDER_DB.prepare('SELECT user_id FROM builder_project_owners WHERE project_id=?').bind(id).first();
  return owner?.user_id === user.user_id ? json({ ok: true }) : json({ ok: false, error: '项目不属于当前账户' }, 403);
}

async function accountProjects(request, env) {
  const user = await resolveSession(request, env);
  if (!user) return json({ ok: false, error: '请先登录', code: 'ACCOUNT_REQUIRED' }, 401);
  const exists = await env.BUILDER_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'").first();
  if (!exists) return json({ ok: true, projects: [] });
  const rows = await env.BUILDER_DB.prepare(`SELECT p.project_id, p.filename, p.platform, p.status, p.updated_at
    FROM builder_project_owners a JOIN projects p ON p.project_id = a.project_id
    WHERE a.user_id = ? ORDER BY p.updated_at DESC LIMIT 30`).bind(user.user_id).all();
  return json({ ok: true, projects: rows.results || [] });
}

async function bridgeBuilderAccess(request, env, ctx) {
  const user = await resolveSession(request, env);
  if (!user) return app.fetch(request, env, ctx);
  const url = new URL(request.url), headers = new Headers(request.headers);
  let projectId = url.searchParams.get('project_id') || '';
  if (!projectId && request.method === 'POST' && /\/(analyze|modify)$/.test(url.pathname)) {
    try { projectId = String((await request.clone().json()).projectId || ''); } catch {}
  }
  if (projectId) {
    const owner = await env.BUILDER_DB.prepare('SELECT user_id FROM builder_project_owners WHERE project_id = ?').bind(projectId).first();
    if (owner && owner.user_id !== user.user_id) return json({ ok: false, error: '项目不属于当前账户', code: 'PROJECT_ACCOUNT_MISMATCH' }, 403);
    if (owner) headers.set('X-Project-Token', await hmacHex(env.ACCOUNT_AUTH_SECRET, `project:${user.user_id}:${projectId}`));
  }
  const grant = await activeGrantForUser(env, user.user_id);
  if (grant) {
    const derivedToken = await hmacHex(env.ACCOUNT_AUTH_SECRET, `grant:${user.user_id}:${grant.grant_id}`), derivedHash = await sha256Hex(derivedToken);
    if (grant.token_hash !== derivedHash) {
      await env.BUILDER_DB.batch([
        env.BUILDER_DB.prepare("UPDATE builder_access_grants SET token_hash = ?, updated_at = ? WHERE grant_id = ?").bind(derivedHash, nowIso(), grant.grant_id),
        env.BUILDER_DB.prepare("UPDATE orders SET builder_token_hash = ?, updated_at = ? WHERE order_id = ?").bind(derivedHash, nowIso(), grant.order_id)
      ]);
    }
    headers.set('X-Builder-Access-Token', derivedToken);
  }
  const response = await app.fetch(new Request(request, { headers }), env, ctx);
  if (url.pathname !== '/api/builder/upload' || !response.ok) return response;
  const payload = await response.json();
  const token = await hmacHex(env.ACCOUNT_AUTH_SECRET, `project:${user.user_id}:${payload.projectId}`);
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare('INSERT INTO builder_project_owners (project_id, user_id, created_at) VALUES (?, ?, ?)').bind(payload.projectId, user.user_id, nowIso()),
    env.BUILDER_DB.prepare('UPDATE projects SET token_hash = ? WHERE project_id = ?').bind(await sha256Hex(token), payload.projectId)
  ]);
  // New account projects are recovered through the authenticated account, not a URL token.
  delete payload.projectToken;
  payload.accountUserId = user.user_id;
  return json(payload);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url), p = url.pathname;
      if (p.startsWith('/api/training/breakout/')) return trainingResponse(request, env, resolveSession);
      if (p.startsWith('/api/admin/training-sandbox/')) {
        if (!(await isAdmin(request, env))) return json({ok:false,code:'UNAUTHORIZED'},403);
        if (env.ENABLE_PAYPAL_SANDBOX_E2E !== 'true') return json({ok:false,code:'SANDBOX_DISABLED'},503);
        if (p === '/api/admin/training-sandbox/content' && request.method === 'GET') {
          const head=await env.USER_CODE_BUCKET?.head(TRAINING_CONTENT_KEY);
          return json({ok:true,ready:!!head,sha256:head?.customMetadata?.sha256 || null});
        }
        if (p === '/api/admin/training-sandbox/content' && request.method === 'PUT') {
          if (request.headers.get('Origin') !== url.origin) return json({ok:false,code:'SAME_ORIGIN_REQUIRED'},403);
          const body = await request.text(); if (body.length > 300000) return json({ok:false,code:'TOO_LARGE'},413);
          let content; try { content=JSON.parse(body); } catch {return json({ok:false,code:'INVALID_JSON'},400);}
          const ids=['PRE01','PRE02','PRE03','D2A','D2B','D3A','D3B','D4A','D4B','D5A','D5B','D6A','D6B','POST01','POST02','POST03'];
          if (content.contentVersion !== 'pilot-2026-10-22' || content.cases?.length !== 16 || !ids.every(id=>content.cases.some(c=>c.id===id && c.bars?.length===12 && c.answer && c.future?.length===4)) || !Array.isArray(content.policy)) return json({ok:false,code:'INVALID_CONTENT'},400);
          if (!env.USER_CODE_BUCKET) return json({ok:false,code:'STORAGE_UNAVAILABLE'},503);
          const checksum=await sha256Hex(body);
          const old=await env.USER_CODE_BUCKET.head(TRAINING_CONTENT_KEY);
          if (old) return json({ok:false,code:'CONTENT_ALREADY_PINNED',error:'已有固定版本内容，请勿覆盖。'},409);
          await env.USER_CODE_BUCKET.put(TRAINING_CONTENT_KEY,body,{httpMetadata:{contentType:'application/json'},customMetadata:{sha256:checksum,version:content.contentVersion}});
          return json({ok:true,sha256:checksum});
        }
        if (p.startsWith('/api/admin/training-sandbox/learning/')) {
          const target=new URL(request.url); target.pathname=p.replace('/api/admin/training-sandbox/learning/','/api/training/breakout/');
          return trainingResponse(new Request(target,request),{...env,T5_TRAINING_DELIVERY_ENABLED:'true'},resolveSession);
        }
      }
      if (p === '/api/admin/paypal-sandbox/order' && request.method === 'POST') {
        let body={};try{body=await request.clone().json();}catch{}
        if (body.product_code === 'training_breakout_v1') {
          if (!(await isAdmin(request,env))) return json({ok:false,code:'UNAUTHORIZED'},403);
          const user=await resolveSession(request,env);
          if(!user)return json({ok:false,code:'ACCOUNT_REQUIRED',error:'请先登录测试T5账户'},401);
          if(body.terms_accepted!==true || body.terms_version!==TRAINING_TERMS)return json({ok:false,code:'TERMS_ACCEPTANCE_REQUIRED'},400);
          if(!await env.USER_CODE_BUCKET?.head(TRAINING_CONTENT_KEY))return json({ok:false,code:'TRAINING_CONTENT_NOT_READY'},503);
          const headers=new Headers(request.headers);headers.set('Content-Type','application/json');
          const response=await app.fetch(new Request(request.url,{method:'POST',headers,body:JSON.stringify({...body,email:user.email})}),env,ctx);
          if(!response.ok)return response;
          const data=await response.clone().json();const orderId=data.order?.order_id;
          if(orderId){
            await ensureOrderUserColumn(env);
            const head=await env.USER_CODE_BUCKET.head(TRAINING_CONTENT_KEY);
            await env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS training_sandbox_test_orders (order_id TEXT PRIMARY KEY,content_sha256 TEXT NOT NULL,created_at TEXT NOT NULL)`).run();
            await env.BUILDER_DB.prepare('INSERT INTO training_sandbox_test_orders (order_id,content_sha256,created_at) VALUES (?,?,?)').bind(orderId,head?.customMetadata?.sha256 || '',nowIso()).run();
            await env.BUILDER_DB.prepare('UPDATE orders SET user_id=?,customer_email=? WHERE order_id=?').bind(user.user_id,user.email,orderId).run();
            await env.BUILDER_DB.prepare(`INSERT INTO order_terms (order_id,terms_version,accepted_at,accepted_ip_hash,user_agent,created_at) VALUES (?,?,?,?,?,?)`).bind(orderId,TRAINING_TERMS,nowIso(),await ipHash(request,env),String(request.headers.get('User-Agent')||'').slice(0,500),nowIso()).run();
          }
          return response;
        }
      }
      if (p === '/api/admin/runtime-signing-key') {
        if (!(await isAdmin(request,env))) return json({ok:false,code:'ADMIN_REQUIRED'},403);
        return signingKeyAdmin(request,env);
      }
      if (p === '/api/licenses/signing-public-key' && request.method === 'GET') return signingPublicKey(request,env);
      if (p === '/api/licenses/lease-v3') { await ensureAccountDb(env); return signedLeaseResponse(request,env,resolveSession); }
      if (p === '/api/account/runtime-licenses/owner-profile') { await ensureAccountDb(env); return ownerProfileResponse(request,env,resolveSession); }
      if (p === '/api/account/runtime-licenses/install-package') {
        if(request.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
        if((request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({ok:false,code:'ORIGIN_MISMATCH'},403);
        const raw=await request.text();if(raw.length>4096)return json({ok:false,code:'INVALID_REQUEST'},400);
        let binding;try{binding=JSON.parse(raw);}catch{return json({ok:false,code:'INVALID_REQUEST'},400);}
        if(!binding||!['MT4','MT5'].includes(binding.platform))return json({ok:false,code:'INVALID_BINDING'},400);
        const indicator=Object.entries(INDICATOR_ARTIFACTS).find(([slug,a])=>a.license_product===binding.product_code&&slug.endsWith('-mt5')===(binding.platform==='MT5'))?.[1];
        const ea=Object.values(EA_ARTIFACTS).find(a=>a.license_product===binding.product_code);
        const artifact=indicator||ea;if(!artifact||artifact.runtime_client_version!==3)return json({ok:false,code:'LICENSE_RELEASE_NOT_ENABLED'},409);
        await ensureAccountDb(env);
        // The original download path enforces payment/manual entitlement, release
        // gates, stored artifact SHA256 and the normal download audit event.
        const profile=await installProfileResponse(new Request(request.url,{method:'POST',headers:request.headers,body:raw}),env,resolveSession);
        if(!profile.ok)return profile;
        const baseRequest=new Request(request.url,{headers:request.headers});
        const original=indicator?await downloadIndicator(baseRequest,env,artifact):await downloadEa(baseRequest,env,artifact);
        if(!original.ok)return original;
        const archive=await boundInstallPackage(await original.arrayBuffer(),await profile.text(),binding,artifact,indicator?'indicator':'ea');
        return new Response(archive,{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="T5_${binding.product_code}_${binding.platform}_Personal_Install.zip"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
      }
      if (p === '/api/admin/runtime-license-qa' || p === '/api/admin/runtime-license-qa/update') {
        if (!(await isAdmin(request,env))) return json({ ok: false, error: 'Unauthorized' },403);
        await ensureAccountDb(env);
        return adminRuntimeLicenseQa(request,env);
      }
      if (p.startsWith('/api/account/runtime-licenses') || p === '/api/licenses/verify') {
        await ensureAccountDb(env);
        const response = await runtimeLicenseResponse(request, env, resolveSession);
        if (response) return response;
      }
      if (p === '/api/products/delivery' && request.method === 'GET') return deliveryCatalog(env);
      if (p === '/api/admin/delivery-check' && request.method === 'GET') {
        if (!(await isAdmin(request, env))) return json({ ok: false, error: 'Unauthorized' }, 403);
        return deliveryCatalog(env, true);
      }
      if (p === "/api/auth/config" && request.method === "GET") return json({ ok: true, email_login_ready: authConfigured(env), provider: "resend" });
      if (p === "/api/auth/request-code" && request.method === "POST") return requestCode(request, env);
      if (p === "/api/auth/verify-code" && request.method === "POST") return verifyCode(request, env);
      if (p === "/api/auth/me" && request.method === "GET") return me(request, env);
      if (p === "/api/auth/logout" && request.method === "POST") return logout(request, env);
      if (p === '/api/account/builder-projects/claim' && request.method === 'POST') return claimLegacyProject(request, env);
      if (p === "/api/account/builder-projects" && request.method === "GET") return accountProjects(request, env);
      if (p === "/api/account/summary" && request.method === "GET") return accountSummary(request, env);
      if (p === "/api/account/marketing" && request.method === "POST") return updateMarketing(request, env);
      if (p === "/api/admin/accounts" && request.method === "GET") return adminAccounts(request, env);
      if (p === "/api/admin/member-entitlements" && request.method === "POST") return adminEntitlement(request, env);
      if (p === "/api/admin/indicator-artifacts/upload" && request.method === "PUT") {
        const artifact = INDICATOR_ARTIFACTS[url.searchParams.get("artifact") || "mtf-structure-panel"];
        if (!artifact) return json({ ok: false, error: "未知指标安装包", code: "UNKNOWN_ARTIFACT" }, 404);
        return adminUploadIndicator(request, env, artifact);
      }
      if (p === "/api/admin/ea-artifacts/upload" && request.method === "PUT") {
        const artifact = EA_ARTIFACTS[url.searchParams.get("artifact") || "attack-completion-c"];
        if (!artifact) return json({ ok: false, error: "未知 EA 安装包", code: "UNKNOWN_ARTIFACT" }, 404);
        return adminUploadIndicator(request, env, artifact);
      }
      const eaRoute = p.match(/^\/api\/member\/eas\/([^/]+)\/(access|download)$/);
      if (eaRoute && request.method === "GET") {
        const artifact = EA_ARTIFACTS[eaRoute[1]];
        if (!artifact) return json({ ok: false, error: "未知 EA", code: "UNKNOWN_ARTIFACT" }, 404);
        return eaRoute[2] === "access" ? eaAccess(request, env, artifact) : downloadEa(request, env, artifact);
      }
      const indicatorRoute = p.match(/^\/api\/member\/indicators\/([^/]+)\/(access|download)$/);
      if (indicatorRoute && request.method === "GET") {
        const artifact = INDICATOR_ARTIFACTS[indicatorRoute[1]];
        if (!artifact) return json({ ok: false, error: "未知指标", code: "UNKNOWN_ARTIFACT" }, 404);
        return indicatorRoute[2] === "access" ? indicatorAccess(request, env, artifact) : downloadIndicator(request, env, artifact);
      }
      if (p === "/api/marketing/unsubscribe" && request.method === "POST") return unsubscribe(request, env);
      if (p === "/api/orders/create" && request.method === "POST") return bindOrderToAccount(request, env, ctx);
      if (p === "/api/orders/status" && request.method === "GET") return forwardOwnedOrderAction(request, env, ctx);
      if (p === "/api/orders/cancel" && request.method === "POST") return forwardOwnedOrderAction(request, env, ctx);
      if (p === "/api/orders/refund-eligibility" && request.method === "GET") return forwardOwnedOrderAction(request, env, ctx);
      if (['/api/payment/alipay/create','/api/payment/alipay/query','/api/payment/alipay/close'].includes(p) && request.method === 'POST') return forwardOwnedOrderAction(request,env,ctx);
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
