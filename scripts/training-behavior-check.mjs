import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { TRAINING_CONTENT_KEY } from '../src/training-worker.js';
const course = JSON.parse(fs.readFileSync(process.argv[2] || 'scripts/fixtures/training-test-course.json','utf8'));
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
  PAYPAL_CLIENT_ID: 'fake', PAYPAL_CLIENT_SECRET: 'fake', PAYPAL_WEBHOOK_ID: 'fake', PAYPAL_ENVIRONMENT: 'sandbox', T5_TRAINING_DELIVERY_ENABLED: 'true', T5_TRAINING_SANDBOX_CHECKOUT: 'true',
  T5_BUILDER_PASS_PRICE_USD_MINOR: '1490', T5_INDICATOR_MEMBERSHIP_PRICE_USD_MINOR: '1390', T5_PREMIUM_MEMBERSHIP_PRICE_USD_MINOR: '5990' };
let aiCalls = 0, failAI = false, pauseAI = null;
const ppOrders = new Map();
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  url = String(url);
  if (url.endsWith('/v1/notifications/verify-webhook-signature')) return Response.json({ verification_status: 'SUCCESS' });
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
  if (/\/v2\/payments\/captures\/CAP-PP-\d+\/refund$/.test(url)) return Response.json({id:'REF-ADMIN-TEST',status:'COMPLETED'});
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
  const headers = { Origin: 'https://example.invalid', Cookie: 't5_session=' + session, 'CF-Connecting-IP': '192.0.2.1', ...extra };
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const r = await runtime.fetch(new Request('https://example.invalid' + route, { method: body ? 'POST' : 'GET', headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined }), env, {});
  return { status: r.status, data: await r.json() };
}
const hash = x => createHash('sha256').update(x).digest('hex');
try {
  await bucket.put(TRAINING_CONTENT_KEY, JSON.stringify(course));
  sql(fs.readFileSync('builder-schema.sql', 'utf8').replace(/^--.*$/gm, '').split(';').filter(s => s.trim()).map(sql => ({ sql })));
  const now = new Date().toISOString(), future = new Date(Date.now() + 86400000).toISOString();
  for (const id of ['a', 'b']) {
    await run("INSERT INTO users (user_id,email,email_verified_at,status,created_at,updated_at) VALUES (?,?,?,'active',?,?)", id, id + '@example.invalid', now, now, now);
    await run('INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)', hash(id), id, now, future);
  }
  let r = await call('/api/training/breakout/course', null, { Cookie: '' }); assert.equal(r.status, 401);
  assert.equal((await call('/api/training/breakout/course')).status, 403);
  const orderBody = { product_code: 'training_breakout_v1', currency: 'USD', amount_minor: 1, terms_accepted: true, terms_version: 'training-v1-2026-10-22' };
  env.PAYPAL_ENVIRONMENT = 'live';
  assert.equal((await call('/api/orders/create', orderBody)).data.code, 'TRAINING_CHECKOUT_CLOSED');
  env.PAYPAL_ENVIRONMENT = 'sandbox'; env.T5_TRAINING_SANDBOX_CHECKOUT = 'false';
  assert.equal((await call('/api/orders/create', orderBody)).status, 503);
  env.T5_TRAINING_SANDBOX_CHECKOUT = 'true';
  r = await call('/api/orders/create', orderBody); assert.equal(r.status, 200, JSON.stringify(r));
  const order = r.data.order; assert.equal(order.amount_minor, 1200);
  const headers = { 'X-Order-Token': order.order_token };
  session = 'b'; assert.equal((await call('/api/payment/paypal/create', { order_id: order.order_id }, headers)).status, 403);
  session = 'a'; r = await call('/api/payment/paypal/create', { order_id: order.order_id }, headers); assert.equal(r.status, 200, JSON.stringify(r));
  const pp = r.data.paypal_order_id, capture = { order_id: order.order_id, paypal_order_id: pp };
  r = await call('/api/payment/paypal/capture', capture, headers); assert.equal(r.status, 200, JSON.stringify(r));
  const before = await first('SELECT * FROM product_entitlements WHERE user_id = ? AND product_code = ?', 'a', 'training_breakout_v1');
  r = await call('/api/payment/paypal/capture', capture, headers); assert.equal(r.data.duplicate, true);
  assert.equal((await first('SELECT expires_at FROM product_entitlements WHERE user_id = ? AND product_code = ?', 'a', 'training_breakout_v1')).expires_at, before.expires_at);
  assert.equal((await call('/api/training/breakout/course')).data.cases.length, 16);
  session = 'b'; assert.equal((await call('/api/training/breakout/course')).status, 403); session = 'a';
  assert.equal((await call('/api/training/breakout/case/D2A')).status, 409);
  assert.equal((await call('/api/orders/refund-eligibility?order_id=' + order.order_id, null, headers)).data.refund_eligible_under_t5_policy, true);
  assert.equal((await first('SELECT terms_version FROM order_terms WHERE order_id=?', order.order_id)).terms_version, 'training-v1-2026-10-22');
  let n = 0;
  for (const c of course.cases) {
    r = await call('/api/training/breakout/case/' + c.id); assert.equal(r.status, 200, JSON.stringify(r));
    assert.equal(r.data.feedback, null); assert.equal('answer' in r.data.case, false); assert.equal('future' in r.data.case, false); assert.equal('tag' in r.data.case, false);
    const choices = { ...c.answer }; if (n === 0) choices.action = choices.action === 'WAIT' ? 'READY' : 'WAIT';
    const body = { content_version: course.contentVersion, case_id: c.id, choices, request_id: 'request_' + c.id + '_0001' };
    if (n === 0) {
      assert.equal((await call('/api/training/breakout/submit', body, { Origin: 'https://evil.invalid' })).status, 403);
      assert.equal((await call('/api/training/breakout/submit', { ...body, content_version: 'old' })).status, 409);
    }
    r = await call('/api/training/breakout/submit', body); assert.equal(r.status, 200, JSON.stringify(r));
    const count = r.data.records[c.id].attempts;
    assert.equal((await call('/api/training/breakout/submit', body)).data.records[c.id].attempts, count);
    if (['PRE01', 'PRE02', 'POST01', 'POST02'].includes(c.id)) {
      assert.equal('grade' in r.data.records[c.id].first, false);
      assert.equal((await call('/api/training/breakout/case/' + c.id)).data.feedback, null);
    }
    n++;
  }
  assert.equal((await call('/api/orders/refund-eligibility?order_id=' + order.order_id, null, headers)).data.refund_eligible_under_t5_policy, true, 'Use does not invalidate the training 7-day refund promise');
  await run('UPDATE orders SET paid_at=? WHERE order_id=?',new Date(Date.now()-8*86400000).toISOString(),order.order_id);
  assert.equal((await call('/api/orders/refund-eligibility?order_id=' + order.order_id, null, headers)).data.refund_eligible_under_t5_policy, false);
  const c = course.cases[0];
  r = await call('/api/training/breakout/submit', { content_version: course.contentVersion, case_id: c.id, choices: c.answer, request_id: 'request_PRE01_0002' });
  assert.equal(r.data.records.PRE01.first.grade.action, false); assert.equal(r.data.records.PRE01.latest.grade.action, true);
  assert.equal(r.data.records.PRE01.attempts, 2);
  assert.equal((await call('/api/training/breakout/case/PRE01')).data.feedback.explanation, c.explanation);
  session = 'b'; assert.deepEqual((await call('/api/training/breakout/report')).data.records, {}); session = 'a';
  await run("UPDATE product_entitlements SET expires_at='2000-01-01' WHERE product_code='training_breakout_v1'");
  assert.equal((await call('/api/training/breakout/case/PRE01')).status, 403);
  assert.equal(Object.keys((await call('/api/training/breakout/report')).data.records).length, 16);
  await run('UPDATE product_entitlements SET expires_at=? WHERE product_code=?', future, 'training_breakout_v1');
  const event = { id: 'refund-training-1', event_type: 'PAYMENT.CAPTURE.REFUNDED', resource: { id: 'REF-1', amount: { value: '12.00', currency_code: 'USD' }, supplementary_data: { related_ids: { order_id: pp, capture_id: 'CAP-' + pp } } } };
  const webhookHeaders = { 'paypal-transmission-id': 'test', 'paypal-transmission-time': now, 'paypal-cert-url': 'https://api.paypal.com/cert', 'paypal-auth-algo': 'SHA256withRSA', 'paypal-transmission-sig': 'test' };
  r = await call('/api/payment/paypal/webhook', event, webhookHeaders); assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal((await first('SELECT status FROM product_entitlements WHERE product_code=?', 'training_breakout_v1')).status, 'revoked');
  assert.equal((await call('/api/training/breakout/course')).status, 403);
  await call('/api/payment/paypal/webhook', event, webhookHeaders);
  assert.equal((await first('SELECT status FROM product_entitlements WHERE product_code=?', 'training_breakout_v1')).status, 'revoked');
  assert.equal((await call('/api/payment/paypal/capture', capture, headers)).status >= 400, true);
  assert.equal(Object.keys((await call('/api/training/breakout/report')).data.records).length, 16);
  // Existing production live mode stays intact while the guarded admin adapter uses only sandbox credentials.
  env.PAYPAL_ENVIRONMENT='live';env.T5_TRAINING_DELIVERY_ENABLED='false';
  env.ENABLE_PAYPAL_SANDBOX_E2E='true';env.PAYPAL_SANDBOX_CLIENT_ID='sandbox-fake';env.PAYPAL_SANDBOX_CLIENT_SECRET='sandbox-fake';env.PAYPAL_SANDBOX_WEBHOOK_ID='sandbox-fake';
  const admin={'X-Builder-Access-Key':'test-admin-only'};
  assert.equal((await call('/api/admin/training-sandbox/content')).status,403);
  assert.equal((await call('/api/admin/training-sandbox/content',null,admin)).data.ready,true);
  objects.delete(TRAINING_CONTENT_KEY);
  async function upload(){const response=await runtime.fetch(new Request('https://example.invalid/api/admin/training-sandbox/content',{method:'PUT',headers:{...admin,Origin:'https://example.invalid','Content-Type':'application/json'},body:JSON.stringify(course)}),env,{});return response.status;}
  assert.equal(await upload(),200);assert.equal(await upload(),409,'Pinned authored content must not be overwritten');
  assert.equal((await call('/api/training/breakout/course')).status,503);
  r=await call('/api/admin/paypal-sandbox/order',{product_code:'training_breakout_v1',terms_accepted:true,terms_version:'training-v1-2026-10-22'},admin);assert.equal(r.status,200,JSON.stringify(r));
  const testOrder=r.data.order;
  assert.equal((await first('SELECT user_id FROM orders WHERE order_id=?',testOrder.order_id)).user_id,'a');
  r=await call('/api/admin/paypal-sandbox/create',{order_id:testOrder.order_id},{...admin,'X-Order-Token':testOrder.order_token});assert.equal(r.status,200,JSON.stringify(r));
  const testPP=r.data.paypal_order_id;
  r=await call('/api/admin/paypal-sandbox/capture',{order_id:testOrder.order_id,paypal_order_id:testPP},admin);assert.equal(r.status,200,JSON.stringify(r));
  assert.equal(env.PAYPAL_ENVIRONMENT,'live');
  assert.equal((await call('/api/admin/training-sandbox/learning/course',null,admin)).status,200);
  const verifiedCapture={id:'WH-training-capture',event_type:'PAYMENT.CAPTURE.COMPLETED',resource:{id:'CAP-'+testPP,amount:{value:'12.00',currency_code:'USD'},supplementary_data:{related_ids:{order_id:testPP}}}};
  assert.equal((await call('/api/payment/paypal-sandbox/webhook',verifiedCapture,webhookHeaders)).status,200);
  r=await call('/api/admin/paypal-sandbox/status?order_id='+testOrder.order_id,null,admin);
  assert.equal(r.data.result.grant_status,'active');assert.equal(r.data.verified_webhooks.length,1);
  assert.equal((await call('/api/admin/paypal-sandbox/refund',{order_id:testOrder.order_id},admin)).status,200);
  const verifiedRefund={id:'WH-training-refund',event_type:'PAYMENT.CAPTURE.REFUNDED',resource:{id:'REF-ADMIN-TEST',amount:{value:'12.00',currency_code:'USD'},supplementary_data:{related_ids:{order_id:testPP,capture_id:'CAP-'+testPP}}}};
  assert.equal((await call('/api/payment/paypal-sandbox/webhook',verifiedRefund,webhookHeaders)).status,200);
  r=await call('/api/admin/paypal-sandbox/status?order_id='+testOrder.order_id,null,admin);
  assert.equal(r.data.result.grant_status,'revoked');assert.equal(r.data.verified_webhooks.length,2);
  // Real providers can deliver a capture after its refund. It must be recorded
  // without resurrecting access, and a different capture must be rejected.
  await run('DELETE FROM training_sandbox_webhook_events WHERE event_id=?',verifiedCapture.id);
  assert.equal((await call('/api/payment/paypal-sandbox/webhook',verifiedCapture,webhookHeaders)).status,200);
  r=await call('/api/admin/paypal-sandbox/status?order_id='+testOrder.order_id,null,admin);
  assert.equal(r.data.result.status,'refunded');assert.equal(r.data.result.payment_status,'refunded');
  assert.equal(r.data.result.grant_status,'revoked');assert.equal(r.data.verified_webhooks.length,2);
  for (const change of [{id:'OTHER-CAPTURE'}, {amount:{value:'1.00',currency_code:'USD'}}, {amount:{value:'12.00',currency_code:'EUR'}}]) {
    const bad={...verifiedCapture,id:'WH-bad-late-capture',resource:{...verifiedCapture.resource,...change}};
    assert.equal((await call('/api/payment/paypal-sandbox/webhook',bad,webhookHeaders)).status,500);
  }
  assert.equal((await first('SELECT COUNT(*) AS n FROM training_sandbox_webhook_events WHERE event_id=?','WH-bad-late-capture')).n,0);
  assert.equal((await call('/api/admin/training-sandbox/learning/case/PRE01',null,admin)).status,403);
  assert.equal((await call('/api/admin/training-sandbox/learning/report',null,admin)).status,200);
  // Live flag alone, missing evidence, or evidence for different content must all remain closed.
  env.T5_TRAINING_DELIVERY_ENABLED='true';env.T5_TRAINING_LIVE_CHECKOUT='true';
  env.TRAINING_LAUNCH_ORDER_ID='missing-order';
  assert.equal((await call('/api/orders/create',orderBody)).status,503);
  env.TRAINING_LAUNCH_ORDER_ID=testOrder.order_id;
  assert.equal((await call('/api/training/breakout/catalog')).data.checkout_open,true);
  r=await call('/api/orders/create',orderBody);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.order.amount_minor,1200);
  const obj=objects.get(TRAINING_CONTENT_KEY),priorSha=obj.metadata.sha256;obj.metadata.sha256='different-content';
  assert.equal((await call('/api/training/breakout/catalog')).data.checkout_open,false);obj.metadata.sha256=priorSha;
  env.T5_TRAINING_LIVE_CHECKOUT='false';assert.equal((await call('/api/training/breakout/catalog')).data.checkout_open,false);
  console.log('Training behavior passed: server-only questions, 16-case grading, sealed groups, immutable baseline, idempotency, ownership, sandbox payment, expiry and refund.');
} finally { globalThis.fetch = originalFetch; fs.rmSync(dir, { recursive: true, force: true }); }
