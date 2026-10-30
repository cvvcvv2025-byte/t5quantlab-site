// Private, account-bound native build queue. No MQ source or signing private key is sent to GitHub.
import {activeEntitlement,runtimeLicenseResponse} from './runtime-license.js';
import {installProfileResponse,readInstallProfile} from './signed-runtime-license.js';
import {installZip} from './install-package.js';
import {COMPILER_IDENTITY} from './compiler-identity.js';
const PRODUCT='structure_decision_map_mt4', VERSION='0.3.1-single.1';
const json=(v,s=200)=>Response.json(v,{status:s,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const utf=s=>new TextEncoder().encode(s),hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const hash=async x=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof x==='string'?utf(x):x)));
const un64=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
const seconds=()=>Math.floor(Date.now()/1000);
const productMeta=p=>p===PRODUCT?{title:'结构决策面板',stem:'T5_Structure_Chart',revisions:COMPILER_IDENTITY.revisions}:COMPILER_IDENTITY.products?.[p];
export const singleFileProduct=p=>Boolean(productMeta(p));
export async function setupBuilds(env){
 await env.BUILDER_DB.batch([
 env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS native_chart_builds(job_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,license_id TEXT NOT NULL,token_hash TEXT NOT NULL,product_code TEXT NOT NULL,platform TEXT NOT NULL,account_login TEXT NOT NULL,broker_server TEXT NOT NULL,revision TEXT NOT NULL,profile_hash TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,claim_id TEXT,claimed_until INTEGER NOT NULL DEFAULT 0,artifact_key TEXT,artifact_sha256 TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,error_code TEXT)`),
 env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS native_chart_compilers(compiler_id TEXT PRIMARY KEY,last_seen INTEGER NOT NULL)`),
 env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS native_chart_nonces(nonce TEXT PRIMARY KEY,expires_at INTEGER NOT NULL)`),
 env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS native_chart_downloads(event_id TEXT PRIMARY KEY,job_id TEXT NOT NULL,user_id TEXT NOT NULL,sha256 TEXT NOT NULL,created_at INTEGER NOT NULL)`)
 ]);
}
async function currentLicense(env,j){
 if(!singleFileProduct(j.product_code)||j.revision!==revision(j.platform,j.product_code)||!String(env.RUNTIME_SIGNED3_PRODUCTS||'').split(',').map(s=>s.trim()).includes(j.product_code))return null;
 const row=await env.BUILDER_DB.prepare("SELECT l.* FROM runtime_licenses l JOIN users u ON u.user_id=l.user_id WHERE l.license_id=? AND l.user_id=? AND l.token_hash=? AND l.status='active' AND u.status='active'").bind(j.license_id,j.user_id,j.token_hash).first();
 return row&&row.product_code===j.product_code&&row.platform===j.platform&&row.account_login===j.account_login&&row.broker_server===j.broker_server&&await activeEntitlement(env,j.user_id,j.product_code)?row:null;
}
function revision(platform,product=PRODUCT){return productMeta(product)?.revisions?.[platform];}
async function publicJob(env,j){return {ok:true,delivery_mode:'single-file-chart',job_id:j.job_id,status:j.status,platform:j.platform,product_code:j.product_code,version:VERSION,...(j.status==='ready'?{sha256:j.artifact_sha256,download_url:'/api/account/runtime-licenses/single-file-builds/'+j.job_id+'/download',file_url:'/api/account/runtime-licenses/single-file-builds/'+j.job_id+'/file'}:{}),...(j.status==='failed'?{code:'NATIVE_BUILD_FAILED'}:{})};}
async function online(env){const row=await env.BUILDER_DB.prepare('SELECT last_seen FROM native_chart_compilers WHERE compiler_id=?').bind(COMPILER_IDENTITY.compiler_id).first();return row&&seconds()-Number(row.last_seen)<90;}
export async function enqueueSingleFile(request,env,resolveSession){
 if(request.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 const url=new URL(request.url);if(request.headers.get('Sec-Fetch-Site')==='cross-site'||request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({ok:false,code:'ORIGIN_MISMATCH'},403);
 const user=await resolveSession(request,env);if(!user)return json({ok:false,code:'ACCOUNT_REQUIRED'},401);
 const raw=await request.text();if(raw.length>4096)return json({ok:false,code:'INVALID_BINDING'},400);let b;try{b=JSON.parse(raw);}catch{return json({ok:false,code:'INVALID_BINDING'},400);}
 if(!b||typeof b!=='object'||Array.isArray(b)||!singleFileProduct(b.product_code)||!revision(b.platform,b.product_code))return json({ok:false,code:'SINGLE_FILE_PRODUCT_NOT_READY'},409);
 await setupBuilds(env);
 const catalog=await runtimeLicenseResponse(new Request(new URL('/api/account/runtime-licenses',request.url),{headers:request.headers}),env,resolveSession);if(!catalog.ok)return catalog;
 const prior=await env.BUILDER_DB.prepare("SELECT * FROM runtime_licenses WHERE user_id=? AND product_code=? AND status='active'").bind(user.user_id,b.product_code).first();
 if(prior&&prior.platform===b.platform&&prior.account_login===String(b.account_login)&&prior.broker_server===String(b.broker_server).trim()){
  const cachedId=(await hash(prior.license_id+'|'+prior.token_hash+'|'+revision(b.platform,b.product_code))).slice(0,48),cached=await env.BUILDER_DB.prepare("SELECT * FROM native_chart_builds WHERE job_id=? AND status='ready'").bind(cachedId).first();
  if(cached&&await currentLicense(env,cached))return json(await publicJob(env,cached));
 }
 // Never rotate/activate a customer's credential when no native compiler is available.
 if(!await online(env))return json({ok:false,code:'NATIVE_COMPILER_UNAVAILABLE'},503);
 const profileResponse=await installProfileResponse(new Request(request.url,{method:'POST',headers:request.headers,body:raw}),env,resolveSession);
 if(!profileResponse.ok)return profileResponse;
 const profile=await profileResponse.text(),f=profile.split('\n')[0].split('|');
 const record=await env.BUILDER_DB.prepare("SELECT * FROM runtime_licenses WHERE user_id=? AND product_code=? AND status='active'").bind(user.user_id,b.product_code).first();
 if(!record||record.token_hash!==await hash(f[6]))return json({ok:false,code:'INSTALL_RETRY'},409);
 const id=(await hash(record.license_id+'|'+record.token_hash+'|'+revision(b.platform,b.product_code))).slice(0,48),now=seconds();
 await env.BUILDER_DB.prepare(`INSERT OR IGNORE INTO native_chart_builds(job_id,user_id,license_id,token_hash,product_code,platform,account_login,broker_server,revision,profile_hash,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,'queued',?,?)`).bind(id,user.user_id,record.license_id,record.token_hash,b.product_code,b.platform,record.account_login,record.broker_server,revision(b.platform,b.product_code),await hash(profile),now,now).run();
 let j=await env.BUILDER_DB.prepare('SELECT * FROM native_chart_builds WHERE job_id=?').bind(id).first();
 if(j.status==='failed'&&j.attempts<3){await env.BUILDER_DB.prepare("UPDATE native_chart_builds SET status='queued',error_code=NULL,updated_at=? WHERE job_id=? AND status='failed' AND attempts<3").bind(now,id).run();j={...j,status:'queued'};}
 return json(await publicJob(env,j),j.status==='ready'?200:202);
}
export async function customerBuildResponse(request,env,resolveSession){
 if(request.method!=='GET')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 const user=await resolveSession(request,env);if(!user)return json({ok:false,code:'ACCOUNT_REQUIRED'},401);
 await setupBuilds(env);const m=new URL(request.url).pathname.match(/\/single-file-builds\/([a-f0-9]{48})(?:\/(download|file))?$/);if(!m)return json({ok:false,code:'NOT_FOUND'},404);
 const j=await env.BUILDER_DB.prepare('SELECT * FROM native_chart_builds WHERE job_id=? AND user_id=?').bind(m[1],user.user_id).first();
 if(!j)return json({ok:false,code:'NOT_FOUND'},404);
 if(!await currentLicense(env,j))return json({ok:false,code:'ENTITLEMENT_OR_BINDING_REVOKED'},403);
 if(!m[2])return json({...await publicJob(env,j),compiler_online:Boolean(await online(env))});
 if(j.status!=='ready')return json({ok:false,code:'NATIVE_BUILD_NOT_READY'},409);
 const obj=await env.USER_CODE_BUCKET.get(j.artifact_key);if(!obj)return json({ok:false,code:'ARTIFACT_MISSING'},503);const binary=await obj.arrayBuffer();if(await hash(binary)!==j.artifact_sha256)return json({ok:false,code:'ARTIFACT_HASH_MISMATCH'},503);
 const ext=j.platform==='MT5'?'ex5':'ex4',name=productMeta(j.product_code).stem+'_'+j.platform+'_AccountBound.'+ext;
 await env.BUILDER_DB.prepare('INSERT INTO native_chart_downloads VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),j.job_id,user.user_id,j.artifact_sha256,seconds()).run();
 const body=m[2]==='file'?binary:installZip({['MQL'+j.platform.slice(-1)+'/Experts/'+name]:new Uint8Array(binary),'READ-ME-FIRST.txt':instructions(j,name),'SHA256.txt':j.artifact_sha256+'  '+name+'\n'});
 return new Response(body,{headers:{'Content-Type':m[2]==='file'?'application/octet-stream':'application/zip','Content-Disposition':'attachment; filename="'+(m[2]==='file'?name:productMeta(j.product_code).stem+'_'+j.platform+'_Personal.zip')+'"','Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
}
function instructions(j,name){return `T5 ${productMeta(j.product_code).title} · 单文件专属版 ${VERSION}\r\n绑定：${j.platform} / ${j.account_login} / ${j.broker_server}\r\n\r\n1. 在终端选择“文件 → 打开数据文件夹”，把 ${name} 放进 MQL${j.platform.slice(-1)}/Experts。Mac/Wine 同样按终端打开的数据目录操作。\r\n2. 导航器“EA交易/专家顾问”右键刷新，在一个新的空白图表加载它。不要加载到已有交易EA的图表。本程序仅显示图表，不含下单接口，无需开启算法交易或DLL导入。\r\n3. 首次在“工具 → 选项 → EA交易/专家顾问”勾选允许 WebRequest，添加 https://t5quantlab.com。保持联网，等待面板出现。\r\n无需密钥、授权助手、SET、模板、字库或额外配置文件。中文资源已嵌入。多周期分别开图加载同一个文件。\r\n此文件仅用于上述绑定；到期、撤销或账号/服务器不匹配将停用。每分钟校验，已有签名租约离线最多5分钟。换终端前退出原终端并等待租约释放；同一绑定重装无需撤销，撤销后30分钟可换绑。请保管专属包。\r\n联系：t5quantlab@gmail.com\r\n`;}
async function compilerAuth(request,env,raw,identity){
 const id=request.headers.get('X-T5-Compiler'),stamp=request.headers.get('X-T5-Time'),nonce=request.headers.get('X-T5-Nonce'),signature=request.headers.get('X-T5-Signature');
 if(id!==identity.compiler_id||!/^\d{10}$/.test(stamp||'')||Math.abs(seconds()-Number(stamp))>60||!(/^[a-f0-9]{32}$/.test(nonce||''))||!(/^[a-f0-9]{512}$/.test(signature||'')))return false;
 const key=await crypto.subtle.importKey('spki',un64(identity.public_spki),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 const message=[request.method,new URL(request.url).pathname,stamp,nonce,await hash(raw)].join('\n');
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,Uint8Array.from(signature.match(/../g),v=>parseInt(v,16)),utf(message)))return false;
 await setupBuilds(env);await env.BUILDER_DB.prepare('DELETE FROM native_chart_nonces WHERE expires_at<?').bind(seconds()).run();
 const n=await env.BUILDER_DB.prepare('INSERT OR IGNORE INTO native_chart_nonces VALUES(?,?)').bind(nonce,seconds()+120).run();return Number(n.meta?.changes)===1;
}
export async function compilerResponse(request,env,identity=COMPILER_IDENTITY){
 if(request.method!=='POST')return json({ok:false,code:'METHOD_NOT_ALLOWED'},405);
 if(Number(request.headers.get('Content-Length')||0)>2400000)return json({ok:false,code:'TOO_LARGE'},413);
 const raw=await request.text();if(raw.length>2400000)return json({ok:false,code:'TOO_LARGE'},413);
 if(!await compilerAuth(request,env,raw,identity))return json({ok:false,code:'COMPILER_AUTH_REQUIRED'},403);
 let b;try{b=JSON.parse(raw);}catch{return json({ok:false,code:'INVALID_REQUEST'},400);}
 if(!b||typeof b!=='object'||Array.isArray(b))return json({ok:false,code:'INVALID_REQUEST'},400);
 const p=new URL(request.url).pathname,now=seconds();
 await env.BUILDER_DB.prepare('INSERT INTO native_chart_compilers VALUES(?,?) ON CONFLICT(compiler_id) DO UPDATE SET last_seen=excluded.last_seen').bind(COMPILER_IDENTITY.compiler_id,now).run();
 if(p.endsWith('/claim')){
  if(JSON.stringify(b.revisions)!==JSON.stringify(COMPILER_IDENTITY.revisions))return json({ok:false,code:'SOURCE_REVISION_MISMATCH'},409);
  await env.BUILDER_DB.prepare("UPDATE native_chart_builds SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,claim_id=NULL,error_code='CLAIM_EXPIRED' WHERE status='building' AND claimed_until<?").bind(now).run();
  const jobs=await env.BUILDER_DB.prepare("SELECT * FROM native_chart_builds WHERE status='queued' AND attempts<3 ORDER BY created_at LIMIT 10").all();
  for(const j of jobs.results||[]){
   if(j.product_code!==PRODUCT&&b.products?.[j.product_code]?.[j.platform]!==j.revision)continue;
   if(!await currentLicense(env,j)){await env.BUILDER_DB.prepare("UPDATE native_chart_builds SET status='cancelled' WHERE job_id=?").bind(j.job_id).run();continue;}
   const claim=crypto.randomUUID(),u=await env.BUILDER_DB.prepare("UPDATE native_chart_builds SET status='building',claim_id=?,claimed_until=?,attempts=attempts+1,updated_at=? WHERE job_id=? AND status='queued'").bind(claim,now+300,now,j.job_id).run();if(!Number(u.meta?.changes))continue;
   const profile=await readInstallProfile(env,j.license_id,j.token_hash);
   if(!profile||await hash(profile)!==j.profile_hash)return json({ok:false,code:'BUILD_PROFILE_INVALID'},503);
   return json({ok:true,job:{job_id:j.job_id,claim_id:claim,product_code:j.product_code,platform:j.platform,account_login:j.account_login,broker_server:j.broker_server,revision:j.revision,profile_hash:j.profile_hash,profile}});
  }
  return json({ok:true,job:null});
 }
 if(p.endsWith('/complete')||p.endsWith('/fail')){
  const j=await env.BUILDER_DB.prepare("SELECT * FROM native_chart_builds WHERE job_id=? AND claim_id=? AND status='building' AND claimed_until>=?").bind(String(b.job_id),String(b.claim_id),now).first();
  if(!j)return json({ok:false,code:'BUILD_CLAIM_INVALID'},409);
  if(!await currentLicense(env,j)){await env.BUILDER_DB.prepare("UPDATE native_chart_builds SET status='cancelled' WHERE job_id=?").bind(j.job_id).run();return json({ok:false,code:'ENTITLEMENT_OR_BINDING_REVOKED'},403);}
  if(p.endsWith('/fail')){await env.BUILDER_DB.prepare("UPDATE native_chart_builds SET status='failed',error_code='NATIVE_COMPILE_FAILED',updated_at=? WHERE job_id=? AND claim_id=?").bind(now,j.job_id,j.claim_id).run();return json({ok:true});}
  if(b.revision!==j.revision||b.profile_hash!==j.profile_hash||typeof b.compile_log!=='string'||b.compile_log.length>100000||!/0 errors, 0 warnings/.test(b.compile_log)||typeof b.binary!=='string'||b.binary.length>1800000)return json({ok:false,code:'BUILD_RECEIPT_INVALID'},400);
  let binary;try{binary=un64(b.binary);}catch{return json({ok:false,code:'BINARY_INVALID'},400);}
  if(binary.length<10000||binary.length>1200000||await hash(binary)!==b.sha256)return json({ok:false,code:'BINARY_HASH_MISMATCH'},400);
  const key='private-native-builds/'+j.job_id+'/'+j.claim_id+'/chart.ex'+j.platform.slice(-1);
  await env.USER_CODE_BUCKET.put(key,binary,{httpMetadata:{contentType:'application/octet-stream'},customMetadata:{sha256:b.sha256,revision:j.revision,profile_hash:j.profile_hash}});
  const readback=await env.USER_CODE_BUCKET.get(key);if(!readback||await hash(await readback.arrayBuffer())!==b.sha256)return json({ok:false,code:'BUILD_READBACK_FAILED'},503);
  await env.USER_CODE_BUCKET.put(key+'.compile.log',b.compile_log,{httpMetadata:{contentType:'text/plain'}});
  const changed=await env.BUILDER_DB.prepare("UPDATE native_chart_builds SET status='ready',artifact_key=?,artifact_sha256=?,updated_at=? WHERE job_id=? AND claim_id=? AND status='building'").bind(key,b.sha256,now,j.job_id,j.claim_id).run();
  return Number(changed.meta?.changes)?json({ok:true,sha256:b.sha256,readback_verified:true}):json({ok:false,code:'BUILD_CLAIM_INVALID'},409);
 }
 return json({ok:false,code:'NOT_FOUND'},404);
}
