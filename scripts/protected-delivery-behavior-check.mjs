import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const source=fs.readFileSync('src/account-worker.js','utf8')
 .replace(/^import .*;$/gm,'')
 .replace('export default {','globalThis.worker = {');
const context=vm.createContext({Request,Response,Headers,URL,TextEncoder,crypto:webcrypto,console});
vm.runInContext(source+'\nensureAccountDb=async()=>{};',context);
let user={user_id:'customer',email:'paid@example.test'},grant=true,gets=0,events=0;
const env={BUILDER_DB:{prepare(){return{bind(){return this;},async first(){return grant?{entitlement_id:'e',source_order_id:'manual'}:null;},async run(){events++;}}}},USER_CODE_BUCKET:{async head(){return{size:7,customMetadata:{}};},async get(){gets++;return null;}}};
context.env=env;context.testUser=()=>user;
vm.runInContext('resolveSession=async()=>testUser();',context);
async function call(fn,slug,extra={}){
 context.request=new Request('https://example.test/download',{headers:{'X-Owner-Email':'cvvcvv2025@gmail.com',...extra}});context.slug=slug;
 const r=await vm.runInContext(fn+'(request,env,'+(fn.includes('Indicator')||fn==='indicatorAccess'?'INDICATOR_ARTIFACTS':'EA_ARTIFACTS')+'[slug])',context);
 return{status:r.status,data:await r.json()};
}
const indicators=vm.runInContext('Object.keys(INDICATOR_ARTIFACTS)',context),eas=vm.runInContext('Object.keys(EA_ARTIFACTS)',context);
for(const slug of indicators){
 user={user_id:'customer',email:'paid@example.test'};grant=true;gets=0;
 let r=await call('downloadIndicator',slug);assert.equal(r.status,503);assert.equal(r.data.code,'LICENSE_UPGRADE_PENDING');assert.equal(gets,0,'reject before reading binary, including fallback');
 r=await call('indicatorAccess',slug);assert.equal(r.data.entitled,true);assert.equal(r.data.artifact.download_allowed,false);
 user.email='manual@example.test';r=await call('downloadIndicator',slug);assert.equal(r.data.code,'LICENSE_UPGRADE_PENDING','manual grants never bypass protection');
 user.email='cvvcvv2025@gmail.com.attacker.test';r=await call('downloadIndicator',slug);assert.equal(r.data.code,'LICENSE_UPGRADE_PENDING');
 user.email='CVVCVV2025@gmail.com';r=await call('downloadIndicator',slug);assert.equal(r.data.code,'ARTIFACT_NOT_READY','only authenticated owner can reach old binary');
 grant=false;r=await call('downloadIndicator',slug);assert.equal(r.status,403,'owner exemption does not invent an entitlement');
}
for(const slug of eas){
 user={user_id:'customer',email:'paid@example.test'};grant=true;gets=0;
 let r=await call('downloadEa',slug);assert.equal(r.data.code,'LICENSE_UPGRADE_PENDING');assert.equal(gets,0);
 const product=vm.runInContext('EA_ARTIFACTS[slug].license_product',context);
 env.RUNTIME_LICENSE_PRODUCTS=product;env.RUNTIME_LICENSE_V2_PRODUCTS=product;
 r=await call('downloadEa',slug);assert.equal(r.data.code,'ARTIFACT_NOT_READY','accepted EA release still uses existing hash gate');
 env.RUNTIME_LICENSE_V2_PRODUCTS='';r=await call('downloadEa',slug);assert.equal(r.data.code,'LICENSE_UPGRADE_PENDING','both release gates required');
 env.RUNTIME_LICENSE_PRODUCTS='';
}
assert.equal(events,0,'blocked downloads cannot count as fulfillment');
context.user=null;user=null;grant=true;
let r=await call('downloadIndicator',indicators[0]);assert.equal(r.status,401);
console.log('Protected delivery: all 8 indicator and 4 EA routes, paid/manual/owner/anonymous access, spoofed owner identity, release gating and pre-storage rejection passed.');
