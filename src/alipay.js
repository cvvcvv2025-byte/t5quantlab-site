// Mainland Alipay page-pay adapter. No browser return parameter grants access.
const GATEWAY = 'https://openapi.alipay.com/gateway.do';
const PRODUCTS = {code_workshop_single:'T5_BUILDER_PASS_PRICE_CNY_MINOR',indicator_membership:'T5_INDICATOR_MEMBERSHIP_PRICE_CNY_MINOR',premium_membership:'T5_PREMIUM_MEMBERSHIP_PRICE_CNY_MINOR'};
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const failure=(code,status=409)=>json({ok:false,code,error:({ALIPAY_NOT_READY:'支付宝付款正在准备中，请使用其他付款方式。',ALIPAY_STATUS_UNAVAILABLE:'暂时无法核对支付宝订单；若已扣款，请勿重复付款，稍后刷新或联系支持。',ALIPAY_PAYMENT_OPEN:'此订单已有支付宝付款链接，请先使用支付宝订单页的关闭功能核对并关闭付款。',ALIPAY_LINK_UNOPENED:'此付款链接尚未在支付宝生成交易，请等待16分钟后核对并关闭，或先进入支付宝收银台后再关闭。'})[code]||'支付宝订单暂时无法处理，请联系支持并提供订单号。'},status);
export function alipayPrice(env,product){const v=String(env[PRODUCTS[product]]||'');return /^[1-9]\d{0,7}$/.test(v)?Number(v):null;}
export function alipayConfigured(env){return /^\d{16,32}$/.test(String(env.ALIPAY_APP_ID||''))&&/^2088\d{12}$/.test(String(env.ALIPAY_SELLER_ID||''))&&Boolean(env.ALIPAY_PRIVATE_KEY&&env.ALIPAY_PUBLIC_KEY);}
export function alipayEnabled(env){return env.ALIPAY_CHECKOUT_ENABLED==='true'&&alipayConfigured(env);}
export function alipayCanonical(params,notification=false){return Object.keys(params).filter(k=>k!=='sign'&&(!notification||k!=='sign_type')&&params[k]!==''&&params[k]!=null).sort().map(k=>k+'='+params[k]).join('&');}
function bytes(text){const s=String(text).replace(/-----[^-]+-----/g,'').replace(/\s/g,'');return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
const encode=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
function der(tag,value) {
 const n=value.length, length=n<128?[n]:n<256?[0x81,n]:[0x82,n>>8,n&255];
 return Uint8Array.from([tag,...length,...value]);
}
async function privateKey(env) {
 const key=bytes(env.ALIPAY_PRIVATE_KEY),algorithm={name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'};
 try {return await crypto.subtle.importKey('pkcs8',key,algorithm,false,['sign']);}
 catch { // Official tools may export PKCS#1; wrap it without printing key bytes.
  const wrapped=der(0x30,Uint8Array.from([2,1,0,0x30,0x0d,6,9,0x2a,0x86,0x48,0x86,0xf7,0x0d,1,1,1,5,0,...der(4,key)]));
  return crypto.subtle.importKey('pkcs8',wrapped,algorithm,false,['sign']);
 }
}
async function publicKey(env){return crypto.subtle.importKey('spki',bytes(env.ALIPAY_PUBLIC_KEY),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);}
export async function alipaySign(env,params){return encode(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',await privateKey(env),new TextEncoder().encode(alipayCanonical(params))));}
export async function alipayVerify(env,params){try{return params.sign_type==='RSA2'&&await crypto.subtle.verify('RSASSA-PKCS1-v1_5',await publicKey(env),bytes(params.sign),new TextEncoder().encode(alipayCanonical(params,true)));}catch{return false;}}
export function alipayMinor(v){const m=String(v??'').match(/^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/);return m?Number(m[1])*100+Number((m[2]||'').padEnd(2,'0')):null;}
function timestamp(value=Date.now()){return new Date(value+8*3600000).toISOString().slice(0,19).replace('T',' ');}
async function signed(env,method,biz,extra={}){const p={app_id:String(env.ALIPAY_APP_ID),method,format:'JSON',charset:'utf-8',sign_type:'RSA2',timestamp:timestamp(),version:'1.0',biz_content:JSON.stringify(biz),...extra};p.sign=await alipaySign(env,p);return p;}
// Verify the exact raw response object, not JSON reserialization (escaping and
// property order are signature significant). Reject duplicate top-level keys.
export function responseObject(raw,key){let i=0;const ws=()=>{while(/\s/.test(raw[i]||'')&&i<raw.length)i++;};const string=()=>{const start=i++;while(i<raw.length){if(raw[i]==='\\'){i+=2;continue;}if(raw[i++]==='"')return JSON.parse(raw.slice(start,i));}throw Error('INVALID_RESPONSE');};ws();if(raw[i++]!=='{')throw Error('INVALID_RESPONSE');const seen=new Set();let found;while(i<raw.length){ws();if(raw[i]==='}'){i++;break;}if(raw[i]!=='"')throw Error('INVALID_RESPONSE');const name=string();if(seen.has(name))throw Error('INVALID_RESPONSE');seen.add(name);ws();if(raw[i++]!==':')throw Error('INVALID_RESPONSE');ws();const start=i;if(raw[i]==='{'){let depth=0;do{if(raw[i]==='"'){string();continue;}if(raw[i]==='{')depth++;if(raw[i]==='}')depth--;i++;}while(i<raw.length&&depth);if(depth)throw Error('INVALID_RESPONSE');}else if(raw[i]==='"'){string();}else{while(i<raw.length&&!['}',','].includes(raw[i]))i++;}if(name===key)found=raw.slice(start,i);ws();if(raw[i]===','){i++;continue;}if(raw[i]==='}'){i++;break;}throw Error('INVALID_RESPONSE');}ws();if(i!==raw.length||!found)throw Error('INVALID_RESPONSE');return found;}
async function rpc(env,method,biz){const p=await signed(env,method,biz);const r=await fetch(GATEWAY,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:new URLSearchParams(p).toString(),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('ALIPAY_HTTP_ERROR');const raw=await r.text();if(raw.length>131072)throw Error('INVALID_RESPONSE');const d=JSON.parse(raw),key=method.replaceAll('.','_')+'_response',object=responseObject(raw,key);if(!d.sign||!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',await publicKey(env),bytes(d.sign),new TextEncoder().encode(object)))throw Error('ALIPAY_RESPONSE_SIGNATURE');return JSON.parse(object);}
// Read-only production connectivity probe. A random, nonexistent merchant order
// is queried; no order, payment, refund, entitlement or config is created.
// Caller MUST enforce admin authentication before invoking this function.
export async function alipayPreflightResponse(request,env){
 if(request.method!=='POST')return failure('METHOD_NOT_ALLOWED',405);
 if(!originAllowed(request))return failure('ORIGIN_MISMATCH',403);
 if(!alipayConfigured(env))return failure('ALIPAY_NOT_READY',503);
 try{
  await privateKey(env);await publicKey(env);
  const remote=await rpc(env,'alipay.trade.query',{out_trade_no:'T5PREFLIGHT'+crypto.randomUUID().replaceAll('-','')});
  const verified=remote.code==='40004'&&remote.sub_code==='ACQ.TRADE_NOT_EXIST';
  return json({ok:verified,environment:'live',gateway:GATEWAY,signed_gateway_verified:verified,no_payment_attempted:true,customer_payment_enabled:alipayEnabled(env),payment_acceptance_verified:false,checked_at:new Date().toISOString(),...(!verified?{code:'ALIPAY_PREFLIGHT_FAILED',provider_code:String(remote.code||'').slice(0,32),provider_sub_code:String(remote.sub_code||'').slice(0,80)}:{})},verified?200:502);
 }catch(error){return json({ok:false,code:['ALIPAY_RESPONSE_SIGNATURE','ALIPAY_HTTP_ERROR','INVALID_RESPONSE'].includes(error.message)?error.message:'ALIPAY_PREFLIGHT_UNAVAILABLE',signed_gateway_verified:false,no_payment_attempted:true,payment_acceptance_verified:false},502);}
}
async function setup(env){await env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS alipay_receipts(order_id TEXT PRIMARY KEY,app_id TEXT NOT NULL,seller_id TEXT NOT NULL,created_at TEXT NOT NULL,lease_token TEXT,lease_until INTEGER,closed INTEGER NOT NULL DEFAULT 0)`).run();}
function originAllowed(request){const origin=request.headers.get('Origin');return (!origin||origin===new URL(request.url).origin)&&request.headers.get('Sec-Fetch-Site')!=='cross-site';}
async function receipt(env,orderId){return env.BUILDER_DB.prepare('SELECT * FROM alipay_receipts WHERE order_id=?').bind(orderId).first();}
async function orderRow(env,orderId){return env.BUILDER_DB.prepare('SELECT * FROM orders WHERE order_id=?').bind(orderId).first();}
async function settle(env,s,fields,fromQuery=false){const order=await orderRow(env,fields.out_trade_no),bound=order&&await receipt(env,order.order_id);if(!order||!bound||order.currency!=='CNY'||!PRODUCTS[order.product_code])throw Error('ALIPAY_ORDER_MISMATCH');if((!fromQuery&&fields.app_id!==bound.app_id)||bound.app_id!==String(env.ALIPAY_APP_ID)||(!fromQuery&&fields.seller_id!==bound.seller_id)||(fields.seller_id&&fields.seller_id!==bound.seller_id)||!/^\d{16,64}$/.test(fields.trade_no||'')||alipayMinor(fields.total_amount)!==order.amount_minor)throw Error('ALIPAY_PAYMENT_MISMATCH');if(order.payment_provider&&order.payment_provider!=='alipay'||order.provider_trade_id&&order.provider_trade_id!==fields.trade_no)throw Error('ALIPAY_PAYMENT_MISMATCH');
 const token=crypto.randomUUID(),now=Date.now();const claim=await env.BUILDER_DB.prepare('UPDATE alipay_receipts SET lease_token=?,lease_until=? WHERE order_id=? AND (lease_until IS NULL OR lease_until<?)').bind(token,now+60000,order.order_id,now).run();if(!Number(claim.meta?.changes))throw Error('ALIPAY_RETRY');
 try{
 const current=await orderRow(env,order.order_id);if(current.status!==order.status)throw Error('ALIPAY_RETRY');
 const state=fields.trade_status;
 if(state==='TRADE_CLOSED'){
   // Alipay defines CLOSED as unpaid timeout OR fully refunded. Only a previously
   // fulfilled matching transaction is revoked; never grant on a CLOSED event.
   if(['granted','paid'].includes(order.status))await s.revokePaidOrder(env,{orderId:order.order_id,provider:'alipay',providerTradeId:fields.trade_no,eventId:'closed-'+fields.trade_no});
   await env.BUILDER_DB.batch([env.BUILDER_DB.prepare('UPDATE alipay_receipts SET closed=1 WHERE order_id=?').bind(order.order_id),env.BUILDER_DB.prepare("UPDATE orders SET status='canceled',updated_at=? WHERE order_id=? AND status='pending'").bind(new Date().toISOString(),order.order_id)]);return;
 }
 if(!['TRADE_SUCCESS','TRADE_FINISHED'].includes(state))return;
 if(bound.closed||['refunded','canceled'].includes(order.status))throw Error('ALIPAY_ORDER_CLOSED');
 // Lease serializes the unchanged common fulfillment + Pass normalization. A
 // crash is retryable after 60s; no provider event is acknowledged beforehand.

 await s.completePaidOrder(env,{orderId:order.order_id,provider:'alipay',providerTradeId:fields.trade_no,paidAmountMinor:order.amount_minor,currency:'CNY',eventId:'paid-'+fields.trade_no});await s.applyPassEntitlement(env,order.order_id);await env.BUILDER_DB.prepare("UPDATE payment_intents SET status='completed',updated_at=? WHERE provider='alipay' AND order_id=?").bind(new Date().toISOString(),order.order_id).run();}finally{await env.BUILDER_DB.prepare('UPDATE alipay_receipts SET lease_token=NULL,lease_until=NULL WHERE order_id=? AND lease_token=?').bind(order.order_id,token).run();}
}
export async function alipayResponse(request,env,s){const url=new URL(request.url),p=url.pathname;if(!p.startsWith('/api/payment/alipay/'))return null;
 const webhook=p==='/api/payment/alipay/webhook';if(!['/api/payment/alipay/create','/api/payment/alipay/query','/api/payment/alipay/close','/api/payment/alipay/webhook'].includes(p))return failure('NOT_FOUND',404);
 if(request.method!=='POST')return failure('METHOD_NOT_ALLOWED',405);
 if(!webhook&&!originAllowed(request))return failure('ORIGIN_MISMATCH',403);
 // Existing paid callbacks must survive disabling new sales. Merchant identity
 // and public key are sufficient for webhook verification; prices are snapshots.
 if(!env.BUILDER_DB||!env.ALIPAY_APP_ID||!env.ALIPAY_PUBLIC_KEY)return webhook?new Response('failure',{status:503}):failure('ALIPAY_NOT_READY',503);
 await s.ensureAccessDb(env);await setup(env);
 if(webhook){try{if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))throw Error('TYPE');const raw=await request.text();if(raw.length>65536)throw Error('SIZE');const params=new URLSearchParams(raw),fields=Object.create(null);for(const [k,v]of params){if(Object.hasOwn(fields,k))throw Error('DUPLICATE');fields[k]=v;}if(!await alipayVerify(env,fields))throw Error('SIGNATURE');await settle(env,s,fields);return new Response('success',{headers:{'Cache-Control':'no-store'}});}catch{return new Response('failure',{status:400,headers:{'Cache-Control':'no-store'}});}}
 let body;try{body=await request.json();}catch{return failure('INVALID_REQUEST',400);}const order=await s.getAuthorizedOrder(request,env,String(body.order_id||''));if(!order)return failure('ORDER_NOT_FOUND',403);if(order.currency!=='CNY'||!PRODUCTS[order.product_code])return failure('ALIPAY_ORDER_MISMATCH',400);
 if(p.endsWith('/create')){
   if(!alipayEnabled(env)||!alipayPrice(env,order.product_code))return failure('ALIPAY_NOT_READY',503);
   if(order.status!=='pending')return failure('ALIPAY_ORDER_CLOSED');
   try { await privateKey(env);await publicKey(env); } catch { return failure('ALIPAY_KEY_FORMAT_INVALID',503); }
   const created=new Date().toISOString();await env.BUILDER_DB.prepare(`INSERT INTO alipay_receipts(order_id,app_id,seller_id,created_at) SELECT order_id,?,?,? FROM orders WHERE order_id=? AND status='pending' ON CONFLICT(order_id) DO NOTHING`).bind(String(env.ALIPAY_APP_ID),String(env.ALIPAY_SELLER_ID),created,order.order_id).run();
   const bound=await receipt(env,order.order_id);if(!bound||bound.closed||Date.parse(bound.created_at)+15*60000<=Date.now()||bound.app_id!==String(env.ALIPAY_APP_ID)||bound.seller_id!==String(env.ALIPAY_SELLER_ID))return failure('ALIPAY_ORDER_CLOSED');
   await env.BUILDER_DB.prepare(`INSERT INTO payment_intents(provider,provider_order_id,order_id,status,created_at,updated_at) VALUES('alipay',?,?,'created',?,?) ON CONFLICT DO NOTHING`).bind(order.order_id,order.order_id,created,created).run();
   const fields=await signed(env,'alipay.trade.page.pay',{out_trade_no:order.order_id,product_code:'FAST_INSTANT_TRADE_PAY',total_amount:(order.amount_minor/100).toFixed(2),subject:order.product_name,seller_id:bound.seller_id,time_expire:timestamp(Date.parse(bound.created_at)+15*60000)},{notify_url:url.origin+'/api/payment/alipay/webhook',return_url:url.origin+'/checkout/alipay/?product='+encodeURIComponent(order.product_code)+'&order_id='+encodeURIComponent(order.order_id)});
   return json({ok:true,order_id:order.order_id,payment_url:GATEWAY+'?'+new URLSearchParams(fields).toString()});
 }
 const bound=await receipt(env,order.order_id);if(!bound)return json({ok:true,order});
 try{const remote=await rpc(env,'alipay.trade.query',{out_trade_no:order.order_id});if(remote.code!=='10000'){if(remote.sub_code==='ACQ.TRADE_NOT_EXIST') {
 if (!p.endsWith('/close')) return json({ok:true,order});
 if (Date.parse(bound.created_at)+16*60000<=Date.now()) {
  await env.BUILDER_DB.batch([env.BUILDER_DB.prepare('UPDATE alipay_receipts SET closed=1 WHERE order_id=?').bind(order.order_id),env.BUILDER_DB.prepare("UPDATE orders SET status='canceled',updated_at=? WHERE order_id=? AND status='pending'").bind(new Date().toISOString(),order.order_id)]);
  return json({ok:true,order:await s.getAuthorizedOrder(request,env,order.order_id)});
 }
 return failure('ALIPAY_LINK_UNOPENED',409);
}return failure('ALIPAY_STATUS_UNAVAILABLE',502);}await settle(env,s,remote,true);
   if(p.endsWith('/close')){
    if(remote.trade_status==='WAIT_BUYER_PAY') {const closed=await rpc(env,'alipay.trade.close',{out_trade_no:order.order_id});if(closed.code!=='10000'||closed.out_trade_no!==order.order_id)return failure('ALIPAY_STATUS_UNAVAILABLE',502);await env.BUILDER_DB.batch([env.BUILDER_DB.prepare('UPDATE alipay_receipts SET closed=1 WHERE order_id=?').bind(order.order_id),env.BUILDER_DB.prepare("UPDATE orders SET status='canceled',updated_at=? WHERE order_id=? AND status='pending'").bind(new Date().toISOString(),order.order_id)]);}
   }return json({ok:true,order:await s.getAuthorizedOrder(request,env,order.order_id)});
 }catch{return failure('ALIPAY_STATUS_UNAVAILABLE',502);}
}
