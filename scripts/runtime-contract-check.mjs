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
need(runtime,'runtime-guard-v3','runtime version must include external deep checks');
need(runtime,'/api/health','public health endpoint');
need(runtime,'/api/admin/runtime-health','admin runtime health endpoint');
need(runtime,'/api/payments/catalog','payment catalog must be guarded by full-service readiness');
need(runtime,'guardedCatalog','runtime must gate checkout provider visibility');
need(runtime,'/api/orders/create','order guard route');
need(runtime,'CHECKOUT_NOT_READY','orders must fail closed until full checkout stack is ready');
need(runtime,'ACCOUNT_PRECHECK_FAILED','account precheck errors must fail closed before order creation');
need(runtime,'ACTIVE_ACCESS_REMAINS','backend duplicate purchase guard');
need(runtime,'accountSummaryPrecheck','duplicate purchase guard must consult account summary');
need(runtime,'grantStillUsable','duplicate purchase guard must validate active usable grant');
need(runtime,'/api/payment/paypal/create','PayPal create must be guarded after order creation');
need(runtime,'guardedPayPalCreate','PayPal redirect initiation must recheck checkout readiness');
need(runtime,'/api/payment/paypal/capture','PayPal capture must be guarded before charging');
need(runtime,'FULFILLMENT_NOT_READY_BEFORE_CAPTURE','capture must fail closed when fulfillment config disappears');
need(runtime,'guardedPayPalCapture','capture must recheck paid Builder readiness');
need(runtime,'checkoutReady = paidBuilderReady && (paypalEnvironment === "live" || paymentTestMode)','sandbox checkout must require explicit test mode');
need(runtime,'free_source_inspector_ready: assets','free inspector readiness must depend on deployed assets');
need(runtime,'production_ready: productionReady','admin health must distinguish production payment readiness');
need(runtime,'marketing_healthy: marketingHealthy','admin health must distinguish marketing readiness');
need(runtime,'expectedMarketingTables','marketing tables must be checked separately');

need(runtime,'externalDeepChecks','admin must support non-billable provider deep checks');
need(runtime,'new URL(request.url).searchParams.get("deep") === "1"','deep checks must be explicit opt-in');
need(runtime,'https://api.openai.com/v1/models/','OpenAI deep check must retrieve model metadata only');
need(runtime,'https://api.resend.com/domains?limit=100','Resend deep check must read domain status only');
need(runtime,'/v1/oauth2/token','PayPal deep check must validate OAuth credentials');
need(runtime,'/v1/notifications/webhooks/','PayPal deep check must retrieve configured webhook');
for(const event of ['PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.REFUNDED','PAYMENT.CAPTURE.REVERSED','CUSTOMER.DISPUTE.CREATED','CUSTOMER.DISPUTE.UPDATED','CUSTOMER.DISPUTE.RESOLVED'])need(runtime,event,`PayPal deep check missing required event ${event}`);
need(runtime,'production_verified: productionVerified','deep check must expose final production verification state');
need(runtime,'result.all_ok = result.openai_model.ok && result.paypal_oauth.ok && result.paypal_webhook.ok && result.resend_domains.ok','external production verification must require every provider check');
forbid(runtime,/https:\/\/api\.openai\.com\/v1\/responses|\/v1\/chat\/completions|api\.resend\.com\/emails/,'runtime deep health must not generate AI output or send email');

need(runtime,'OPENAI_API_KEY','runtime must report OpenAI readiness');
need(runtime,'PAYPAL_CLIENT_ID','runtime must report PayPal readiness');
need(runtime,'RESEND_API_KEY','runtime must report email readiness');
need(runtime,'ACCOUNT_AUTH_SECRET','runtime must report account-secret readiness');
need(runtime,'AUDIT_HASH_SALT','runtime must report audit-salt readiness');
need(runtime,'SELECT 1 AS ok','admin health must actually query D1');
need(runtime,'USER_CODE_BUCKET.list({ limit: 1 })','admin health must actually touch R2');
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
need(adminHealth,"'/api/admin/runtime-health'+(deep?'?deep=1':'')",'admin health page must request explicit deep mode');
need(adminHealth,'运行外部连接深检','admin health must expose deep-check control');
need(adminHealth,'不会生成 AI 内容、不会发送邮件、不会创建订单或扣款','admin must disclose non-billable deep-check boundary');
need(adminHealth,'生产外部连接验证','admin health must show final external verification');
need(adminHealth,'PayPal缺失事件','admin health must surface missing webhook subscriptions');
need(adminHealth,'Resend域名','admin health must surface sender-domain status');
need(adminHealth,'不会显示任何Secret值','admin health page must disclose secret-value privacy boundary');
need(adminHealth,'生产收款就绪','admin health must show production checkout separately');
need(adminHealth,'营销邮件','admin health must show marketing separately');
need(adminHealth,'Checkout入口','admin health must show order creation readiness');
forbid(adminHealth,/localStorage\.setItem\([^)]*admin|document\.cookie/i,'admin health must not persist admin key outside sessionStorage');

if(errors.length){console.error('Runtime contract failed:');for(const e of errors)console.error('- '+e);process.exit(1)}
console.log('Runtime contract OK: fail-closed payment, deep provider verification, production/marketing health, private admin surface and cron forwarding protected.');
