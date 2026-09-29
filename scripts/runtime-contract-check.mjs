import fs from 'node:fs';

const errors=[];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const need=(src,text,label)=>{if(!src.includes(text))errors.push(`${label}: missing ${JSON.stringify(text)}`)};
const forbid=(src,re,label)=>{if(re.test(src))errors.push(`${label}: forbidden ${re}`)};

const wrangler=read('wrangler.jsonc');
const runtime=read('src/runtime-worker.js');
const marketing=read('src/marketing-worker.js');
const adminHub=read('admin/index.html');
const adminHealth=read('admin/health/index.html');

need(wrangler,'"main": "src/runtime-worker.js"','wrangler must use runtime guard');
need(runtime,'import app from "./marketing-worker.js";','runtime must preserve marketing stack');
need(runtime,'/api/health','public health endpoint');
need(runtime,'/api/admin/runtime-health','admin runtime health endpoint');
need(runtime,'/api/orders/create','order guard route');
need(runtime,'ACTIVE_ACCESS_REMAINS','backend duplicate purchase guard');
need(runtime,'accountSummary(request, env, ctx)','duplicate purchase guard must consult account summary');
need(runtime,'grantStillUsable','duplicate purchase guard must validate active usable grant');
need(runtime,'OPENAI_API_KEY','runtime must report OpenAI readiness');
need(runtime,'PAYPAL_CLIENT_ID','runtime must report PayPal readiness');
need(runtime,'RESEND_API_KEY','runtime must report email readiness');
need(runtime,'ACCOUNT_AUTH_SECRET','runtime must report account-secret readiness');
need(runtime,'AUDIT_HASH_SALT','runtime must report audit-salt readiness');
need(runtime,'SELECT 1 AS ok','admin health must actually query D1');
need(runtime,'USER_CODE_BUCKET.list({ limit: 1 })','admin health must actually touch R2');
need(runtime,'expectedTables','admin health must check critical tables');
need(runtime,'missing_secrets','admin health must report missing secret names only');
need(runtime,'if (typeof app.scheduled === "function") return app.scheduled(controller, env, ctx);','runtime must forward scheduled jobs');
need(marketing,'async scheduled(controller,env,ctx)','marketing cron must remain implemented');
forbid(runtime,/PAYPAL_CLIENT_SECRET\s*[:=]\s*env\.PAYPAL_CLIENT_SECRET|OPENAI_API_KEY\s*[:=]\s*env\.OPENAI_API_KEY|RESEND_API_KEY\s*[:=]\s*env\.RESEND_API_KEY/,'health output must not expose secret values');

need(adminHub,'noindex,nofollow','admin hub must remain private to search engines');
need(adminHub,'/admin/health/','admin hub must link runtime health');
need(adminHub,'/admin/accounts/','admin hub must link account admin');
need(adminHub,'/admin/campaigns/','admin hub must link campaign admin');
need(adminHealth,'noindex,nofollow','runtime health page must not be indexed');
need(adminHealth,'t5_admin_key_session','admin health key must use tab-scoped session store');
need(adminHealth,'sessionStorage','admin health must not persist key in localStorage');
need(adminHealth,'X-Builder-Access-Key','admin health must authenticate with admin key header');
need(adminHealth,'/api/admin/runtime-health','admin health page must call protected runtime endpoint');
need(adminHealth,'不会显示任何Secret值','admin health page must disclose secret-value privacy boundary');
forbid(adminHealth,/localStorage\.setItem\([^)]*admin|document\.cookie/i,'admin health must not persist admin key outside sessionStorage');

if(errors.length){console.error('Runtime contract failed:');for(const e of errors)console.error('- '+e);process.exit(1)}
console.log('Runtime contract OK: production guard, duplicate-purchase block, private health checks, admin surface and cron forwarding protected.');
