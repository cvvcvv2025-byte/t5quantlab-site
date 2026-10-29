import {signingKeyAdmin,signingPublicKey,signedLeaseResponse,ownerProfileResponse} from '../src/signed-runtime-license.js';
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
 .replace("import {signingKeyAdmin,signingPublicKey,signedLeaseResponse,ownerProfileResponse} from './signed-runtime-license.js';",'')
 .replace('export default {','globalThis.worker = {');
const context=vm.createContext({signingKeyAdmin,signingPublicKey,signedLeaseResponse,ownerProfileResponse,Request,Response,Headers,URL,TextEncoder,crypto:webcrypto,console,runtimeLicenseResponse,adminRuntimeLicenseQa,TRAINING_TERMS,trainingResponse,TRAINING_CONTENT_KEY});
vm.runInContext(source+'\nensureAccountDb=async()=>{};',context);
let email='u1@example.test',grants=[],gets=0,puts=0,downloads=0,stored=null,corruptReadback=false;
const env={ACCOUNT_AUTH_SECRET:'test-secret',BUILDER_ACCESS_KEY:'test-admin-only',
 USER_CODE_BUCKET:{
  head:async key=>stored?.key===key?{customMetadata:stored.metadata}:null,
  get:async key=>{gets++;if(stored?.key!==key)return null;return {arrayBuffer:async()=>corruptReadback?new Uint8Array([0]).buffer:stored.bytes.slice().buffer}},
  put:async(key,bytes,options)=>{puts++;stored={key,bytes:new Uint8Array(bytes),metadata:options.customMetadata}}
 },
 BUILDER_DB:{prepare(sql){let values=[];return {bind(...args){values=args;return this},async first(){
  if(sql.includes('FROM auth_sessions'))return {user_id:'u1',email};
  if(sql.includes('FROM product_entitlements')){
   assert.equal(values[0],'u1');const permitted=values.slice(1,-2);
   assert.equal(permitted[0],'indicator_membership');assert.equal(permitted[1],'premium_membership');assert.equal(permitted.length,3);
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

const performanceAudit = vm.runInContext('INDICATOR_PERFORMANCE_AUDIT', context);
assert.equal(performanceAudit.qualified, false);
let restoredCatalog=await call('/api/products/delivery');
for(const a of restoredCatalog.data.artifacts.filter(a=>a.kind==='indicator')){assert.equal(a.performance_qualified,false);assert.equal(a.download_allowed,false);assert.equal(a.runtime_license_ready,false);}
for (const [slug,code] of [['mtf-structure-panel-mt5','mtf_structure_panel_mt4'],['neckline-mtf-mt5','neckline_mtf_mt4'],['progress-candle-mt5','progress_candle_mt4']]) {
  email='u1@example.test';stored=null;grants=[];gets=0;puts=0;downloads=0;
  const route='/api/member/indicators/'+slug+'/download';
  let r=await call(route);assert.equal(r.status,401);
  r=await call(route,signed);assert.equal(r.status,403);assert.equal(gets,0);
  grants=['structure_decision_map_mt4'];r=await call(route,signed);assert.equal(r.status,403);
  grants=[code];r=await call(route,signed);assert.equal(r.status,503);assert.equal(r.data.code,'LICENSE_UPGRADE_PENDING');email='cvvcvv2025@gmail.com';
  const upload='/api/admin/indicator-artifacts/upload?artifact='+slug;
  const fixture=new Uint8Array([80,75,3,4,1,2,3]);
  r=await call(upload,{},'PUT',fixture);assert.equal(r.status,403);
  r=await call(upload,admin,'PUT',fixture);assert.equal(r.status,400);assert.equal(r.data.code,'ARTIFACT_HASH_MISMATCH');assert.equal(puts,0);
  const artifact=vm.runInContext('INDICATOR_ARTIFACTS['+JSON.stringify(slug)+']',context);
  assert.equal(artifact.code,code);assert.equal(artifact.membershipRequired,false);assert.equal(artifact.releaseStatus,'awaiting_upload');
  assert.equal(artifact.runtime_client_version,3);assert.equal(artifact.previous,undefined);
  // Even a stored, hash-valid legacy fallback must never substitute for a signed-v3 client.
  artifact.previous={version:'legacy-test',filename:'unprotected.zip',r2Key:'legacy-test.zip',sha256:Buffer.from(await webcrypto.subtle.digest('SHA-256',fixture)).toString('hex')};
  stored={key:artifact.previous.r2Key,bytes:fixture,metadata:{sha256:artifact.previous.sha256,version:artifact.previous.version}};
  r=await call(route,signed);assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_NOT_READY');assert.equal(downloads,0);
  delete artifact.previous;stored=null;downloads=0;
  const originalHash=artifact.sha256;
  // Replace only the in-memory fixture pin; paid customer binaries never enter this repository.
  artifact.sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',fixture)).toString('hex');
  r=await call(upload,admin,'PUT',fixture);assert.equal(r.status,200);assert.equal(r.data.storage_verified,true);
  r=await call(route,signed);assert.equal(r.status,200);assert.deepEqual(Array.from(r.data),Array.from(fixture));assert.equal(downloads,1);
  assert(r.headers.get('Cache-Control').includes('private'));assert(r.headers.get('Content-Disposition').includes(artifact.filename));
  grants=['indicator_membership'];r=await call(route,signed);assert.equal(r.status,200);
  grants=['premium_membership'];r=await call(route,signed);assert.equal(r.status,200);
  corruptReadback=true;r=await call(route,signed);assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_CONTENT_MISMATCH');
  r=await call(upload,admin,'PUT',fixture);assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_STORAGE_MISMATCH');corruptReadback=false;
  artifact.sha256=originalHash;
  const page=fs.readFileSync('tools/indicators/'+slug.replace(/-mt5$/,'')+'/index.html','utf8');
  for(const text of ['data-download="'+slug+'"','data-artifact-state="'+slug+'"','已完成本机 MT5 原生加载、历史计算与图表检查','/assets/indicator-download.js','/assets/delivery-status.js'])assert(page.includes(text),slug+': '+text);
}
console.log('MT5 indicator ports: legacy product entitlement reuse, both membership tiers, cross-product denial, hash-gated upload/readback, private downloads, corruption rejection and platform controls passed.');
