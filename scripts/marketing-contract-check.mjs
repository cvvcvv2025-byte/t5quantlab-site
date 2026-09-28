import fs from 'node:fs';

const errors=[];
const need=(file,text,label)=>{const src=fs.readFileSync(file,'utf8');if(!src.includes(text))errors.push(`${label}: missing ${JSON.stringify(text)} in ${file}`)};
const forbid=(file,re,label)=>{const src=fs.readFileSync(file,'utf8');if(re.test(src))errors.push(`${label}: forbidden pattern ${re} in ${file}`)};

need('wrangler.jsonc','"main": "src/marketing-worker.js"','marketing worker entrypoint');
need('wrangler.jsonc','"crons": ["*/15 * * * *"]','15-minute marketing scheduler');
need('src/marketing-worker.js','import app from "./account-worker.js";','marketing worker must preserve account/payment stack');
need('src/marketing-worker.js','marketing_consent=1','campaign recipients must be explicit opt-ins');
need('src/marketing-worker.js','status=\'active\'','campaign recipients must be active accounts');
need('src/marketing-worker.js','/unsubscribe/?uid=','marketing email must include unsubscribe URL');
need('src/marketing-worker.js','Idempotency-Key','Resend idempotency protection');
need('src/marketing-worker.js','MAX_ATTEMPTS = 3','bounded retry attempts');
need('src/marketing-worker.js','BATCH_SIZE = 40','bounded send batch');
need('src/marketing-worker.js','/api/admin/campaigns','protected campaign admin API');
need('src/marketing-worker.js','X-Builder-Access-Key','campaign API admin authentication');
need('src/marketing-worker.js','async scheduled','Cloudflare scheduled handler');
need('src/marketing-worker.js','scheduled_at<=?','only due campaigns may send');
need('src/marketing-worker.js','MARKETING_EMAIL_FROM||env.AUTH_EMAIL_FROM','marketing sender fallback');
need('builder-schema.sql','CREATE TABLE IF NOT EXISTS marketing_campaigns','campaign table');
need('builder-schema.sql','CREATE TABLE IF NOT EXISTS marketing_deliveries','delivery ledger');
need('admin/campaigns/index.html','noindex,nofollow','campaign admin must not be indexed');
need('admin/campaigns/index.html','sessionStorage','admin key must remain tab-scoped');
need('admin/campaigns/index.html','X-Builder-Access-Key','campaign admin must send admin key');
need('admin/campaigns/index.html','toISOString()','browser local schedule must convert to UTC ISO');
need('admin/campaigns/index.html','只会发给发送时仍保持营销订阅的用户','admin must disclose consent gating');
forbid('src/marketing-worker.js',/WHERE\s+u\.status='active'(?![\s\S]{0,120}marketing_consent=1)/i,'recipient query must not omit marketing consent');

if(errors.length){console.error('Marketing contract check failed:');for(const e of errors)console.error('- '+e);process.exit(1)}
console.log('Marketing contract OK: scheduled sends are admin-only, opt-in only, idempotent, retry-bounded and unsubscribe-enabled.');