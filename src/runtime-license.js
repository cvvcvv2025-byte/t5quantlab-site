// Runtime licensing is opt-in per compiled release. Download entitlement alone
// must never be advertised as enforcement inside an existing executable.
export const LICENSE_PRODUCTS = {
  structure_decision_map_mt4: {membership:'indicator_membership',platforms:['MT4','MT5'],kind:'indicator',protocol_version:3},
  mtf_structure_panel_mt4: { membership: 'indicator_membership', platforms: ['MT4','MT5'], kind: 'indicator', protocol_version:3 },
  neckline_mtf_mt4: { membership: 'indicator_membership', platforms: ['MT4','MT5'], kind: 'indicator', protocol_version:3 },
  progress_candle_mt4: { membership: 'indicator_membership', platforms: ['MT4','MT5'], kind: 'indicator', protocol_version:3 },
  attack_completion_c_mt5: { platforms: ['MT5'], kind: 'ea' },
  trend_capture_mt5: { platforms: ['MT5'], kind: 'ea' },
  range_martingale_mt4: { platforms: ['MT4', 'MT5'], kind: 'ea' },
  range_aggressive_mt4_mt5: { platforms: ['MT4', 'MT5'], kind: 'ea' },
  attack_completion_c_mt5_v3: {entitlement_product:'attack_completion_c_mt5',protocol_version:3,platforms:['MT5'],kind:'ea'},
  trend_capture_mt5_v3: {entitlement_product:'trend_capture_mt5',protocol_version:3,platforms:['MT5'],kind:'ea'},
  range_martingale_mt4_v3: {entitlement_product:'range_martingale_mt4',protocol_version:3,platforms:['MT4', 'MT5'],kind:'ea'},
  range_aggressive_mt4_mt5_v3: {entitlement_product:'range_aggressive_mt4_mt5',protocol_version:3,platforms:['MT4', 'MT5'],kind:'ea'},
  attack_completion_c_mt5_v2: { entitlement_product:'attack_completion_c_mt5', protocol_version:2, platforms:['MT5'], kind:'ea' },
  trend_capture_mt5_v2: { entitlement_product:'trend_capture_mt5', protocol_version:2, platforms:['MT5'], kind:'ea' },
  range_martingale_mt4_v2: { entitlement_product:'range_martingale_mt4', protocol_version:2, platforms:['MT4','MT5'], kind:'ea' },
  range_aggressive_mt4_mt5_v2: { entitlement_product:'range_aggressive_mt4_mt5', protocol_version:2, platforms:['MT4','MT5'], kind:'ea' }
};
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const now = () => new Date().toISOString();
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const hash = async s => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
function enabled(env, product) {
  // No release is enabled by default. Enable only after native compiled-client acceptance.
  // Indicators need a different, signed authorization client; an environment
  // typo must not accidentally sell them an unsupported activation flow.
  const accepted = String(env.RUNTIME_LICENSE_PRODUCTS || '').split(',').map(x => x.trim()).includes(product);
  const acceptedV2 = String(env.RUNTIME_LICENSE_V2_PRODUCTS || '').split(',').map(x => x.trim()).includes(product);
  if(LICENSE_PRODUCTS[product]?.protocol_version===3)return String(env.RUNTIME_SIGNED3_PRODUCTS||'').split(',').map(x=>x.trim()).includes(product);
  return LICENSE_PRODUCTS[product]?.kind === 'ea' && accepted && (LICENSE_PRODUCTS[product].protocol_version !== 2 || acceptedV2);
}
// Independently gated: never silently change the contract of existing clients.
function hardened(env, product) {
  return Number(LICENSE_PRODUCTS[product]?.protocol_version)>=2;
}
const V2_LEASE_SECONDS = 300, REBIND_SECONDS = 30 * 60;
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
    env.BUILDER_DB.prepare('CREATE INDEX IF NOT EXISTS idx_runtime_license_requests ON runtime_license_requests(ip_hash,created_at)'),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS runtime_license_terminals (
      user_id TEXT NOT NULL, product_code TEXT NOT NULL, terminal_hash TEXT NOT NULL,
      lease_until INTEGER NOT NULL, PRIMARY KEY(user_id,product_code)
    )`)
  ]);
  await env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS runtime_license_qa (
    qa_id TEXT PRIMARY KEY, product_code TEXT NOT NULL, platform TEXT NOT NULL,
    account_login TEXT NOT NULL, broker_server TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', expires_at TEXT NOT NULL,
    lease_seconds INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    last_verified_at TEXT, verified_count INTEGER NOT NULL DEFAULT 0
  )`).run();
}
export async function activeEntitlement(env, userId, product) {
  const spec = LICENSE_PRODUCTS[product];
  const products = [product, ...(spec.entitlement_product ? [spec.entitlement_product] : []), 'premium_membership', ...(spec.membership ? [spec.membership] : [])];
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
// Only call this after the account router has authenticated the existing admin
// key. QA grants never create orders, member entitlements or customer licenses.
export async function adminRuntimeLicenseQa(request, env) {
  const p = new URL(request.url).pathname;
  if (!['/api/admin/runtime-license-qa', '/api/admin/runtime-license-qa/update'].includes(p)) return json({ ok: false, code: 'NOT_FOUND' }, 404);
  if (!env.BUILDER_DB || !env.ACCOUNT_AUTH_SECRET) return json({ ok: false, code: 'LICENSE_UNAVAILABLE' }, 503);
  const origin = request.headers.get('Origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') return json({ ok: false, code: 'ORIGIN_MISMATCH' }, 403);
  await setup(env);
  if (p === '/api/admin/runtime-license-qa' && request.method === 'GET') {
    const r = await env.BUILDER_DB.prepare(`SELECT qa_id,product_code,platform,account_login,broker_server,status,expires_at,lease_seconds,created_at,updated_at,last_verified_at,verified_count
      FROM runtime_license_qa ORDER BY created_at DESC LIMIT 100`).all();
    return json({ ok: true, tests: r.results || [], production_products_enabled: Object.keys(LICENSE_PRODUCTS).filter(code => enabled(env,code)) });
  }
  if (request.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405);
  const body = await bodyOf(request);
  if (!body) return json({ ok: false, code: 'INVALID_REQUEST' }, 400);
  if (p.endsWith('/update')) {
    if (body.action === 'cleanup_owner_demo') {
      const qa = await env.BUILDER_DB.prepare('SELECT * FROM runtime_license_qa WHERE qa_id=?').bind(String(body.qa_id || '')).first();
      if (body.demo_confirmed !== true || !qa || LICENSE_PRODUCTS[qa.product_code]?.protocol_version !== 3 || qa.verified_count < 1 || !/demo/i.test(qa.broker_server)) return json({ok:false,code:'VERIFIED_DEMO_QA_REQUIRED'},409);
      const license = await env.BUILDER_DB.prepare(`SELECT l.* FROM runtime_licenses l JOIN users u ON u.user_id=l.user_id
        WHERE u.email='cvvcvv2025@gmail.com' AND l.product_code=? AND l.platform=? AND l.account_login=? AND l.broker_server=?`).bind(qa.product_code,qa.platform,qa.account_login,qa.broker_server).first();
      if (!license) return json({ok:false,code:'OWNER_DEMO_BINDING_NOT_FOUND'},404);
      await env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS runtime_owner_demo_cleanup (
        license_id TEXT PRIMARY KEY,qa_id TEXT NOT NULL,previous_status TEXT NOT NULL,previous_updated_at TEXT NOT NULL,cleaned_at TEXT NOT NULL
      )`).run();
      const cleaned=now(),cooldownComplete=new Date(Date.now()-REBIND_SECONDS*1000-1000).toISOString();
      await env.BUILDER_DB.batch([
        env.BUILDER_DB.prepare('INSERT OR IGNORE INTO runtime_owner_demo_cleanup(license_id,qa_id,previous_status,previous_updated_at,cleaned_at) VALUES(?,?,?,?,?)').bind(license.license_id,qa.qa_id,license.status,license.updated_at,cleaned),
        env.BUILDER_DB.prepare("UPDATE runtime_licenses SET status='revoked',updated_at=? WHERE license_id=? AND user_id=?").bind(cooldownComplete,license.license_id,license.user_id)
      ]);
      // Keep the existing terminal slot until its signed leases expire. This
      // audited admin-only test cleanup never changes normal customer cooldowns.
      return json({ok:true,action:body.action,owner_demo_binding_revoked:true,terminal_lease_slot_preserved:true});
    }
    if (!['revoke','renew'].includes(body.action)) return json({ ok: false, code: 'INVALID_ACTION' }, 400);
    const minutes = Number(body.minutes || 60);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return json({ ok: false, code: 'INVALID_DURATION' }, 400);
    const expires = new Date(Date.now() + minutes * 60000).toISOString();
    const statement = body.action === 'revoke'
      ? env.BUILDER_DB.prepare("UPDATE runtime_license_qa SET status='revoked',updated_at=? WHERE qa_id=?").bind(now(),String(body.qa_id || ''))
      : env.BUILDER_DB.prepare("UPDATE runtime_license_qa SET status='active',expires_at=?,updated_at=? WHERE qa_id=?").bind(expires,now(),String(body.qa_id || ''));
    const r = await statement.run();
    return Number(r.meta?.changes) === 1 ? json({ ok: true, action: body.action, expires_at: body.action === 'renew' ? expires : undefined }) : json({ ok: false, code: 'QA_NOT_FOUND' }, 404);
  }
  const minutes = Number(body.minutes || 60), leaseSeconds = Number(body.lease_seconds || 600);
  if (body.demo_confirmed !== true || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440 || !Number.isInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 600 || !Array.isArray(body.bindings) || body.bindings.length < 1 || body.bindings.length > (body.protocol_version===3?16:6)) return json({ ok: false, code: 'INVALID_QA_REQUEST' }, 400);
  const bindings = body.bindings.map(binding);
  if (bindings.some(b => !b || (body.protocol_version===3 ? LICENSE_PRODUCTS[b.product].protocol_version!==3 : LICENSE_PRODUCTS[b.product].kind !== 'ea') || !/demo/i.test(b.server))) return json({ ok: false, code: 'DEMO_EA_BINDING_REQUIRED' }, 400);
  // Demo in a server name is an additional input check, not proof of account
  // type. The administrator must independently confirm the broker's demo label.
  const unique = new Set(bindings.map(b => [b.product,b.platform,b.login,b.server].join('|')));
  if (unique.size !== bindings.length) return json({ ok: false, code: 'DUPLICATE_QA_BINDING' }, 400);
  const expires = new Date(Date.now() + minutes * 60000).toISOString(), created = now();
  const items = [];
  for (const b of bindings) {
    const key = hex(crypto.getRandomValues(new Uint8Array(32)));
    items.push({ ...b, qa_id: 'T5-QA-' + crypto.randomUUID(), license_key: key, token_hash: await hash(key) });
  }
  await env.BUILDER_DB.batch(items.map(b => env.BUILDER_DB.prepare(`INSERT INTO runtime_license_qa
    (qa_id,product_code,platform,account_login,broker_server,token_hash,status,expires_at,lease_seconds,created_at,updated_at)
    VALUES (?,?,?,?,?,?,'active',?,?,?,?)`).bind(b.qa_id,b.product,b.platform,b.login,b.server,b.token_hash,expires,leaseSeconds,created,created)));
  return json({ ok: true, tests: items.map(b => ({ qa_id: b.qa_id, product_code: b.product, platform: b.platform, account_login: b.login, broker_server: b.server, license_key: b.license_key, expires_at: expires, lease_seconds: leaseSeconds })), production_activation_changed: false });
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
    const grants=await env.BUILDER_DB.prepare("SELECT product_code FROM product_entitlements WHERE user_id=? AND status='active' AND starts_at<=? AND (expires_at IS NULL OR expires_at>?)").bind(user.user_id,now(),now()).all();
    const rights=new Set((grants.results||[]).map(g=>g.product_code));
    const entitled=new Set(Object.entries(LICENSE_PRODUCTS).filter(([code,spec])=>[code,spec.entitlement_product,'premium_membership',spec.membership].some(p=>p&&rights.has(p))).map(([code])=>code));
    return json({ ok: true, products: Object.entries(LICENSE_PRODUCTS).filter(([code])=>entitled.has(code)).map(([code, v]) => ({ code, kind: v.kind, enabled: enabled(env, code), platforms: v.platforms,
      protocol_version: LICENSE_PRODUCTS[code].protocol_version || 1,
      offline_grace_seconds: hardened(env,code) ? V2_LEASE_SECONDS : 86400,
      rebind_cooldown_seconds: hardened(env,code) ? REBIND_SECONDS : 0 })), licenses: rows.results || [], owner_profile_supported: user.email === 'cvvcvv2025@gmail.com', install_package_supported:true, legacy_downloads_require_activation: false });
  }
  const body = await bodyOf(request);
  if (!body) return json({ ok: false, code: 'INVALID_REQUEST' }, 400);
  if (!verifying && p.endsWith('/revoke')) {
    // Repeated revoke calls must not move the cooldown timestamp.
    const r = await env.BUILDER_DB.prepare("UPDATE runtime_licenses SET status='revoked',updated_at=? WHERE license_id=? AND user_id=? AND status='active'").bind(now(), String(body.license_id || ''), user.user_id).run();
    return Number(r.meta?.changes) ? json({ ok: true }) : json({ ok: false, code: 'LICENSE_NOT_FOUND' }, 404);
  }
  const b = binding(body);
  if (!b) return json({ ok: false, code: 'INVALID_BINDING' }, 400);
  if (!verifying && !enabled(env, b.product)) return json({ ok: false, code: 'LICENSE_RELEASE_NOT_ENABLED', error: '当前产品授权版尚未完成验收，暂不可激活。' }, 409);
  if (!verifying) {
    const entitlement = await activeEntitlement(env, user.user_id, b.product);
    if (hardened(env,b.product) && body.license_policy_version !== (LICENSE_PRODUCTS[b.product]?.protocol_version===3?'signed-v3-20261028':'terminal-v2-20261023')) return json({ok:false,code:'LICENSE_POLICY_REQUIRED'},400);
    if (!entitlement) return json({ ok: false, code: 'ENTITLEMENT_REQUIRED' }, 403);
    // One active trading account per product. Revoke first to replace a binding;
    // renewing membership never changes the stored client credential.
    const v2 = hardened(env,b.product), token = hex(crypto.getRandomValues(new Uint8Array(32))), id = 'T5-L-' + crypto.randomUUID();
    const cooldownCutoff = new Date(Date.now() - REBIND_SECONDS * 1000).toISOString();
    const r = await env.BUILDER_DB.prepare(`INSERT INTO runtime_licenses
      (license_id,user_id,product_code,platform,account_login,broker_server,token_hash,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,'active',?,?) ON CONFLICT(user_id,product_code) DO UPDATE SET
      license_id=excluded.license_id,platform=excluded.platform,account_login=excluded.account_login,
      broker_server=excluded.broker_server,token_hash=excluded.token_hash,status='active',updated_at=excluded.updated_at
      WHERE runtime_licenses.status='revoked' AND (?=0 OR runtime_licenses.updated_at<=?)`)
      .bind(id, user.user_id, b.product, b.platform, b.login, b.server, await hash(token), now(), now(), v2 ? 1 : 0, cooldownCutoff).run();
    if (!Number(r.meta?.changes)) {
      const current = await env.BUILDER_DB.prepare('SELECT status,updated_at FROM runtime_licenses WHERE user_id=? AND product_code=?').bind(user.user_id,b.product).first();
      if (v2 && current?.status === 'revoked') return json({ ok:false, code:'REBIND_COOLDOWN', retry_at:new Date(Date.parse(current.updated_at) + REBIND_SECONDS * 1000).toISOString() },409);
      return json({ ok: false, code: 'ACTIVE_BINDING_EXISTS', error: '已有激活账号。更换前请先撤销原授权。' }, 409);
    }
    return json({ ok: true, license_id: id, license_key: token, expires_at: entitlement.expires_at, protocol_version:LICENSE_PRODUCTS[b.product].protocol_version || 1, offline_grace_seconds: v2 ? V2_LEASE_SECONDS : 86400 });
  }
  const nonce = String(body.nonce || '');
  if (!/^[a-f0-9]{32}$/.test(nonce)) return json({ ok: false, code: 'INVALID_NONCE' }, 400);
  // QA credentials can exercise the new client while production remains closed.
  // Explicit v2 clients receive v2 leases even on a legacy-enabled release.
  const v2 = hardened(env,b.product) || body.protocol_version === 2;
  if (v2 && (body.protocol_version !== 2 || !/^[a-f0-9]{64}$/.test(String(body.terminal_id || '')))) return json({ok:false,code:'CLIENT_UPGRADE_REQUIRED',allow_new_entries:false,manage_existing_positions:true},403);
  // Bound failed lookups as well as successful checks. Never store client keys,
  // plaintext IP addresses or account credentials in the request ledger.
  const ipHash = await hash(env.ACCOUNT_AUTH_SECRET + ':license:' + (request.headers.get('CF-Connecting-IP') || 'unknown'));
  const cutoff = new Date(Date.now() - 60000).toISOString();
  await env.BUILDER_DB.prepare('DELETE FROM runtime_license_requests WHERE created_at<?').bind(new Date(Date.now() - 86400000).toISOString()).run();
  const rate = await env.BUILDER_DB.prepare(`INSERT INTO runtime_license_requests(ip_hash,created_at)
    SELECT ?,? WHERE (SELECT COUNT(*) FROM runtime_license_requests WHERE ip_hash=? AND created_at>?)<60`).bind(ipHash, now(), ipHash, cutoff).run();
  if (!Number(rate.meta?.changes)) return json({ ok: false, code: 'RATE_LIMITED' }, 429);
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer /, '');
  const tokenHash = /^[a-f0-9]{64}$/.test(token) ? await hash(token) : '';
  const qa = tokenHash ? await env.BUILDER_DB.prepare('SELECT * FROM runtime_license_qa WHERE token_hash=?').bind(tokenHash).first() : null;
  const matches = item => item && item.status === 'active' && item.product_code === b.product && item.platform === b.platform && item.account_login === b.login && item.broker_server === b.server;
  const qaAllowed = matches(qa) && Date.parse(qa.expires_at) > Date.now();
  const license = !qa && tokenHash && enabled(env,b.product) ? await env.BUILDER_DB.prepare('SELECT * FROM runtime_licenses WHERE token_hash=?').bind(tokenHash).first() : null;
  const entitlement = qaAllowed ? { expires_at: qa.expires_at } : matches(license) ? await activeEntitlement(env, license.user_id, b.product) : null;
  if (qaAllowed) await env.BUILDER_DB.prepare('UPDATE runtime_license_qa SET last_verified_at=?,verified_count=verified_count+1 WHERE qa_id=?').bind(now(),qa.qa_id).run();
  const issued = Math.floor(Date.now() / 1000), expiry = entitlement?.expires_at ? Math.floor(Date.parse(entitlement.expires_at) / 1000) : 0;
  const lease = entitlement ? Math.min(issued + (v2 ? Math.min(qaAllowed ? qa.lease_seconds : V2_LEASE_SECONDS,V2_LEASE_SECONDS) : qaAllowed ? qa.lease_seconds : 86400), expiry || Infinity) : 0;
  if (entitlement && v2) {
    // Atomic compare-and-swap; no read-then-write race. Keep the slot across key
    // rotation. It cannot move to a different terminal until ALL issued leases
    // for this slot have elapsed. Same-terminal refreshes must never shorten it.
    const owner = qaAllowed ? 'qa:' + qa.qa_id : license.user_id;
    const terminalHash = await hash(env.ACCOUNT_AUTH_SECRET + ':terminal:' + body.terminal_id);
    const slot = await env.BUILDER_DB.prepare(`INSERT INTO runtime_license_terminals(user_id,product_code,terminal_hash,lease_until)
      VALUES (?,?,?,?) ON CONFLICT(user_id,product_code) DO UPDATE SET
      terminal_hash=excluded.terminal_hash,lease_until=MAX(runtime_license_terminals.lease_until,excluded.lease_until)
      WHERE runtime_license_terminals.terminal_hash=excluded.terminal_hash OR runtime_license_terminals.lease_until<=?`)
      .bind(owner,b.product,terminalHash,lease,issued).run();
    if (!Number(slot.meta?.changes)) return json({ok:false,code:'TERMINAL_IN_USE',allow_new_entries:false,manage_existing_positions:true},409);
  }
  const state = entitlement ? 'active' : 'denied';
  const wire = [v2 ? 'T5L2' : 'T5L1', nonce, b.product, b.platform, b.login, issued, expiry, lease, state,...(v2 ? [body.terminal_id] : [])].join('|');
  if (request.headers.get('Accept') === 'text/plain') return new Response(wire, { status: entitlement ? 200 : 403, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  return json({ ok: Boolean(entitlement), code: entitlement ? 'LICENSE_ACTIVE' : 'LICENSE_DENIED', nonce, server_time: issued, expires_at: expiry, lease_until: lease, allow_new_entries: Boolean(entitlement), manage_existing_positions: true }, entitlement ? 200 : 403);
}
