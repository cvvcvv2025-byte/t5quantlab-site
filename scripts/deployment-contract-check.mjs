import fs from 'node:fs';

const errors=[];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const need=(src,text,label)=>{if(!src.includes(text))errors.push(`${label}: missing ${JSON.stringify(text)}`)};
const forbid=(src,re,label)=>{if(re.test(src))errors.push(`${label}: forbidden ${re}`)};

const deploy=read('.github/workflows/deploy-production.yml');
const runbook=read('docs/PRODUCTION_RUNBOOK.md');
const wrangler=read('wrangler.jsonc');

need(deploy,'workflow_dispatch:','production deploy must retain manual recovery trigger');
need(deploy,'workflow_run:','production deploy must support automatic post-CI deployment');
need(deploy,'workflows: ["Syntax Check"]','automatic production deploy must follow Syntax Check');
need(deploy,"github.event.workflow_run.conclusion == 'success'",'automatic deploy must require green Syntax Check');
need(deploy,'ref: ${{ github.event.workflow_run.head_sha || github.sha }}','deploy must checkout the exact tested SHA');
need(deploy,'environment: production','production deploy must use GitHub production environment');
need(deploy,'cloudflare/wrangler-action@v4','deployment must use supported Wrangler action');
need(deploy,'secrets.CLOUDFLARE_API_TOKEN','deployment must read Cloudflare API token from GitHub secrets');
need(deploy,'secrets.CLOUDFLARE_ACCOUNT_ID','deployment must read Cloudflare account ID from GitHub secrets');
need(deploy,'d1 execute t5quantlab-builder --remote --file=./builder-schema.sql --yes','deployment must support remote D1 schema application');
need(deploy,'command: deploy','deployment must run Wrangler deploy');
need(deploy,'node scripts/runtime-contract-check.mjs','deployment preflight must validate runtime contract');
need(deploy,'node scripts/payment-contract-check.mjs','deployment preflight must validate payment contract');
need(deploy,'node scripts/production-payment-contract-check.mjs','deployment preflight must validate production payment ownership');
need(deploy,'node scripts/deployment-contract-check.mjs','deployment preflight must validate deployment contract');
need(deploy,'https://t5quantlab.com/api/health','deployment must run live public health smoke check');
need(deploy,'public_site_ready','post-deploy smoke must require public site readiness');
need(deploy,'free_source_inspector_ready','post-deploy smoke must require free inspector readiness');
need(deploy,"WARNING: checkout_ready=false",'post-deploy smoke must surface paid checkout readiness without hiding it');
forbid(deploy,/apiToken:\s*(?!\$\{\{\s*secrets\.CLOUDFLARE_API_TOKEN\s*\}\})\S+/,'Cloudflare API token must never be hardcoded');
forbid(deploy,/accountId:\s*(?!\$\{\{\s*secrets\.CLOUDFLARE_ACCOUNT_ID\s*\}\})\S+/,'Cloudflare account ID must be read from GitHub secrets');

need(wrangler,'"main": "src/runtime-worker.js"','Wrangler production entrypoint');
for(const token of ['OPENAI_API_KEY','ACCOUNT_AUTH_SECRET','RESEND_API_KEY','PAYPAL_CLIENT_ID','PAYPAL_CLIENT_SECRET','PAYPAL_WEBHOOK_ID','AUDIT_HASH_SALT','BUILDER_ACCESS_KEY','PAYPAL_ENVIRONMENT=live'])need(runbook,token,`runbook missing ${token}`);
need(runbook,'ENABLE_PAYMENT_TEST_MODE','runbook must explain sandbox test-mode boundary');
need(runbook,'https://t5quantlab.com/api/health','runbook must include public health check');
need(runbook,'https://t5quantlab.com/admin/health/','runbook must include private preflight check');
need(runbook,'ACTIVE_ACCESS_REMAINS','runbook must test duplicate-purchase blocking');
need(runbook,'3` analysis credits and `2` modification credits','runbook must verify 3+2 entitlement after payment');
need(runbook,'green GitHub `Syntax Check`','runbook must distinguish CI from live production verification');
need(runbook,'automatic production deploy','runbook must document automatic post-CI deployment');
need(runbook,'exact tested commit SHA','runbook must document tested-SHA deployment');

if(errors.length){console.error('Deployment contract failed:');for(const e of errors)console.error('- '+e);process.exit(1)}
console.log('Deployment contract OK: green-CI automatic tested-SHA deploy, Cloudflare secrets, remote D1 schema and live public smoke checks are protected.');
