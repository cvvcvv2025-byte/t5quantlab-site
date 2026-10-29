import {boundInstallPackage} from '../src/install-package.js';
import {signingKeyAdmin,signingPublicKey,signedLeaseResponse,ownerProfileResponse,installProfileResponse} from '../src/signed-runtime-license.js';
import { TRAINING_TERMS } from '../src/training-product.js';
import { trainingResponse, TRAINING_CONTENT_KEY } from '../src/training-worker.js';
import { runtimeLicenseResponse, adminRuntimeLicenseQa } from '../src/runtime-license.js';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const source=fs.readFileSync('src/account-worker.js','utf8')
 .replace('import app from "./final-worker.js";','const app={fetch:()=>new Response("unused",{status:404})};')
 .replace("import { runtimeLicenseResponse, adminRuntimeLicenseQa } from './runtime-license.js';",'')
 .replace(/^import .*from '.\/training-(?:product|worker)\.js';$/gm,'')
 .replace("import {signingKeyAdmin,signingPublicKey,signedLeaseResponse,ownerProfileResponse,installProfileResponse} from './signed-runtime-license.js';",'')
 .replace("import {boundInstallPackage} from './install-package.js';",'')
 .replace("import {alipayPreflightResponse} from './alipay.js';",'')
 .replace('export default {','globalThis.worker = {');
const context=vm.createContext({boundInstallPackage,signingKeyAdmin,signingPublicKey,signedLeaseResponse,ownerProfileResponse,installProfileResponse,Request,Response,Headers,URL,TextEncoder,crypto:webcrypto,console,runtimeLicenseResponse,adminRuntimeLicenseQa,TRAINING_TERMS,trainingResponse,TRAINING_CONTENT_KEY});
vm.runInContext(source+'\nensureAccountDb=async()=>{};',context);
let grants=[],gets=0,puts=0,downloads=0,stored=null,corruptReadback=false;
const env={RUNTIME_SIGNED3_PRODUCTS:'range_martingale_mt4_v3',RUNTIME_LICENSE_PRODUCTS:'range_martingale_mt4_v2',RUNTIME_LICENSE_V2_PRODUCTS:'range_martingale_mt4_v2',ACCOUNT_AUTH_SECRET:'test-secret',BUILDER_ACCESS_KEY:'test-admin-only',
 USER_CODE_BUCKET:{
  head:async key=>stored?.key===key?{customMetadata:stored.metadata}:null,
  get:async key=>{gets++;if(stored?.key!==key)return null;return {arrayBuffer:async()=>corruptReadback?new Uint8Array([0]).buffer:stored.bytes.slice().buffer}},
  put:async(key,bytes,options)=>{puts++;stored={key,bytes:new Uint8Array(bytes),metadata:options.customMetadata}}
 },
 BUILDER_DB:{prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){
  if(sql.includes('FROM auth_sessions'))return {user_id:'u1',email:'u1@example.test'};
  if(sql.includes('FROM product_entitlements')){
   assert.equal(values[0],'u1');const permitted=values.slice(1,-2);
   assert.equal(permitted[0],'premium_membership');assert.equal(permitted.length,2);
   return grants.some(code=>permitted.includes(code))?{entitlement_id:'e1'}:null;
  }
  throw new Error('Unexpected SQL '+sql);
 },async run(){assert(sql.includes('INSERT INTO member_download_events'));downloads++;return {success:true}}}}}
};
const signed={Cookie:'t5_session=valid'};
const admin={'X-Builder-Access-Key':'test-admin-only'};
async function call(path,headers={},method='GET',body){
 const response=await context.worker.fetch(new Request('https://example.test'+path,{headers,method,body}),env,{});
 return {status:response.status,headers:response.headers,data:response.headers.get('Content-Type')==='application/zip'?new Uint8Array(await response.arrayBuffer()):await response.json()};
}
let r=await call('/api/member/eas/range-martingale/download');assert.equal(r.status,401);
r=await call('/api/member/eas/range-martingale/download',signed);assert.equal(r.status,403);
grants=['trend_capture_mt5'];
r=await call('/api/member/eas/range-martingale/download',signed);assert.equal(r.status,403);assert.equal(gets,0);
grants=['range_martingale_mt4'];
r=await call('/api/member/eas/range-martingale/access',signed);
assert.equal(r.status,200);assert.equal(r.data.entitled,true);assert.equal(r.data.artifact.ready,false);
r=await call('/api/member/eas/range-martingale/download',signed);
assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_NOT_READY');
r=await call('/api/member/eas/trend-capture/download',signed);assert.equal(r.status,403);
r=await call('/api/admin/ea-artifacts/upload?artifact=range-martingale',{},'PUT');assert.equal(r.status,403);
const fixture=new Uint8Array([80,75,3,4,7,8,9]);
r=await call('/api/admin/ea-artifacts/upload?artifact=range-martingale',admin,'PUT',fixture);
assert.equal(r.status,400);assert.equal(r.data.code,'ARTIFACT_HASH_MISMATCH');assert.equal(puts,0);
const artifact=vm.runInContext('EA_ARTIFACTS["range-martingale"]',context);
assert.equal(artifact.sha256,'b1e62f026d9cf0564c97981a2801f529ae918d40e996777f694f74825dc1b0b3');
// Isolated test fixture only: exercise real hashing without committing paid binaries.
artifact.sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',fixture)).toString('hex');
r=await call('/api/admin/ea-artifacts/upload?artifact=range-martingale',admin,'PUT',fixture);
assert.equal(r.status,200);assert.equal(r.data.storage_verified,true);assert.equal(puts,1);
r=await call('/api/member/eas/range-martingale/access',signed);assert.equal(r.data.artifact.ready,true);
r=await call('/api/member/eas/range-martingale/download',signed);
assert.equal(r.status,200);assert.deepEqual(Array.from(r.data),Array.from(fixture));assert.equal(downloads,1);
assert.equal(r.headers.get('X-T5-Artifact-SHA256'),artifact.sha256);
assert(r.headers.get('Cache-Control').includes('private'));
assert(r.headers.get('Content-Disposition').includes('LicenseV3_Customer_Pack.zip'));
corruptReadback=true;
r=await call('/api/member/eas/range-martingale/download',signed);
assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_CONTENT_MISMATCH');assert.equal(downloads,1);
r=await call('/api/admin/ea-artifacts/upload?artifact=range-martingale',admin,'PUT',fixture);
assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_STORAGE_MISMATCH');
corruptReadback=false;
grants=['premium_membership'];
r=await call('/api/member/eas/trend-capture/download',signed);
assert.equal(r.status,503);assert.equal(r.data.code,'LICENSE_UPGRADE_PENDING');
r=await call('/api/member/eas/range-martingale/download',signed);assert.equal(r.status,200);
const page=fs.readFileSync('tools/ea/range-boundary/index.html','utf8');
for(const text of ['v0.3.4','v0.3.5','18.39%','29.69%—32.64%','5个有记录日期','逐笔结果未发现实际佣金扣款','不是运行门槛','80%篮子预算','MT5客户包已制作','尚未完成原生回测'])assert(page.includes(text),text);
const center=fs.readFileSync('account/member-center/index.html','utf8');
assert(center.includes('data-ea-download="range-martingale"'));
assert(center.includes("/assets/delivery-status.js"));
assert(fs.readFileSync("assets/delivery-status.js","utf8").includes("d.ready_count"));
console.log('Range delivery: product isolation, hash-pinned upload, private readback, storage readiness, authorised download, corruption rejection, premium access and honest platform claims passed.');
