import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import runtime from '../src/runtime-worker.js';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't5-license-'));
const dbfile = path.join(dir, 'db.sqlite');
function sql(items) {
  const p = spawnSync('python3', ['scripts/test-d1.py', dbfile], { input: JSON.stringify(items), encoding: 'utf8' });
  if (p.status) throw Error(p.stderr);
  return JSON.parse(p.stdout);
}
const db = {
  prepare(query) { return { sql: query, values: [], bind(...values) { this.values = values; return this; }, async run() { return sql([this])[0]; }, async all() { return sql([this])[0]; }, async first() { return sql([this])[0].results[0] || null; } }; },
  async batch(items) { return sql(items); }
};
const run = (q, ...v) => db.prepare(q).bind(...v).run();
const hash = x => createHash('sha256').update(x).digest('hex');
const env = { BUILDER_DB: db, ACCOUNT_AUTH_SECRET: 'local-only-secret', BUILDER_ACCESS_KEY: 'local-admin-key', RUNTIME_LICENSE_PRODUCTS: 'range_aggressive_mt4_mt5,trend_capture_mt5,mtf_structure_panel_mt4' };
let session = 'a', token;
const binding = { product_code: 'range_aggressive_mt4_mt5', platform: 'MT5', account_login: '123456', broker_server: 'TMGM-Demo' };
async function call(route, body, headers = {}) {
  const r = await runtime.fetch(new Request('https://example.invalid' + route, { method: body ? 'POST' : 'GET', headers: { Cookie: 't5_session=' + session, 'CF-Connecting-IP': '192.0.2.10', 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined }), env, {});
  const text = await r.text();
  return { status: r.status, text, data: text.startsWith('{') ? JSON.parse(text) : null };
}
const verify = (patch = {}, headers = {}) => call('/api/licenses/verify', { ...binding, nonce: 'a'.repeat(32), ...patch }, { Authorization: 'Bearer ' + token, ...headers });
try {
  // Initialize through the real router and schema migration path.
  await call('/api/auth/me');
  const now = new Date().toISOString(), future = new Date(Date.now() + 3600000).toISOString();
  for (const id of ['a','b']) {
    await run("INSERT INTO users(user_id,email,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)", id, id + '@example.invalid', now, now, now);
    await run('INSERT INTO auth_sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)', hash(id), id, now, future);
  }
  const grant = (product, expiry = future) => run(`INSERT INTO product_entitlements(entitlement_id,user_id,product_code,status,starts_at,expires_at,source,created_at,updated_at)
    VALUES(?, 'a', ?, 'active', ?, ?, 'test', ?, ?) ON CONFLICT(user_id,product_code) DO UPDATE SET status='active',expires_at=excluded.expires_at`, 'E-' + product, product, now, expiry, now, now);
  let r = await call('/api/account/runtime-licenses', binding); assert.equal(r.status, 403, 'nonmember cannot activate');
  await grant('indicator_membership');
  r = await call('/api/account/runtime-licenses', binding); assert.equal(r.status, 403, 'indicator tier cannot activate EA');
  await grant('premium_membership');
  env.RUNTIME_LICENSE_PRODUCTS = '';
  r = await call('/api/account/runtime-licenses', binding); assert.equal(r.status, 409, 'unaccepted release remains disabled');
  env.RUNTIME_LICENSE_PRODUCTS = 'range_aggressive_mt4_mt5,trend_capture_mt5,mtf_structure_panel_mt4';
  r = await call('/api/account/runtime-licenses', { ...binding, product_code: 'mtf_structure_panel_mt4', platform: 'MT4' });
  assert.equal(r.status, 409, 'indicator cannot be enabled before a signed indicator client exists');
  r = await call('/api/account/runtime-licenses', binding, { Origin: 'https://attacker.invalid' }); assert.equal(r.status, 403);
  r = await call('/api/account/runtime-licenses', binding); assert.equal(r.status, 200); token = r.data.license_key;
  const licenseId = r.data.license_id;
  assert.match(token, /^[a-f0-9]{64}$/);
  r = await call('/api/account/runtime-licenses', binding); assert.equal(r.status, 409, 'duplicate activation cannot reset or rotate a live key');
  r = await call('/api/account/runtime-licenses'); assert.equal(r.status, 200); assert.ok(!r.text.includes(token)); assert.ok(!r.text.includes(hash(token)), 'no credential/hash in account list');
  r = await verify(); assert.equal(r.status, 200); assert.equal(r.data.manage_existing_positions, true);
  assert.equal(r.data.expires_at, Math.floor(Date.parse(future) / 1000)); assert.equal(r.data.lease_until, r.data.expires_at, 'offline lease never exceeds membership expiry');
  r = await verify({}, { Accept: 'text/plain' }); assert.match(r.text, /^T5L1\|a{32}\|range_aggressive_mt4_mt5\|MT5\|123456\|\d+\|\d+\|\d+\|active$/);
  for (const patch of [{ account_login: '654321' }, { broker_server: 'TMGM-Live' }, { platform: 'MT4' }, { product_code: 'trend_capture_mt5' }]) {
    r = await verify(patch); assert.equal(r.status, 403, 'account/server/platform/product substitution denied');
  }
  session = 'b'; r = await call('/api/account/runtime-licenses/revoke', { license_id: licenseId }); assert.equal(r.status, 404);
  r = await call('/api/account/runtime-licenses'); assert.equal(r.data.licenses.length, 0, 'account isolation');
  session = 'a';
  await run("UPDATE product_entitlements SET expires_at='2020-01-01T00:00:00.000Z' WHERE product_code='premium_membership'");
  r = await verify(); assert.equal(r.status, 403); assert.equal(r.data.allow_new_entries, false); assert.equal(r.data.manage_existing_positions, true);
  await grant('premium_membership', new Date(Date.now() + 30 * 86400000).toISOString());
  r = await verify(); assert.equal(r.status, 200, 'renewal works with the existing key'); assert.equal(r.data.lease_until - r.data.server_time, 86400);
  await run("UPDATE product_entitlements SET status='revoked' WHERE product_code='premium_membership'");
  r = await verify(); assert.equal(r.status, 403, 'refund/revocation removes EA runtime entitlement');
  await grant('range_aggressive_mt4_mt5', null);
  r = await verify(); assert.equal(r.status, 200, 'independent product grant remains valid'); assert.equal(r.data.expires_at, 0); assert.equal(r.data.lease_until - r.data.server_time, 86400);
  await run("UPDATE users SET status='suspended' WHERE user_id='a'");
  r = await verify(); assert.equal(r.status, 403, 'suspended website user cannot verify');
  await run("UPDATE users SET status='active' WHERE user_id='a'");
  r = await call('/api/account/runtime-licenses/revoke', { license_id: licenseId }); assert.equal(r.status, 200);
  r = await verify(); assert.equal(r.status, 403);
  r = await call('/api/account/runtime-licenses', { ...binding, account_login: '999999' }); assert.equal(r.status, 200, 'revoked account may be replaced');
  assert.notEqual(r.data.license_key, token); r = await verify(); assert.equal(r.status, 403, 'old key stays invalid after replacement');
  const stored = await db.prepare('SELECT token_hash FROM runtime_licenses').first(); assert.notEqual(stored.token_hash, token);
  session = ''; r = await call('/api/account/runtime-licenses'); assert.equal(r.status, 401);
  r = await verify({ nonce: 'bad' }); assert.equal(r.status, 400);
  // Native acceptance QA can proceed while customer activation stays closed.
  // Its grants are separate from paid membership and never create orders.
  env.RUNTIME_LICENSE_PRODUCTS = '';
  const qaBody = { demo_confirmed: true, minutes: 60, lease_seconds: 600, bindings: [binding] };
  const admin = { 'X-Builder-Access-Key': 'local-admin-key' };
  r = await call('/api/admin/runtime-license-qa', qaBody); assert.equal(r.status,403);
  r = await call('/api/admin/runtime-license-qa', { ...qaBody, demo_confirmed: false },admin); assert.equal(r.status,400);
  r = await call('/api/admin/runtime-license-qa', { ...qaBody, bindings: [{ ...binding, broker_server: 'Broker-Live' }] },admin); assert.equal(r.status,400);
  r = await call('/api/admin/runtime-license-qa', { ...qaBody, bindings: [binding,binding] },admin); assert.equal(r.status,400);
  r = await call('/api/admin/runtime-license-qa', qaBody,{...admin,Origin:'https://other.invalid'}); assert.equal(r.status,403);
  r = await call('/api/admin/runtime-license-qa',qaBody,admin); assert.equal(r.status,200);
  const test = r.data.tests[0]; token=test.license_key; assert.equal(r.data.production_activation_changed,false);
  r = await verify(); assert.equal(r.status,200); assert.equal(r.data.lease_until-r.data.server_time,600);
  r = await verify({}, {Accept:'text/plain'}); assert.match(r.text,/\|active$/);
  r = await verify({account_login:'888888'}); assert.equal(r.status,403);
  r = await verify({broker_server:'Other-Demo'}); assert.equal(r.status,403);
  r = await verify({platform:'MT4'}); assert.equal(r.status,403);
  r = await call('/api/admin/runtime-license-qa',null,admin); assert.ok(!r.text.includes(token));assert.ok(!r.text.includes(hash(token)));
  assert.equal(r.data.tests[0].verified_count,2); assert.ok(r.data.tests[0].last_verified_at); assert.deepEqual(r.data.production_products_enabled,[]);
  r = await call('/api/admin/runtime-license-qa/update',{qa_id:test.qa_id,action:'revoke'},admin); assert.equal(r.status,200);
  r = await verify(); assert.equal(r.status,403);
  r = await call('/api/admin/runtime-license-qa/update',{qa_id:test.qa_id,action:'renew',minutes:1},admin); assert.equal(r.status,200);
  r = await verify(); assert.equal(r.status,200);assert.ok(r.data.lease_until-r.data.server_time<=60);
  await run("UPDATE runtime_license_qa SET expires_at='2020-01-01T00:00:00.000Z' WHERE qa_id=?",test.qa_id);
  r = await verify(); assert.equal(r.status,403);
  session='a';r=await call('/api/account/runtime-licenses',binding);assert.equal(r.status,409,'QA never opens customer activation');
  const indicatorQa={...qaBody,bindings:[{...binding,product_code:'mtf_structure_panel_mt4',platform:'MT4'}]};
  r=await call('/api/admin/runtime-license-qa',indicatorQa,admin);assert.equal(r.status,400);
  // Fill local rate bucket without making external calls.
  await run('DELETE FROM runtime_license_requests');
  for (let i = 0; i < 60; i++) r = await verify();
  r = await verify(); assert.equal(r.status, 429);
  console.log('Runtime licensing and admin QA: tier/account isolation, expiry, renewal, revocation, capped leases, private handshake evidence, production-disabled QA and rate limits passed.');
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
