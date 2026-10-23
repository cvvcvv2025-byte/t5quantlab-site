import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import runtime from '../src/runtime-worker.js';
import { reserveOperation, settleOperation, reconcileBuilderOperations } from '../src/builder-lifecycle.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't5-delivery-'));
const dbfile = path.join(dir, 'test.sqlite');
function sql(items) {
  const p = spawnSync('python3', ['scripts/test-d1.py', dbfile], { input: JSON.stringify(items), encoding: 'utf8' });
  if (p.status) throw new Error(p.stderr);
  return JSON.parse(p.stdout);
}
const db = {
  prepare(query) { return { sql: query, values: [], bind(...v) { this.values = v; return this; }, async run() { return sql([this])[0]; }, async all() { return sql([this])[0]; }, async first() { return sql([this])[0].results[0] || null; } }; },
  async batch(items) { return sql(items); }
};
const run = (query, ...values) => db.prepare(query).bind(...values).run();
const first = async (query, ...values) => db.prepare(query).bind(...values).first();
const objects = new Map();
const bucket = {
  async put(key, value, options = {}) { objects.set(key, { bytes: Buffer.from(value instanceof ArrayBuffer ? new Uint8Array(value) : value), metadata: options.customMetadata || {}, http: options.httpMetadata || {} }); },
  async get(key) { const o = objects.get(key); return o && { async text() { return o.bytes.toString(); }, async arrayBuffer() { return Uint8Array.from(o.bytes).buffer; }, body: o.bytes, writeHttpMetadata(h) { h.set('Content-Type', o.http.contentType || 'text/plain'); } }; },
  async head(key) { const o = objects.get(key); return o ? { size: o.bytes.length, customMetadata: o.metadata } : null; },
  async list() { return { objects: [] }; }
};
const env = { BUILDER_DB: db, USER_CODE_BUCKET: bucket, ACCOUNT_AUTH_SECRET: 'test-account-only', AUDIT_HASH_SALT: 'test-only-salt-long-enough',
  RESEND_API_KEY: 'fake', AUTH_EMAIL_FROM: 'test@example.invalid', OPENAI_API_KEY: 'fake', BUILDER_ACCESS_KEY: 'test-admin-only',
  PAYPAL_CLIENT_ID: 'fake', PAYPAL_CLIENT_SECRET: 'fake', PAYPAL_WEBHOOK_ID: 'fake', PAYPAL_ENVIRONMENT: 'live',
  T5_BUILDER_PASS_PRICE_USD_MINOR: '1490', T5_INDICATOR_MEMBERSHIP_PRICE_USD_MINOR: '1390', T5_PREMIUM_MEMBERSHIP_PRICE_USD_MINOR: '5990' };
let aiCalls = 0, failAI = false, pauseAI = null;
const ppOrders = new Map();
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  url = String(url);
  if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'fake-oauth' });
  if (url.endsWith('/v2/checkout/orders')) {
    const body = JSON.parse(options.body), id = 'PP-' + ppOrders.size;
    ppOrders.set(id, body.purchase_units[0]);
    return Response.json({ id, links: [{ rel: 'approve', href: 'https://example.invalid/approve/' + id }] });
  }
  if (/\/v2\/checkout\/orders\/PP-\d+\/capture$/.test(url)) {
    const id = url.split('/').at(-2), unit = ppOrders.get(id);
    return Response.json({ id, purchase_units: [{ ...unit, payments: { captures: [{ id: 'CAP-' + id, status: 'COMPLETED', amount: unit.amount }] } }] });
  }
  if (url.endsWith('/v1/responses')) {
    aiCalls++; if (pauseAI) await pauseAI;
    if (failAI) throw new Error('simulated provider outage');
    const body = JSON.parse(options.body), schema = body.text.format.schema;
    const result = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, v.type === 'array' ? [] : v.enum?.[0] || 'test-value']));
    if ('modified_source' in result) { result.status = 'success'; result.modified_source = 'void OnTick(){}'; result.version = 'v1.1'; }
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] }] });
  }
  throw new Error('Unexpected external request: ' + url);
};
let session = 'a';
async function call(route, body, extra = {}) {
  const headers = { Cookie: 't5_session=' + session, 'CF-Connecting-IP': '192.0.2.1', ...extra };
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const r = await runtime.fetch(new Request('https://example.invalid' + route, { method: body ? 'POST' : 'GET', headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined }), env, {});
  return { status: r.status, data: await r.json() };
}
const hash = x => createHash('sha256').update(x).digest('hex');
try {
  // Use the shipped schema and the full routing stack, not SQL-only replicas.
  const schema = fs.readFileSync('builder-schema.sql', 'utf8');
  sql(schema.replace(/^--.*$/gm, '').split(';').filter(s => s.trim()).map(s => ({ sql: s })));
  const now = new Date().toISOString(), future = new Date(Date.now() + 86400000).toISOString();
  for (const id of ['a', 'b']) {
    await run("INSERT INTO users (user_id,email,email_verified_at,status,created_at,updated_at) VALUES (?,?,?,'active',?,?)", id, id + '@example.invalid', now, now, now);
    await run('INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)', hash(id), id, now, future);
  }
  const purchase = async product => {
    let r = await call('/api/orders/create', { product_code: product, currency: 'USD', terms_accepted: true, terms_version: 'refund-v2-2026-10-20' });
    assert.equal(r.status, 200, JSON.stringify(r)); const order = r.data.order, headers = { 'X-Order-Token': order.order_token };
    r = await call('/api/payment/paypal/create', { order_id: order.order_id }, headers); assert.equal(r.status, 200, JSON.stringify(r));
    const captureBody = { order_id: order.order_id, paypal_order_id: r.data.paypal_order_id };
    r = await call('/api/payment/paypal/capture', captureBody, headers); assert.equal(r.status, 200, JSON.stringify(r));
    r = await call('/api/payment/paypal/capture', captureBody, headers); assert.equal(r.status, 200); assert.equal(r.data.duplicate, true);
    return { order, headers };
  };
  let missing = await call('/api/orders/create', { product_code: 'premium_membership', currency: 'USD', terms_accepted: true, terms_version: 'refund-v2-2026-10-20' });
  assert.equal(missing.status, 503); assert.equal(missing.data.code, 'DELIVERY_NOT_READY');
  // Metadata fixtures allow checkout; the existing artifact tests verify byte hashes separately.
  const catalogSource = fs.readFileSync('src/account-worker.js', 'utf8');
  for (const match of catalogSource.matchAll(/r2Key: "([^"]+)"[\s\S]*?sha256: "([^"]+)"/g)) {
    const version = match[1].split('/').at(-2);
    await bucket.put(match[1], 'fixture', { customMetadata: { sha256: match[2], version } });
  }
  const stagedKey = [...objects.keys()].find(key => key.includes('/structure-decision-map/'));
  assert.ok(stagedKey, 'staged Decision Map must be registered');
  objects.delete(stagedKey);
  const mt5Key = [...objects.keys()].find(key => key.includes('/structure-decision-map-mt5/'));
  assert.ok(mt5Key);
  objects.delete(mt5Key);
  for (const slug of ['mtf-structure-panel-mt5', 'neckline-mtf-mt5', 'progress-candle-mt5']) {
    const key = [...objects.keys()].find(key => key.includes('/' + slug + '/'));
    assert.ok(key, 'MT5 artifact registered: ' + slug); objects.delete(key);
  }
  const stagedCatalog = await call('/api/products/delivery');
  const staged = stagedCatalog.data.artifacts.find(item => item.slug === 'structure-decision-map');
  assert.equal(staged.ready, false, 'unuploaded package must stay unavailable');
  assert.equal(staged.membership_required, false, 'staged package is not yet a promised membership delivery');
  assert.equal(stagedCatalog.data.artifacts.find(item => item.slug === 'structure-decision-map-mt5').ready, false);
  for (const slug of ['mtf-structure-panel-mt5', 'neckline-mtf-mt5', 'progress-candle-mt5']) {
    const port = stagedCatalog.data.artifacts.find(item => item.slug === slug);
    assert.equal(port.ready, false); assert.equal(port.membership_required, false);
  }
  const heldIndicatorOrder = await call('/api/orders/create', { product_code: 'indicator_membership', currency: 'USD', terms_accepted: true, terms_version: 'refund-v2-2026-10-20' });
  assert.equal(heldIndicatorOrder.status,503);assert.equal(heldIndicatorOrder.data.code,'DELIVERY_NOT_READY');
  assert(stagedCatalog.data.artifacts.filter(x=>x.kind==='indicator').every(x=>x.performance_qualified===false && x.download_allowed===false));
  const premium = await purchase('premium_membership');
  let r = await call('/api/orders/refund-eligibility?order_id=' + premium.order.order_id, null, premium.headers);
  assert.equal(r.data.refund_eligible_under_t5_policy, true);
  const entitlement = await first("SELECT entitlement_id FROM product_entitlements WHERE user_id='a' AND product_code='premium_membership'");
  await run('INSERT INTO member_download_events (event_id,user_id,entitlement_id,source_order_id,artifact_code,artifact_version,created_at) VALUES (?,?,?,?,?,?,?)', 'dl-test', 'a', entitlement.entitlement_id, premium.order.order_id, 'range_aggressive_mt4_mt5', '0.3.6', now);
  r = await call('/api/orders/refund-eligibility?order_id=' + premium.order.order_id, null, premium.headers);
  assert.equal(r.data.refund_eligible_under_t5_policy, false); assert.equal(r.data.successful_member_downloads, 1);
  await run("UPDATE product_entitlements SET source_order_id='renewal-order' WHERE entitlement_id=?", entitlement.entitlement_id);
  r = await call('/api/orders/refund-eligibility?order_id=' + premium.order.order_id, null, premium.headers);
  assert.equal(r.data.successful_member_downloads, 1, 'renewal must not erase old fulfillment');
  session = 'b'; r = await call('/api/orders/refund-eligibility?order_id=' + premium.order.order_id, null, premium.headers); assert.equal(r.status, 403); session = 'a';
  const pass = await purchase('code_workshop_single');
  const summary = await call('/api/account/summary'); assert.equal(summary.data.builder.analyze_remaining, 3); assert.equal(summary.data.builder.modify_remaining, 2);
  async function upload() { const form = new FormData(); form.set('source', new File(['void OnTick(){}'], 'test.mq5')); form.set('ownership', 'true'); form.set('changeRequest', 'Add a display label'); const out = await call('/api/builder/upload', form); assert.equal(out.status, 200, JSON.stringify(out)); assert.equal(out.data.projectToken, undefined); return out.data.projectId; }
  const id = await upload();
  failAI = true; r = await call('/api/builder/analyze', { projectId: id }); assert.equal(r.status, 502);
  assert.equal((await call('/api/account/summary')).data.builder.analyze_remaining, 3, 'provider failure restores quota'); failAI = false;
  let release; pauseAI = new Promise(resolve => { release = resolve; });
  const processing = call('/api/builder/analyze', { projectId: id });
  // Let the first request reach its asynchronous provider call.
  const deadline = Date.now() + 20000;
  while (aiCalls < 2) { if (Date.now() > deadline) { console.error('Concurrent request result', await Promise.race([processing, Promise.resolve('still pending')])); throw new Error('Provider call not reached'); } await new Promise(resolve => setTimeout(resolve, 1)); }
  const duplicate = await call('/api/builder/analyze', { projectId: id }); assert.equal(duplicate.status, 409); release(); pauseAI = null;
  r = await processing; assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal((await call('/api/account/summary')).data.builder.analyze_remaining, 2);
  r = await call('/api/builder/modify', { projectId: id, confirmed: true }); assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal((await call('/api/account/summary')).data.builder.modify_remaining, 1);
  r = await call('/api/account/builder-projects'); assert.equal(r.data.projects[0].project_id, id);
  r = await call('/api/builder/status?project_id=' + id); assert.equal(r.data.project.status, 'modified'); assert.equal(r.data.running, false);
  const raw = await runtime.fetch(new Request('https://example.invalid/api/builder/download?project_id=' + id + '&type=source', { headers: { Cookie: 't5_session=a' } }), env, {});
  assert.equal(raw.status, 200); assert.equal(await raw.text(), 'void OnTick(){}');
  session = 'b'; r = await call('/api/builder/status?project_id=' + id); assert.equal(r.status, 403); r = await call('/api/account/builder-projects'); assert.equal(r.data.projects.length, 0); session = 'a';
  const grant = (await call('/api/account/summary')).data.builder;
  const abandoned = await upload(); const op = await reserveOperation(env, grant, abandoned, 'analyze');
  assert(op.id); await run('UPDATE builder_operations SET created_at=? WHERE operation_id=?', '2020-01-01T00:00:00Z', op.id);
  await reconcileBuilderOperations(env); await reconcileBuilderOperations(env);
  assert.equal((await call('/api/account/summary')).data.builder.analyze_remaining, 2, 'abandoned reservation refunded once');
  await settleOperation(env, op, false); assert.equal((await call('/api/account/summary')).data.builder.analyze_remaining, 2);
  // Force an exception before the inner handler's try/catch: D1 schema fails after reservation.
  const brokenId = await upload(); const originalBatch = db.batch;
  db.batch = async items => { if (items.some(x => x.sql.includes('CREATE TABLE IF NOT EXISTS projects'))) throw new Error('simulated schema outage'); return originalBatch(items); };
  r = await call('/api/builder/analyze', { projectId: brokenId }); db.batch = originalBatch;
  assert.equal(r.status, 503); assert.equal((await call('/api/account/summary')).data.builder.analyze_remaining, 2);
  r = await call('/api/products/delivery'); assert.equal(r.data.ready_count, 7); assert.equal(r.data.total_count, 12);
  // Customer support is usable without login and protects each private reply by its receipt token.
  session = '';
  r = await call('/api/support/tickets', { email: 'customer@example.invalid', message: 'I cannot download the purchased product.', consent: true });
  assert.equal(r.status, 200, JSON.stringify(r)); const ticket = r.data;
  r = await call('/api/support/tickets', null, { 'X-Support-Token': ticket.query_token }); assert.equal(r.data.ticket.status, 'open');
  r = await call('/api/support/tickets', null, { 'X-Support-Token': '0'.repeat(64) }); assert.equal(r.status, 403);
  r = await call('/api/admin/support/reply', { ticket_id: ticket.ticket_id, reply: 'Please retry the validated download.' }); assert.equal(r.status, 403);
  r = await call('/api/admin/support/reply', { ticket_id: ticket.ticket_id, reply: 'Please retry the validated download.' }, { 'X-Builder-Access-Key': env.BUILDER_ACCESS_KEY }); assert.equal(r.status, 200);
  r = await call('/api/support/tickets', null, { 'X-Support-Token': ticket.query_token }); assert(r.data.ticket.reply.includes('validated'));
  session = 'a';
  // A grant revoked or expired after payment cannot obtain member files.
  await run("UPDATE product_entitlements SET status='revoked' WHERE user_id='a'");
  r = await call('/api/member/eas/range-aggressive/download'); assert.equal(r.status, 403);
  await run("UPDATE product_entitlements SET status='active', expires_at='2020-01-01T00:00:00Z' WHERE user_id='a'");
  r = await call('/api/member/eas/range-aggressive/download'); assert.equal(r.status, 403);
  console.log('Delivery behavior OK: full-stack simulated payment, idempotent capture, immutable refund evidence, quota failure/exception/concurrency/reconciliation, account recovery and isolation. No live provider requests.');
} finally { globalThis.fetch = originalFetch; fs.rmSync(dir, { recursive: true, force: true }); }
