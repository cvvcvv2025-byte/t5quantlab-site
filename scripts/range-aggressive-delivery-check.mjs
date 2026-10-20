import { runtimeLicenseResponse } from '../src/runtime-license.js';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';

const source=fs.readFileSync('src/account-worker.js','utf8')
 .replace('import app from "./final-worker.js";','const app={fetch:()=>new Response("unused",{status:404})};')
 .replace("import { runtimeLicenseResponse } from './runtime-license.js';",'')
 .replace('export default {','globalThis.worker = {');
const context=vm.createContext({Request,Response,Headers,URL,TextEncoder,crypto:webcrypto,console,runtimeLicenseResponse});
vm.runInContext(source+'\nensureAccountDb=async()=>{};',context);
let grants=[],gets=0,puts=0,downloads=0,stored=null,corruptReadback=false;
const env={ACCOUNT_AUTH_SECRET:'test-secret',BUILDER_ACCESS_KEY:'test-admin-only',
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
let r=await call('/api/member/eas/range-aggressive/download');assert.equal(r.status,401);
r=await call('/api/member/eas/range-aggressive/download',signed);assert.equal(r.status,403);
grants=['trend_capture_mt5'];
r=await call('/api/member/eas/range-aggressive/download',signed);assert.equal(r.status,403);assert.equal(gets,0);
grants=['range_aggressive_mt4_mt5'];
r=await call('/api/member/eas/range-aggressive/access',signed);
assert.equal(r.status,200);assert.equal(r.data.entitled,true);assert.equal(r.data.artifact.ready,false);
r=await call('/api/member/eas/range-aggressive/download',signed);
assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_NOT_READY');
r=await call('/api/member/eas/trend-capture/download',signed);assert.equal(r.status,403);
r=await call('/api/admin/ea-artifacts/upload?artifact=range-aggressive',{},'PUT');assert.equal(r.status,403);
const fixture=new Uint8Array([80,75,3,4,7,8,9]);
r=await call('/api/admin/ea-artifacts/upload?artifact=range-aggressive',admin,'PUT',fixture);
assert.equal(r.status,400);assert.equal(r.data.code,'ARTIFACT_HASH_MISMATCH');assert.equal(puts,0);
const artifact=vm.runInContext('EA_ARTIFACTS["range-aggressive"]',context);
assert.equal(artifact.sha256,'ddba5758b7c9d2a899cb4efd6578d8b58e4437fded0592a202667a013fa84e89');
// Isolated test fixture only: exercise real hashing without committing paid binaries.
artifact.sha256=Buffer.from(await webcrypto.subtle.digest('SHA-256',fixture)).toString('hex');
r=await call('/api/admin/ea-artifacts/upload?artifact=range-aggressive',admin,'PUT',fixture);
assert.equal(r.status,200);assert.equal(r.data.storage_verified,true);assert.equal(puts,1);
r=await call('/api/member/eas/range-aggressive/access',signed);assert.equal(r.data.artifact.ready,true);
r=await call('/api/member/eas/range-aggressive/download',signed);
assert.equal(r.status,200);assert.deepEqual(Array.from(r.data),Array.from(fixture));assert.equal(downloads,1);
assert.equal(r.headers.get('X-T5-Artifact-SHA256'),artifact.sha256);
assert(r.headers.get('Cache-Control').includes('private'));
assert(r.headers.get('Content-Disposition').includes('MT4_MT5_Customer_Pack.zip'));
corruptReadback=true;
r=await call('/api/member/eas/range-aggressive/download',signed);
assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_CONTENT_MISMATCH');assert.equal(downloads,1);
r=await call('/api/admin/ea-artifacts/upload?artifact=range-aggressive',admin,'PUT',fixture);
assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_STORAGE_MISMATCH');
corruptReadback=false;
grants=['premium_membership'];
r=await call('/api/member/eas/trend-capture/download',signed);
assert.equal(r.status,503);assert.equal(r.data.code,'ARTIFACT_NOT_READY');
r=await call('/api/member/eas/range-aggressive/download',signed);assert.equal(r.status,200);
grants=['range_martingale_mt4'];
r=await call('/api/member/eas/range-aggressive/download',signed);assert.equal(r.status,403);
const adminPage=fs.readFileSync('admin/members/index.html','utf8');assert(adminPage.includes('ea:range-aggressive'));assert(adminPage.includes('range_aggressive_mt4_mt5'));
console.log('Aggressive delivery: isolated product grants, premium access, upload hash, storage readback, missing-file and corrupt-file rejection passed.');
