import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

// Execute the real route, session lookup and per-product entitlement query.
// Database schema creation is unrelated to this route change and is stubbed.
const source=fs.readFileSync('src/account-worker.js','utf8')
  .replace('import app from "./final-worker.js";', 'const app={fetch:()=>new Response("unused",{status:404})};')
  .replace('export default {','globalThis.worker = {');
const context=vm.createContext({Request,Response,Headers,URL,TextEncoder,crypto:webcrypto,console});
vm.runInContext(source+'\nensureAccountDb=async()=>{};',context);
let user=true, grants=[], gets=0, puts=0;
const env={ACCOUNT_AUTH_SECRET:'test-secret',BUILDER_ACCESS_KEY:'test-admin-only',
  USER_CODE_BUCKET:{get:async()=>{gets++;return null},put:async()=>{puts++}},
  BUILDER_DB:{prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){
    if(sql.includes('FROM auth_sessions'))return user?{user_id:'u1',email:'u1@example.test'}:null;
    if(sql.includes('FROM product_entitlements')){
      assert.equal(values[0],'u1');
      const permitted=values.slice(1,-2);
      assert.equal(permitted[0],'premium_membership');
      assert.equal(permitted.length,2);
      return grants.some(code=>permitted.includes(code))?{entitlement_id:'e1'}:null;
    }
    throw new Error('Unexpected SQL '+sql);
  }}}}
};
async function call(path,headers={},method='GET'){
  const response=await context.worker.fetch(new Request('https://example.test'+path,{headers,method}),env,{});
  return {status:response.status,data:await response.json()};
}
let r=await call('/api/member/eas/range-martingale/download');
assert.equal(r.status,401);assert.equal(gets,0);
r=await call('/api/member/eas/range-martingale/download',{Cookie:'t5_session=valid'});
assert.equal(r.status,403);assert.equal(gets,0);
grants=['trend_capture_mt5'];
r=await call('/api/member/eas/range-martingale/download',{Cookie:'t5_session=valid'});
assert.equal(r.status,403);assert.equal(gets,0);
grants=['range_martingale_mt4'];
r=await call('/api/member/eas/range-martingale/access',{Cookie:'t5_session=valid'});
assert.equal(r.status,200);assert.equal(r.data.entitled,true);assert.equal(r.data.artifact.ready,false);
r=await call('/api/member/eas/range-martingale/download',{Cookie:'t5_session=valid'});
assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_NOT_RELEASED');assert.equal(gets,0);
r=await call('/api/member/eas/trend-capture/download',{Cookie:'t5_session=valid'});
assert.equal(r.status,403);assert.equal(gets,0);
grants=['premium_membership'];
r=await call('/api/member/eas/trend-capture/download',{Cookie:'t5_session=valid'});
assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_NOT_READY');assert.equal(gets,1);
r=await call('/api/admin/ea-artifacts/upload?artifact=range-martingale',{},'PUT');
assert.equal(r.status,403);assert.equal(puts,0);
r=await call('/api/admin/ea-artifacts/upload?artifact=range-martingale',{'X-Builder-Access-Key':'test-admin-only'},'PUT');
assert.equal(r.status,409);assert.equal(r.data.code,'ARTIFACT_NOT_RELEASED');assert.equal(puts,0);
const page=fs.readFileSync('tools/ea/range-boundary/index.html','utf8');
for(const text of ['v0.3.4','v0.3.5','18.39%','29.69%—32.64%','5个有记录日期','逐笔结果未发现实际佣金扣款','不是运行门槛','80%篮子预算','客户编译安装包正在准备']) assert(page.includes(text),text);
const center=fs.readFileSync('account/member-center/index.html','utf8');
assert(!center.includes('data-ea-download="range-martingale"'));
assert(center.includes('5 个正式安装包'));
console.log('Range Martingale: session/product isolation, pending release gate, admin gate, unchanged existing downloads and performance disclosure passed.');
