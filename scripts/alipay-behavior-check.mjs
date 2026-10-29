import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {generateKeyPairSync,createHash,sign,verify} from 'node:crypto';
import runtime, { setAcceptedDeliveryFixture, futureAcceptedCatalog } from './runtime-test-harness.mjs';
import {alipayCanonical,responseObject,alipayPreflightResponse} from '../src/alipay.js';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'t5-alipay-')),dbfile=path.join(dir,'db.sqlite');
const sql=items=>{const p=spawnSync('python3',['scripts/test-d1.py',dbfile],{input:JSON.stringify(items),encoding:'utf8'});if(p.status)throw Error(p.stderr);return JSON.parse(p.stdout);};
let failGrantBatch=false;
const db={prepare(query){return {sql:query,values:[],bind(...v){this.values=v;return this;},async run(){return sql([this])[0];},async all(){return sql([this])[0];},async first(){return sql([this])[0].results[0]||null;}};},async batch(items){if(failGrantBatch&&items.some(x=>x.sql.includes('INSERT INTO builder_access_grants')))throw Error('simulated transactional failure');return sql(items);}};
const run=(q,...v)=>db.prepare(q).bind(...v).run(),first=(q,...v)=>db.prepare(q).bind(...v).first();
const app=generateKeyPairSync('rsa',{modulusLength:2048}),ali=generateKeyPairSync('rsa',{modulusLength:2048});
const env={BUILDER_DB:db,ACCOUNT_AUTH_SECRET:'local-only',BUILDER_ACCESS_KEY:'test-only-admin',AUDIT_HASH_SALT:'a'.repeat(24),RESEND_API_KEY:'fake',AUTH_EMAIL_FROM:'test@example.invalid',OPENAI_API_KEY:'fake',USER_CODE_BUCKET:{head:async()=>null},ALIPAY_APP_ID:'2021000000000001',ALIPAY_PRIVATE_KEY:app.privateKey.export({format:'pem',type:'pkcs8'}),ALIPAY_PUBLIC_KEY:ali.publicKey.export({format:'pem',type:'spki'}),ALIPAY_SELLER_ID:'2088123412341234',ALIPAY_CHECKOUT_ENABLED:'true',T5_BUILDER_PASS_PRICE_CNY_MINOR:'9900'};
let session='a';
async function call(route,body,headers={}){const r=await runtime.fetch(new Request('https://example.invalid'+route,{method:body?'POST':'GET',headers:{Cookie:'t5_session='+session,'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined}),env,{});const text=await r.text();return {status:r.status,text,data:text.startsWith('{')?JSON.parse(text):null};}
async function notice(order,patch={},extra=''){const fields={notify_id:'NOTIFY',app_id:env.ALIPAY_APP_ID,seller_id:env.ALIPAY_SELLER_ID,out_trade_no:order.order_id,trade_no:'202610280000000000000001',trade_status:'TRADE_SUCCESS',total_amount:'99.00',subject:'测试 & Unicode 汉字',sign_type:'RSA2',...patch};fields.sign=sign('RSA-SHA256',Buffer.from(alipayCanonical(fields,true)),ali.privateKey).toString('base64');const r=await runtime.fetch(new Request('https://example.invalid/api/payment/alipay/webhook',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields).toString()+extra}),env,{});return {status:r.status,text:await r.text()};}
let rpcTrade='202610280000000000000001';
let queryCode='10000',querySubCode;
let queryStatus='TRADE_SUCCESS',queryBadSign=false,queryAmount='99.00',queryOrder='',rpcCalls=0;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{assert.equal(String(url),'https://openapi.alipay.com/gateway.do');rpcCalls++;const p=Object.fromEntries(new URLSearchParams(options.body));assert.equal(p.app_id,env.ALIPAY_APP_ID);assert.ok(verify('RSA-SHA256',Buffer.from(alipayCanonical(p)),app.publicKey,Buffer.from(p.sign,'base64')));const biz=JSON.parse(p.biz_content),name=p.method.replaceAll('.','_')+'_response';const obj={code:queryCode,sub_code:querySubCode,out_trade_no:queryOrder||biz.out_trade_no,trade_no:rpcTrade,trade_status:queryStatus,total_amount:queryAmount};if(p.method==='alipay.trade.close'){obj.trade_status='TRADE_CLOSED';queryStatus='TRADE_CLOSED';}const raw=JSON.stringify(obj),signature=sign('RSA-SHA256',Buffer.from(raw),ali.privateKey).toString('base64');return new Response('{"'+name+'":'+raw+',"sign":'+JSON.stringify(queryBadSign?'bad':signature)+'}');};
try{
 env.ALIPAY_CHECKOUT_ENABLED='false';queryCode='40004';querySubCode='ACQ.TRADE_NOT_EXIST';
 const beforeProbeCalls=rpcCalls;let adminProbe=await call('/api/admin/alipay-preflight',{});assert.equal(adminProbe.status,403);assert.equal(rpcCalls,beforeProbeCalls,'anonymous cannot probe merchant configuration');adminProbe=await call('/api/admin/alipay-preflight',{}, {'X-Builder-Access-Key':env.BUILDER_ACCESS_KEY});assert.equal(adminProbe.status,200);
 let preflight=await alipayPreflightResponse(new Request('https://example.invalid/api/admin/alipay-preflight',{method:'POST'}),env);let preflightBody=await preflight.json();assert.equal(preflight.status,200);assert.equal(preflightBody.signed_gateway_verified,true);assert.equal(preflightBody.payment_acceptance_verified,false);assert.equal(preflightBody.customer_payment_enabled,false);
 queryBadSign=true;preflight=await alipayPreflightResponse(new Request('https://example.invalid/api/admin/alipay-preflight',{method:'POST'}),env);assert.equal(preflight.status,502);queryBadSign=false;
 preflight=await alipayPreflightResponse(new Request('https://example.invalid/api/admin/alipay-preflight',{method:'POST',headers:{Origin:'https://evil.invalid'}}),env);assert.equal(preflight.status,403);
 const savedPrivate=env.ALIPAY_PRIVATE_KEY,savedPublic=env.ALIPAY_PUBLIC_KEY;
 env.ALIPAY_PRIVATE_KEY=JSON.stringify(savedPrivate);env.ALIPAY_PUBLIC_KEY=JSON.stringify(ali.publicKey.export({format:'pem',type:'pkcs1'}));
 preflight=await alipayPreflightResponse(new Request('https://example.invalid/api/admin/alipay-preflight',{method:'POST'}),env);assert.equal(preflight.status,200,'JSON escaped PEM and PKCS1 public key supported');
 env.ALIPAY_PRIVATE_KEY='not a key';preflight=await alipayPreflightResponse(new Request('https://example.invalid/api/admin/alipay-preflight',{method:'POST'}),env);assert.equal((await preflight.json()).code,'ALIPAY_PRIVATE_KEY_FORMAT_INVALID');
 env.ALIPAY_PRIVATE_KEY=savedPrivate;env.ALIPAY_PUBLIC_KEY='not a key';preflight=await alipayPreflightResponse(new Request('https://example.invalid/api/admin/alipay-preflight',{method:'POST'}),env);assert.equal((await preflight.json()).code,'ALIPAY_PUBLIC_KEY_FORMAT_INVALID');
 env.ALIPAY_PUBLIC_KEY=savedPublic;
 queryCode='10000';querySubCode=undefined;env.ALIPAY_CHECKOUT_ENABLED='true';
 const schema=fs.readFileSync('builder-schema.sql','utf8');sql(schema.replace(/^--.*$/gm,'').split(';').filter(s=>s.trim()).map(sql=>({sql})));
 const now=new Date().toISOString(),future=new Date(Date.now()+86400000).toISOString();for(const id of ['a','b']){await run("INSERT INTO users(user_id,email,email_verified_at,status,created_at,updated_at) VALUES(?,?,?,'active',?,?)",id,id+'@example.invalid',now,now,now);await run('INSERT INTO auth_sessions(token_hash,user_id,created_at,expires_at) VALUES(?,?,?,?)',createHash('sha256').update(id).digest('hex'),id,now,future);}
 const body={product_code:'code_workshop_single',currency:'CNY',terms_accepted:true,terms_version:'refund-v2-2026-10-20'};
 let r=await call('/api/payments/catalog');assert.equal(r.data.products[0].prices.CNY,9900);assert.equal(r.data.providers.alipay.enabled,true);
 env.ALIPAY_CHECKOUT_ENABLED='false';r=await call('/api/orders/create',body);assert.notEqual(r.status,200);env.ALIPAY_CHECKOUT_ENABLED='true';
 r=await call('/api/orders/create',{...body,product_code:'indicator_membership'});assert.notEqual(r.status,200,'no invented price or missing artifacts');
 r=await call('/api/orders/create',{...body,total_amount:'0.01',amount_minor:1});assert.equal(r.status,200,JSON.stringify(r));const o=r.data.order,h={'X-Order-Token':o.order_token};assert.equal(o.amount_minor,9900);
 session='b';r=await call('/api/payment/alipay/create',{order_id:o.order_id},h);assert.equal(r.status,403);session='a';
 r=await call('/api/payment/alipay/create',{order_id:o.order_id},{...h,Origin:'https://evil.invalid'});assert.equal(r.status,403);
 r=await call('/api/payment/alipay/create',{order_id:o.order_id},h);assert.equal(r.status,200,JSON.stringify(r));const payment=new URL(r.data.payment_url),p=Object.fromEntries(payment.searchParams);assert.equal(payment.origin,'https://openapi.alipay.com');assert.ok(verify('RSA-SHA256',Buffer.from(alipayCanonical(p)),app.publicKey,Buffer.from(p.sign,'base64')));const biz=JSON.parse(p.biz_content);assert.equal(biz.total_amount,'99.00');assert.equal(biz.seller_id,env.ALIPAY_SELLER_ID);assert.equal(p.notify_url,'https://example.invalid/api/payment/alipay/webhook');
 r=await call('/api/orders/cancel',{order_id:o.order_id},h);assert.equal(r.status,409,'cannot cancel a live external payment');
 r=await call('/api/payment/paypal/create',{order_id:o.order_id},h);assert.notEqual(r.status,200,'no PayPal currency substitution');
 for(const patch of [{total_amount:'0.01'},{app_id:'2021000000000000'},{seller_id:'2088000000000000'},{out_trade_no:'wrong'},{sign_type:'RSA'}]){r=await notice(o,patch);assert.equal(r.status,400);}
 r=await notice(o,{},'&total_amount=0.01');assert.equal(r.status,400,'duplicate parameters rejected');
 assert.equal((await first('SELECT status FROM orders WHERE order_id=?',o.order_id)).status,'pending');
 env.ALIPAY_CHECKOUT_ENABLED='false';failGrantBatch=true;r=await notice(o);assert.equal(r.status,400);assert.equal((await first('SELECT status FROM orders WHERE order_id=?',o.order_id)).status,'pending');assert.equal(await first("SELECT * FROM payment_events WHERE provider='alipay'"),null);failGrantBatch=false;r=await notice(o);assert.equal(r.text,'success','callbacks survive closing new sales');
 let grant=await first('SELECT g.* FROM builder_access_grants g JOIN orders o ON o.grant_id=g.grant_id WHERE o.order_id=?',o.order_id);assert.equal(grant.analyze_remaining,3);assert.equal(grant.modify_remaining,2);const expires=grant.expires_at;
 r=await notice(o);assert.equal(r.text,'success');grant=await first('SELECT * FROM builder_access_grants WHERE grant_id=?',grant.grant_id);assert.equal(grant.analyze_remaining,3);assert.equal(grant.expires_at,expires,'duplicate payment does not extend validity');
 r=await notice(o,{trade_no:'202610280000000000000002'});assert.equal(r.status,400,'trade substitution denied even after fulfillment');
 queryBadSign=true;r=await call('/api/payment/alipay/query',{order_id:o.order_id},h);assert.equal(r.status,502);queryBadSign=false;queryAmount='1.00';r=await call('/api/payment/alipay/query',{order_id:o.order_id},h);assert.equal(r.status,502);queryAmount='99.00';
 r=await call('/api/payment/alipay/query',{order_id:o.order_id},h);assert.equal(r.status,200);assert.equal(r.data.order.status,'granted');
 r=await notice(o,{trade_status:'TRADE_CLOSED'});assert.equal(r.text,'success');assert.equal((await first('SELECT status FROM builder_access_grants WHERE grant_id=?',grant.grant_id)).status,'revoked');r=await notice(o);assert.equal(r.status,400,'old success cannot restore refunded access');
 env.ALIPAY_CHECKOUT_ENABLED='true';session='b';r=await call('/api/orders/create',body);assert.equal(r.status,200);const o2=r.data.order,h2={'X-Order-Token':o2.order_token};r=await call('/api/payment/alipay/create',{order_id:o2.order_id},h2);assert.equal(r.status,200);queryStatus='WAIT_BUYER_PAY';r=await call('/api/payment/alipay/close',{order_id:o2.order_id},h2);assert.equal(r.status,200);assert.equal(r.data.order.status,'canceled');
 // PKCS#1 tool exports work without asking the user to regenerate keys.
 env.ALIPAY_PRIVATE_KEY=app.privateKey.export({format:'pem',type:'pkcs1'});
 r=await call('/api/orders/create',body);assert.equal(r.status,200);const unopened=r.data.order,uh={'X-Order-Token':unopened.order_token};
 r=await call('/api/payment/alipay/create',{order_id:unopened.order_id},uh);assert.equal(r.status,200);const oldExpiry=JSON.parse(new URL(r.data.payment_url).searchParams.get('biz_content')).time_expire;
 r=await call('/api/payment/alipay/create',{order_id:unopened.order_id},uh);assert.equal(JSON.parse(new URL(r.data.payment_url).searchParams.get('biz_content')).time_expire,oldExpiry,'repeated links never extend expiry');
 queryCode='40004';querySubCode='ACQ.TRADE_NOT_EXIST';r=await call('/api/payment/alipay/close',{order_id:unopened.order_id},uh);assert.equal(r.status,409,'never-opened link cannot be canceled while it can still be paid');
 const originalNow=Date.now;try{const advanced=originalNow()+17*60000;Date.now=()=>advanced;r=await call('/api/payment/alipay/close',{order_id:unopened.order_id},uh);assert.equal(r.status,200);assert.equal(r.data.order.status,'canceled');}finally{Date.now=originalNow;}
 queryCode='10000';querySubCode=undefined;
 // Populate local metadata fixtures for membership delivery preflight.
 const heads=new Map(),source=fs.readFileSync('src/account-worker.js','utf8');
 for(const match of source.matchAll(/r2Key: "([^\"]+)"[\s\S]*?sha256: "([^\"]+)"/g))heads.set(match[1],{size:7,customMetadata:{sha256:match[2],version:match[1].split('/').at(-2)}});
 for(const match of source.matchAll(/previous: (\{[^\n]+\})/g)){const old=JSON.parse(match[1]);heads.set(old.r2Key,{size:7,customMetadata:{sha256:old.sha256,version:old.version}});}
 env.USER_CODE_BUCKET.head=async key=>heads.get(key)||null;
 const held=await call('/api/orders/create',{...body,product_code:'indicator_membership'});assert.equal(held.status,503,'CNY sales also stop for unlocked delivery');
 setAcceptedDeliveryFixture(futureAcceptedCatalog());
 for(const [product,priceKey]of [['indicator_membership','T5_INDICATOR_MEMBERSHIP_PRICE_CNY_MINOR'],['premium_membership','T5_PREMIUM_MEMBERSHIP_PRICE_CNY_MINOR']]){
  env[priceKey]='9900';r=await call('/api/orders/create',{...body,product_code:product});assert.equal(r.status,200,JSON.stringify(r));const member=r.data.order,mh={'X-Order-Token':member.order_token};
  r=await call('/api/payment/alipay/create',{order_id:member.order_id},mh);assert.equal(r.status,200);
  const trade=product==='indicator_membership'?'202610280000000000000010':'202610280000000000000011';
  // Query the signed platform response to recover a lost successful webhook.
  queryStatus='TRADE_SUCCESS';queryOrder=member.order_id;
  rpcTrade=trade;
  r=await call('/api/payment/alipay/query',{order_id:member.order_id},mh);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.order.status,'granted');
  const entitlement=await first('SELECT * FROM product_entitlements WHERE user_id=? AND product_code=?','b',product);assert.equal(entitlement.status,'active');const expiry=entitlement.expires_at;
  r=await notice(member,{trade_no:trade});assert.equal(r.text,'success');assert.equal((await first('SELECT expires_at FROM product_entitlements WHERE user_id=? AND product_code=?','b',product)).expires_at,expiry);
  r=await notice(member,{trade_no:trade,trade_status:'TRADE_CLOSED'});assert.equal(r.text,'success');assert.equal((await first('SELECT status FROM product_entitlements WHERE user_id=? AND product_code=?','b',product)).status,'revoked');
 }
 queryOrder='';
 assert.throws(()=>responseObject('{"x":{},"x":{},"sign":"a"}','x'));assert.equal(responseObject('{"x":{"a":"}\\\"","b":[{"v":2}]},"sign":"a"}','x'),'{"a":"}\\\"","b":[{"v":2}]}');
 console.log('Alipay: RSA2 outbound/notification/raw-response verification, server prices, account/origin isolation, paid retry, refund revocation, signed query, safe close and disabled-sales recovery passed. No live payment made.');
}finally{globalThis.fetch=originalFetch;fs.rmSync(dir,{recursive:true,force:true});}
