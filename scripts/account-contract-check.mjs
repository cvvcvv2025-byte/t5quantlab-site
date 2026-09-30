import fs from 'node:fs';

const errors=[];
const need=(file,text,label)=>{const src=fs.readFileSync(file,'utf8');if(!src.includes(text))errors.push(`${label}: missing ${JSON.stringify(text)} in ${file}`)};
const forbid=(file,re,label)=>{const src=fs.readFileSync(file,'utf8');if(re.test(src))errors.push(`${label}: forbidden pattern ${re} in ${file}`)};

need('wrangler.jsonc','"main": "src/runtime-worker.js"','top-level worker entrypoint');
need('src/runtime-worker.js','import app from "./marketing-worker.js";','runtime guard must preserve marketing worker');
need('src/marketing-worker.js','import app from "./account-worker.js";','marketing wrapper must preserve account worker');
need('src/account-worker.js','import app from "./final-worker.js";','account worker must preserve payment stack');
need('src/account-worker.js','/api/auth/request-code','request-code endpoint');
need('src/account-worker.js','/api/auth/verify-code','verify-code endpoint');
need('src/account-worker.js','/api/auth/me','session endpoint');
need('src/account-worker.js','/api/account/summary','account dashboard endpoint');
need('src/account-worker.js','/api/account/marketing','marketing preference endpoint');
need('src/account-worker.js','/api/member/indicators/mtf-structure-panel/download','protected indicator download endpoint');
need('src/account-worker.js','product_entitlements','product entitlement storage');
need('src/account-worker.js','INDICATOR_ENTITLEMENT_REQUIRED','indicator download must fail closed without entitlement');
need('src/account-worker.js','/api/admin/accounts','protected account admin endpoint');
need('src/account-worker.js','/api/marketing/unsubscribe','unsubscribe endpoint');
need('src/account-worker.js','RESEND_API_KEY','Resend configuration');
need('src/account-worker.js','AUTH_EMAIL_FROM','verified sender configuration');
need('src/account-worker.js','ACCOUNT_AUTH_SECRET','account auth secret');
need('src/account-worker.js','marketing_consent INTEGER NOT NULL DEFAULT 0','marketing must default off');
need('src/account-worker.js','outHeaders.delete("Set-Cookie")','pending Builder cookie must be stripped for account orders');
need('src/account-worker.js','X-Builder-Access-Token','account-to-grant bridge');
need('src/account-worker.js','o.user_id = ?','grant must be scoped to logged-in user');
need('src/account-worker.js',"o.product_code = 'code_workshop_single'",'Builder grant must be scoped to Builder product');
forbid('src/account-worker.js',/password_hash|password_digest|CREATE TABLE[^;]*password/is,'password-based auth is not allowed in email-only MVP');

need('builder-schema.sql','CREATE TABLE IF NOT EXISTS users','users table');
need('builder-schema.sql','CREATE TABLE IF NOT EXISTS auth_challenges','auth challenge table');
need('builder-schema.sql','CREATE TABLE IF NOT EXISTS auth_sessions','auth session table');
need('builder-schema.sql','CREATE TABLE IF NOT EXISTS marketing_consent_events','consent ledger');
need('builder-schema.sql','CREATE TABLE IF NOT EXISTS product_entitlements','product entitlement table');
need('builder-schema.sql','CREATE TABLE IF NOT EXISTS member_download_events','member download audit table');
need('builder-schema.sql','user_id TEXT','orders must support user ownership');

need('account/login/index.html','type="email"','email-only login form');
need('account/login/index.html','marketingOptIn','explicit marketing opt-in');
need('account/login/index.html','默认不勾选','marketing opt-in must be explained as default off');
forbid('account/login/index.html',/type=["']password["']/i,'login page must not ask for password');
need('account/index.html','/api/account/summary','My T5 account summary');
need('account/index.html','/api/account/marketing','My T5 marketing preference');
need('account/index.html','t5_practice_progress_v2','legacy 132 local progress remains in existing account page');
need('account/index.html','/assets/account-local-training.js','My T5 local training overview');
need('assets/account-local-training.js','t5_specialist_progress_v1','specialist local progress');
need('assets/account-local-training.js','t5_hidden_future_sim_v1','Hidden Future local progress');
need('assets/account-local-training.js','288','specialist total shown locally');
need('assets/account-local-training.js','localStorage','training summary remains browser-local');
forbid('assets/account-local-training.js',/\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(/i,'local training summary must not upload training data');
need('checkout/index.html','readonly placeholder="请先登录"','checkout email must be account-bound and readonly');
need('checkout/index.html','/api/auth/me','checkout login guard');
need('checkout/index.html','ACCOUNT_REQUIRED','checkout handles auth requirement');
need('admin/accounts/index.html','X-Builder-Access-Key','admin emails protected by existing admin key');
need('admin/accounts/index.html','sessionStorage','admin key must not be persisted in localStorage');
need('unsubscribe/index.html','/api/marketing/unsubscribe','unsubscribe page');

if(errors.length){console.error('Account contract check failed:');for(const e of errors)console.error('- '+e);process.exit(1)}
console.log('Account contract OK: runtime -> marketing -> account stack, email-only auth, opt-in marketing, account/product-bound Builder access and local-only training summary protected.');
