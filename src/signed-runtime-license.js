// Signed lease transport for native indicators and opt-in EA v3 clients.
// Private signing material is generated server-side and encrypted in private R2.
import { runtimeLicenseResponse, LICENSE_PRODUCTS, activeEntitlement } from './runtime-license.js';
const KEY_PATH='private-runtime-signing/rsa2048-v3.enc.json';
const OWNER_EMAIL='cvvcvv2025@gmail.com';
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const hex=a=>Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');
const bytes=s=>new TextEncoder().encode(s);
const sha=async s=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(s))));
const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
const un64=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
const fromUrl=s=>un64(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));
async function wrappingKey(env){return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',bytes(env.ACCOUNT_AUTH_SECRET+':signed-runtime-v3')),{name:'AES-GCM'},false,['encrypt','decrypt']);}
async function readSigningKey(env){
 const stored=await env.USER_CODE_BUCKET.get(KEY_PATH);if(!stored)return null;
 const doc=await stored.json();
 if(doc.version!==3||!doc.iv||!doc.encrypted)throw Error('SIGNING_KEY_STORAGE_INVALID');
 const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(doc.iv),additionalData:bytes(KEY_PATH)},await wrappingKey(env),un64(doc.encrypted));
 const jwk=JSON.parse(new TextDecoder().decode(clear));const n=hex(fromUrl(jwk.n));
 if(n.length!==512||jwk.e!=='AQAB')throw Error('SIGNING_KEY_PARAMETERS_INVALID');
 return {jwk,n,kid:(await sha(n)).slice(0,16)};
}
export async function signingKeyAdmin(request,env){
 if(!env.ACCOUNT_AUTH_SECRET||!env.USER_CODE_BUCKET)return json({ok:false,code:'SIGNING_STORAGE_UNAVAILABLE'},503);
 let k=await readSigningKey(env);
 if(request.method==='POST'&&!k){
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey),iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(KEY_PATH)},await wrappingKey(env),bytes(JSON.stringify(jwk)));
  // Conditional create prevents concurrent admins from rotating a pinned key.
  await env.USER_CODE_BUCKET.put(KEY_PATH,JSON.stringify({version:3,iv:b64(iv),encrypted:b64(encrypted)}),{onlyIf:new Headers({'If-None-Match':'*'}),httpMetadata:{contentType:'application/json'}});
  k=await readSigningKey(env);if(!k)throw Error('SIGNING_KEY_READBACK_FAILED');
 }
 if(!['GET','POST'].includes(request.method))return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 return json({ok:true,configured:Boolean(k),...(k?{key_id:k.kid,modulus_hex:k.n,exponent:65537,algorithm:'RSASSA-PKCS1-v1_5/SHA-256',private_key_exported:false}:{}),customer_activation_changed:false});
}
export async function signingPublicKey(request,env){
 const k=await readSigningKey(env);return k?json({ok:true,key_id:k.kid,modulus_hex:k.n,exponent:65537,algorithm:'RSASSA-PKCS1-v1_5/SHA-256'}):json({ok:false,code:'SIGNING_KEY_NOT_PROVISIONED'},503);
}
export async function signedLeaseResponse(request,env,resolveSession){
 if(request.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 const raw=await request.text();if(raw.length>4096)return json({ok:false,code:'INVALID_REQUEST'},400);
 let b;try{b=JSON.parse(raw);}catch{return json({ok:false,code:'INVALID_REQUEST'},400);}
 if(b.protocol_version!==3||!/^[a-f0-9]{64}$/.test(String(b.nonce||''))||!/^[a-f0-9]{64}$/.test(String(b.terminal_id||'')))return json({ok:false,code:'CLIENT_UPGRADE_REQUIRED'},400);
 if(!LICENSE_PRODUCTS[b.product_code]?.platforms?.includes(b.platform))return json({ok:false,code:'INVALID_BINDING'},400);
 // Existing verifier retains active-entitlement checks, revoked token handling,
 // rate limits and the atomic single-terminal slot. No client email is trusted.
 const headers=new Headers(request.headers);headers.set('Accept','application/json');headers.delete('Content-Length');
 const originalNonce=b.nonce;
 const delegated=new Request(new URL('/api/licenses/verify',request.url),{method:'POST',headers,body:JSON.stringify({...b,protocol_version:2,nonce:originalNonce.slice(0,32)})});
 const verification=await runtimeLicenseResponse(delegated,env,resolveSession),state=await verification.json();
 if(!verification.ok||!state.ok)return json({...state,signed_protocol:3},verification.status);
 const k=await readSigningKey(env);if(!k)return json({ok:false,code:'SIGNING_KEY_NOT_PROVISIONED'},503);
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer /,'');
 const record=await env.BUILDER_DB.prepare('SELECT l.license_id,l.user_id,u.email FROM runtime_licenses l JOIN users u ON u.user_id=l.user_id WHERE l.token_hash=? AND l.status=\'active\'').bind(await sha(token)).first();
 const owner=record?.email===OWNER_EMAIL;
 const id=(await sha(record?.license_id||'qa:'+token)).slice(0,32);
 const wire=['T5S3',k.kid,id,b.product_code,b.platform,String(b.account_login),await sha(String(b.broker_server)),b.terminal_id,originalNonce,state.server_time,state.lease_until,state.expires_at||0,owner?'1':'0','active'].join('|');
 const key=await crypto.subtle.importKey('jwk',k.jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const signature=hex(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,bytes(wire))));
 return new Response(wire+'\n'+signature+'\n',{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export async function ownerProfileResponse(request,env,resolveSession){
 if(request.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 const user=await resolveSession(request,env);if(!user||user.email!==OWNER_EMAIL)return json({ok:false,code:'OWNER_REQUIRED'},403);
 const origin=request.headers.get('Origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({ok:false,code:'ORIGIN_MISMATCH'},403);
 const raw=await request.text();if(raw.length>4096)return json({ok:false,code:'INVALID_REQUEST'},400);
 let b;try{b=JSON.parse(raw);}catch{return json({ok:false,code:'INVALID_REQUEST'},400);}
 // Owner receives a bound helper credential download, not an unlocked binary.
 // Entitlement, product release gate and rebinding cooldown are still enforced.
 const k=await readSigningKey(env);if(!k)return json({ok:false,code:'SIGNING_KEY_NOT_PROVISIONED'},503);
 const activated=await runtimeLicenseResponse(new Request(new URL('/api/account/runtime-licenses',request.url),{method:'POST',headers:request.headers,body:JSON.stringify(b)}),env,resolveSession);
 const result=await activated.json();if(!activated.ok)return json(result,activated.status);

 const profile=['T5OWNER3',k.kid,b.product_code,b.platform,String(b.account_login),hex(bytes(String(b.broker_server))),result.license_key,Math.floor(Date.now()/1000)].join('|');
 const signingKey=await crypto.subtle.importKey('jwk',k.jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const profileSignature=hex(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',signingKey,bytes(profile))));
 return new Response(profile+'\n'+profileSignature+'\n',{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','Content-Disposition':`attachment; filename="T5Owner3_${b.product_code}_${b.platform}.credential"`}});
}

// Customer install credentials use the already compiled, signed profile envelope.
// T5OWNER3 is a legacy wire name, NOT an owner entitlement: lease-v3 derives the
// owner claim from the authenticated license record, never from this envelope.
export async function installProfileResponse(request,env,resolveSession){
 if(request.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 const user=await resolveSession(request,env);if(!user)return json({ok:false,code:'ACCOUNT_REQUIRED'},401);
 if((request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)||request.headers.get('Sec-Fetch-Site')==='cross-site')return json({ok:false,code:'ORIGIN_MISMATCH'},403);
 const raw=await request.text();if(raw.length>4096)return json({ok:false,code:'INVALID_REQUEST'},400);
 let b;try{b=JSON.parse(raw);}catch{return json({ok:false,code:'INVALID_REQUEST'},400);}
 if(!b||!LICENSE_PRODUCTS[b.product_code]?.platforms?.includes(b.platform)||LICENSE_PRODUCTS[b.product_code].protocol_version!==3||!/^[1-9][0-9]{0,19}$/.test(String(b.account_login||''))||typeof b.broker_server!=='string'||!b.broker_server.trim()||b.broker_server.length>120||/[\x00-\x1f\x7f]/.test(b.broker_server)||b.license_policy_version!=='signed-v3-20261028')return json({ok:false,code:'INVALID_BINDING'},400);
 b.account_login=String(b.account_login);b.broker_server=b.broker_server.trim();
 const catalog=await runtimeLicenseResponse(new Request(new URL('/api/account/runtime-licenses',request.url),{headers:request.headers}),env,resolveSession);
 if(!catalog.ok)return catalog;
 const data=await catalog.json();if(!data.products.some(p=>p.code===b.product_code&&p.enabled))return json({ok:false,code:'ENTITLEMENT_OR_RELEASE_REQUIRED'},403);
 if(!await activeEntitlement(env,user.user_id,b.product_code))return json({ok:false,code:'ENTITLEMENT_REQUIRED'},403);
 await env.BUILDER_DB.prepare('CREATE TABLE IF NOT EXISTS runtime_install_locks (lock_id TEXT PRIMARY KEY,nonce TEXT NOT NULL,lease_until INTEGER NOT NULL)').run();
 const lockId=user.user_id+':'+b.product_code,nonce=hex(crypto.getRandomValues(new Uint8Array(16))),now=Date.now();
 const lock=await env.BUILDER_DB.prepare('INSERT INTO runtime_install_locks(lock_id,nonce,lease_until) VALUES(?,?,?) ON CONFLICT(lock_id) DO UPDATE SET nonce=excluded.nonce,lease_until=excluded.lease_until WHERE runtime_install_locks.lease_until<=?').bind(lockId,nonce,now+30000,now).run();
 if(!Number(lock.meta?.changes))return json({ok:false,code:'INSTALL_RETRY'},409);
 try{return await issueInstallProfile(request,env,resolveSession,user,b);}finally{await env.BUILDER_DB.prepare('DELETE FROM runtime_install_locks WHERE lock_id=? AND nonce=?').bind(lockId,nonce).run();}
}
async function issueInstallProfile(request,env,resolveSession,user,b){
 const k=await readSigningKey(env);if(!k)return json({ok:false,code:'SIGNING_KEY_NOT_PROVISIONED'},503);
 let record=await env.BUILDER_DB.prepare('SELECT * FROM runtime_licenses WHERE user_id=? AND product_code=?').bind(user.user_id,b.product_code).first(),token;
 if(record?.status==='active'){
  if(record.platform!==b.platform||record.account_login!==b.account_login||record.broker_server!==b.broker_server)return json({ok:false,code:'ACTIVE_BINDING_EXISTS'},409);
  const path='private-runtime-install/'+record.license_id+'/'+record.token_hash+'.enc.json',obj=await env.USER_CODE_BUCKET.get(path);
  if(obj){
   const doc=await obj.json();
   const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(doc.iv),additionalData:bytes(path)},await wrappingKey(env),un64(doc.encrypted));
   const profile=new TextDecoder().decode(plain),f=profile.split('\n')[0].split('|');
   if(f.length!==8||await sha(f[6])!==record.token_hash)throw Error('INSTALL_PROFILE_STORAGE_INVALID');
   return profileDownload(profile,b);
  }
  // Upgrade an existing manual-key binding without revoke/cooldown bypass or
  // releasing its live terminal slot. CAS prevents parallel downloads rotating
  // each other's key. Existing short leases retain their original deadlines.
  token=hex(crypto.getRandomValues(new Uint8Array(32)));
  const changed=await env.BUILDER_DB.prepare("UPDATE runtime_licenses SET token_hash=? WHERE license_id=? AND token_hash=? AND status='active'").bind(await sha(token),record.license_id,record.token_hash).run();
  if(!Number(changed.meta?.changes))return json({ok:false,code:'INSTALL_RETRY'},409);
  record={...record,token_hash:await sha(token)};
 }else{
  const activated=await runtimeLicenseResponse(new Request(new URL('/api/account/runtime-licenses',request.url),{method:'POST',headers:request.headers,body:JSON.stringify(b)}),env,resolveSession);
  const result=await activated.json();if(!activated.ok)return json(result,activated.status);
  token=result.license_key;record={license_id:result.license_id,token_hash:await sha(token)};
 }
 const wire=['T5OWNER3',k.kid,b.product_code,b.platform,b.account_login,hex(bytes(b.broker_server)),token,Math.floor(Date.now()/1000)].join('|');
 const key=await crypto.subtle.importKey('jwk',k.jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const profile=wire+'\n'+hex(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,bytes(wire))))+'\n';
 const path='private-runtime-install/'+record.license_id+'/'+record.token_hash+'.enc.json',iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(path)},await wrappingKey(env),bytes(profile));
 await env.USER_CODE_BUCKET.put(path,JSON.stringify({version:3,iv:b64(iv),encrypted:b64(encrypted)}),{httpMetadata:{contentType:'application/json'}});
 return profileDownload(profile,b);
}
function profileDownload(profile,b){return new Response(profile,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':`attachment; filename="T5Owner3_${b.product_code}_${b.platform}.credential"`}});}
