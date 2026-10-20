// Runtime licensing is opt-in per compiled release. Download entitlement alone
// must never be advertised as enforcement inside an existing executable.
export const LICENSE_PRODUCTS = {
  mtf_structure_panel_mt4: { membership: 'indicator_membership', platforms: ['MT4'], kind: 'indicator' },
  neckline_mtf_mt4: { membership: 'indicator_membership', platforms: ['MT4'], kind: 'indicator' },
  progress_candle_mt4: { membership: 'indicator_membership', platforms: ['MT4'], kind: 'indicator' },
  attack_completion_c_mt5: { platforms: ['MT5'], kind: 'ea' },
  trend_capture_mt5: { platforms: ['MT5'], kind: 'ea' },
  range_martingale_mt4: { platforms: ['MT4', 'MT5'], kind: 'ea' },
  range_aggressive_mt4_mt5: { platforms: ['MT4', 'MT5'], kind: 'ea' }
};
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const now = () => new Date().toISOString();
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const hash = async s => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
function enabled(env, product) {
  // No release is enabled by default. Enable only after native compiled-client acceptance.
  // Indicators need a different, signed authorization client; an environment
  // typo must not accidentally sell them an unsupported activation flow.
  return LICENSE_PRODUCTS[product]?.kind === 'ea' && String(env.RUNTIME_LICENSE_PRODUCTS || '').split(',').map(x => x.trim()).includes(product);
}
async function setup(env) {
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS runtime_licenses (
      license_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product_code TEXT NOT NULL,
      platform TEXT NOT NULL, account_login TEXT NOT NULL, broker_server TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(user_id,product_code)
    )`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS runtime_license_requests (
      ip_hash TEXT NOT NULL, created_at TEXT NOT NULL
    )`),
    env.BUILDER_DB.prepare('CREATE INDEX IF NOT EXISTS idx_runtime_license_requests ON runtime_license_requests(ip_hash,created_at)')
  ]);
}
async function activeEntitlement(env, userId, product) {
  const spec = LICENSE_PRODUCTS[product];
  const products = [product, 'premium_membership', ...(spec.membership ? [spec.membership] : [])];
  // Compare actual dates: null expiry means perpetual; an overlapping later
  // entitlement must not be hidden by an expired/revoked earlier purchase.
  const result = await env.BUILDER_DB.prepare(`SELECT e.expires_at FROM product_entitlements e
    JOIN users u ON u.user_id=e.user_id WHERE e.user_id=? AND u.status='active'
    AND e.product_code IN (${products.map(() => '?').join(',')}) AND e.status='active'
    AND e.starts_at<=? AND (e.expires_at IS NULL OR e.expires_at>?)
    ORDER BY (e.expires_at IS NULL) DESC,e.expires_at DESC LIMIT 1`)
    .bind(userId, ...products, now(), now()).first();
  return result && (result.expires_at === null || Number.isFinite(Date.parse(result.expires_at))) ? result : null;
}
async function bodyOf(request) {
  if (Number(request.headers.get('Content-Length') || 0) > 4096) return null;
  const text = await request.text();
  if (text.length > 4096) return null;
  try { const b = JSON.parse(text); return b && !Array.isArray(b) && typeof b === 'object' ? b : null; } catch { return null; }
}
function binding(body) {
  const product = String(body.product_code || ''), platform = String(body.platform || '');
  const login = String(body.account_login || '').trim(), server = String(body.broker_server || '').trim();
  if (!LICENSE_PRODUCTS[product]?.platforms.includes(platform) || !/^[1-9][0-9]{0,19}$/.test(login) || !server || server.length > 120 || /[\x00-\x1f\x7f]/.test(server)) return null;
  return { product, platform, login, server };
}
export async function runtimeLicenseResponse(request, env, resolveSession) {
  const p = new URL(request.url).pathname;
  if (!['/api/account/runtime-licenses', '/api/account/runtime-licenses/revoke', '/api/licenses/verify'].includes(p)) return null;
  if (!env.BUILDER_DB || !env.ACCOUNT_AUTH_SECRET) return json({ ok: false, code: 'LICENSE_UNAVAILABLE' }, 503);
  const verifying = p === '/api/licenses/verify';
  if ((!verifying && p.endsWith('/revoke') && request.method !== 'POST') || (verifying && request.method !== 'POST') || (!verifying && !p.endsWith('/revoke') && !['GET','POST'].includes(request.method))) return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  let user;
  if (!verifying) {
    user = await resolveSession(request, env);
    if (!user) return json({ ok: false, code: 'ACCOUNT_REQUIRED' }, 401);
    // Defense in depth for cookie-authenticated mutations. Non-browser native
    // verification uses its separate bearer credential and does not need cookies.
    const origin = request.headers.get('Origin');
    if (request.method !== 'GET' && ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site')) return json({ ok: false, code: 'ORIGIN_MISMATCH' }, 403);
  }
  await setup(env);
  if (!verifying && request.method === 'GET') {
    const rows = await env.BUILDER_DB.prepare('SELECT license_id,product_code,platform,account_login,broker_server,status,created_at,updated_at FROM runtime_licenses WHERE user_id=? ORDER BY created_at DESC').bind(user.user_id).all();
    return json({ ok: true, products: Object.entries(LICENSE_PRODUCTS).map(([code, v]) => ({ code, kind: v.kind, enabled: enabled(env, code), platforms: v.platforms })), licenses: rows.results || [], legacy_downloads_require_activation: false });
  }
  const body = await bodyOf(request);
  if (!body) return json({ ok: false, code: 'INVALID_REQUEST' }, 400);
  if (!verifying && p.endsWith('/revoke')) {
    const r = await env.BUILDER_DB.prepare("UPDATE runtime_licenses SET status='revoked',updated_at=? WHERE license_id=? AND user_id=?").bind(now(), String(body.license_id || ''), user.user_id).run();
    return Number(r.meta?.changes) ? json({ ok: true }) : json({ ok: false, code: 'LICENSE_NOT_FOUND' }, 404);
  }
  const b = binding(body);
  if (!b) return json({ ok: false, code: 'INVALID_BINDING' }, 400);
  if (!enabled(env, b.product)) return json({ ok: false, code: 'LICENSE_RELEASE_NOT_ENABLED', error: '当前安装包仍按原交付方式使用，无需激活。' }, 409);
  if (!verifying) {
    const entitlement = await activeEntitlement(env, user.user_id, b.product);
    if (!entitlement) return json({ ok: false, code: 'ENTITLEMENT_REQUIRED' }, 403);
    // One active trading account per product. Revoke first to replace a binding;
    // renewing membership never changes the stored client credential.
    const token = hex(crypto.getRandomValues(new Uint8Array(32))), id = 'T5-L-' + crypto.randomUUID();
    const r = await env.BUILDER_DB.prepare(`INSERT INTO runtime_licenses
      (license_id,user_id,product_code,platform,account_login,broker_server,token_hash,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,'active',?,?) ON CONFLICT(user_id,product_code) DO UPDATE SET
      license_id=excluded.license_id,platform=excluded.platform,account_login=excluded.account_login,
      broker_server=excluded.broker_server,token_hash=excluded.token_hash,status='active',updated_at=excluded.updated_at
      WHERE runtime_licenses.status='revoked'`)
      .bind(id, user.user_id, b.product, b.platform, b.login, b.server, await hash(token), now(), now()).run();
    if (!Number(r.meta?.changes)) return json({ ok: false, code: 'ACTIVE_BINDING_EXISTS', error: '已有激活账号。更换前请先撤销原授权。' }, 409);
    return json({ ok: true, license_id: id, license_key: token, expires_at: entitlement.expires_at, offline_grace_seconds: 86400 });
  }
  const nonce = String(body.nonce || '');
  if (!/^[a-f0-9]{32}$/.test(nonce)) return json({ ok: false, code: 'INVALID_NONCE' }, 400);
  // Bound failed lookups as well as successful checks. Never store client keys,
  // plaintext IP addresses or account credentials in the request ledger.
  const ipHash = await hash(env.ACCOUNT_AUTH_SECRET + ':license:' + (request.headers.get('CF-Connecting-IP') || 'unknown'));
  const cutoff = new Date(Date.now() - 60000).toISOString();
  await env.BUILDER_DB.prepare('DELETE FROM runtime_license_requests WHERE created_at<?').bind(new Date(Date.now() - 86400000).toISOString()).run();
  const rate = await env.BUILDER_DB.prepare(`INSERT INTO runtime_license_requests(ip_hash,created_at)
    SELECT ?,? WHERE (SELECT COUNT(*) FROM runtime_license_requests WHERE ip_hash=? AND created_at>?)<60`).bind(ipHash, now(), ipHash, cutoff).run();
  if (!Number(rate.meta?.changes)) return json({ ok: false, code: 'RATE_LIMITED' }, 429);
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const license = /^[a-f0-9]{64}$/.test(token) ? await env.BUILDER_DB.prepare('SELECT * FROM runtime_licenses WHERE token_hash=?').bind(await hash(token)).first() : null;
  const allowed = license && license.status === 'active' && license.product_code === b.product && license.platform === b.platform && license.account_login === b.login && license.broker_server === b.server;
  const entitlement = allowed ? await activeEntitlement(env, license.user_id, b.product) : null;
  const issued = Math.floor(Date.now() / 1000), expiry = entitlement?.expires_at ? Math.floor(Date.parse(entitlement.expires_at) / 1000) : 0;
  const lease = entitlement ? Math.min(issued + 86400, expiry || Infinity) : 0;
  const state = entitlement ? 'active' : 'denied';
  const wire = ['T5L1', nonce, b.product, b.platform, b.login, issued, expiry, lease, state].join('|');
  if (request.headers.get('Accept') === 'text/plain') return new Response(wire, { status: entitlement ? 200 : 403, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  return json({ ok: Boolean(entitlement), code: entitlement ? 'LICENSE_ACTIVE' : 'LICENSE_DENIED', nonce, server_time: issued, expires_at: expiry, lease_until: lease, allow_new_entries: Boolean(entitlement), manage_existing_positions: true }, entitlement ? 200 : 403);
}
