import fs from 'node:fs';

const errors=[];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const need=(src,text,label)=>{if(!src.includes(text))errors.push(`${label}: missing ${JSON.stringify(text)}`)};
const forbid=(src,re,label)=>{if(re.test(src))errors.push(`${label}: forbidden ${re}`)};

const wrangler=read('wrangler.jsonc');
const runtime=read('src/runtime-worker.js');
const marketing=read('src/marketing-worker.js');

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

if(errors.length){console.error('Runtime contract failed:');for(const e of errors)console.error('- '+e);process.exit(1)}
console.log('Runtime contract OK: production guard, duplicate-purchase block, health checks and cron forwarding protected.');
