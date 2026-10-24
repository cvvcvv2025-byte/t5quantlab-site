import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { TRAINING_CONTENT_KEY } from '../src/training-worker.js';
const contentPath = process.argv[2];
const course = JSON.parse(fs.readFileSync(contentPath || 'scripts/fixtures/training-test-course.json','utf8'));
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
    return Response.json({ id, links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=' + id }] });
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
  const headers = { Origin: 'https://example.invalid', Cookie: 't5_session=' + session, 'CF-Connecting-IP': '192.0.2.1', ...extra };
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const r = await runtime.fetch(new Request('https://example.invalid' + route, { method: body ? 'POST' : 'GET', headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined }), env, {});
  return { status: r.status, data: await r.json() };
}
const hash = x => createHash('sha256').update(x).digest('hex');

await bucket.put(TRAINING_CONTENT_KEY, JSON.stringify(course));
sql(fs.readFileSync('builder-schema.sql', 'utf8').replace(/^--.*$/gm, '').split(';').filter(s => s.trim()).map(sql => ({ sql })));
const now = new Date().toISOString(), future = new Date(Date.now()+86400000).toISOString();
await run("INSERT INTO users (user_id,email,email_verified_at,status,created_at,updated_at) VALUES ('a','preview@example.invalid',?,'active',?,?)",now,now,now);
await run('INSERT INTO auth_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)',hash('preview-local-only'),'a',now,future);
await run("INSERT INTO product_entitlements (entitlement_id,user_id,product_code,status,starts_at,expires_at,source,created_at,updated_at) VALUES ('preview','a','training_breakout_v1','active',?,?,'local-test',?,?)",now,future,now,now);
http.createServer(async (req,res)=>{
 try {
  if(req.url.startsWith('/api/')) {
   const chunks=[];for await(const chunk of req) chunks.push(chunk);
   const r=await runtime.fetch(new Request('http://localhost:8877'+req.url,{method:req.method,headers:req.headers,body:chunks.length?Buffer.concat(chunks):undefined}),env,{});
   res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));return;
  }
  let pathname=new URL(req.url,'http://localhost:8877').pathname;
  if(!pathname.startsWith('/assets/breakout-pilot/')&&!pathname.startsWith('/training/breakout-confirmation/')) {res.writeHead(404);res.end('Not found');return;}
  if(pathname.endsWith('/')) pathname+='index.html';
  const target=path.resolve('.'+decodeURIComponent(pathname));
  if(!target.startsWith(process.cwd()+path.sep)) {res.writeHead(403);res.end();return;}
  const data=fs.readFileSync(target);res.setHeader('Content-Type',target.endsWith('.js')?'application/javascript':target.endsWith('.css')?'text/css':'text/html; charset=utf-8');
  res.setHeader('Set-Cookie','t5_session=preview-local-only; HttpOnly; SameSite=Strict; Path=/');res.end(data);
 }catch(e){res.writeHead(500);res.end('Local preview error');console.error(e);}
}).listen(8877,'127.0.0.1',()=>console.log('LOCAL TEST FIXTURE ONLY: http://localhost:8877/training/breakout-confirmation/member/'));
