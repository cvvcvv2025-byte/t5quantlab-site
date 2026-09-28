import app from "./account-worker.js";

const BATCH_SIZE = 40;
const MAX_ATTEMPTS = 3;

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

function nowIso() { return new Date().toISOString(); }
function randomHex(bytes = 10) { const a=new Uint8Array(bytes);crypto.getRandomValues(a);return Array.from(a,b=>b.toString(16).padStart(2,"0")).join(""); }
function randomId(prefix){return `${prefix}-${randomHex(10)}`;}

async function sha256Hex(value){const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(value||"")));return Array.from(new Uint8Array(d),b=>b.toString(16).padStart(2,"0")).join("");}
async function constantTimeEqual(a,b){const[x,y]=await Promise.all([sha256Hex(a),sha256Hex(b)]);if(x.length!==y.length)return false;let diff=0;for(let i=0;i<x.length;i++)diff|=x.charCodeAt(i)^y.charCodeAt(i);return diff===0;}
async function hmacHex(secret,value){if(!secret)throw new Error("ACCOUNT_AUTH_SECRET_NOT_CONFIGURED");const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(String(secret)),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(String(value)));return Array.from(new Uint8Array(sig),b=>b.toString(16).padStart(2,"0")).join("");}

async function isAdmin(request,env){const supplied=request.headers.get("X-Builder-Access-Key")||"";return Boolean(env.BUILDER_ACCESS_KEY)&&constantTimeEqual(env.BUILDER_ACCESS_KEY,supplied);}

async function ensureMarketingDb(env){
  if(!env.BUILDER_DB)throw new Error("BUILDER_DB_NOT_CONFIGURED");
  await env.BUILDER_DB.batch([
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS marketing_campaigns (
      campaign_id TEXT PRIMARY KEY,
      subject TEXT NOT NULL,
      body_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      scheduled_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_marketing_campaign_status_time
      ON marketing_campaigns(status, scheduled_at)`),
    env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS marketing_deliveries (
      campaign_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      provider_message_id TEXT,
      error TEXT,
      updated_at TEXT NOT NULL,
      sent_at TEXT,
      PRIMARY KEY(campaign_id, user_id)
    )`),
    env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_marketing_delivery_status
      ON marketing_deliveries(campaign_id, status)`)
  ]);
}

function marketingConfigured(env){return Boolean(env.RESEND_API_KEY&&(env.MARKETING_EMAIL_FROM||env.AUTH_EMAIL_FROM)&&env.ACCOUNT_AUTH_SECRET);}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function bodyHtml(text){return escapeHtml(text).replace(/\n/g,"<br>");}

async function unsubscribeUrl(env,userId){const token=await hmacHex(env.ACCOUNT_AUTH_SECRET,`unsubscribe:${userId}`);return `https://t5quantlab.com/unsubscribe/?uid=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;}

async function sendCampaignEmail(env,{campaign,user}){
  if(!marketingConfigured(env))throw new Error("MARKETING_EMAIL_NOT_CONFIGURED");
  const unsub=await unsubscribeUrl(env,user.user_id);
  const from=env.MARKETING_EMAIL_FROM||env.AUTH_EMAIL_FROM;
  const html=`<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#102033;line-height:1.7"><div style="font-weight:800;margin-bottom:18px">T5 Quant Lab</div><div>${bodyHtml(campaign.body_text)}</div><hr style="border:0;border-top:1px solid #dfe6ed;margin:28px 0"><div style="font-size:12px;color:#6f8091">你收到这封邮件，是因为你主动订阅了 T5 产品与研究邮件。<br><a href="${unsub}">取消订阅</a></div></div>`;
  const text=`${campaign.body_text}\n\n---\n你收到这封邮件，是因为你主动订阅了 T5 产品与研究邮件。\n取消订阅：${unsub}`;
  const response=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${env.RESEND_API_KEY}`,
      "Content-Type":"application/json",
      "Idempotency-Key":`t5-campaign-${campaign.campaign_id}-${user.user_id}`
    },
    body:JSON.stringify({from,to:[user.email],subject:campaign.subject,text,html})
  });
  let data={};try{data=await response.json();}catch{}
  if(!response.ok)throw new Error(data?.message||data?.name||`RESEND_HTTP_${response.status}`);
  return String(data?.id||"");
}

async function createCampaign(request,env){
  if(!(await isAdmin(request,env)))return json({ok:false,error:"Unauthorized"},403);
  if(!marketingConfigured(env))return json({ok:false,error:"营销邮件服务尚未配置，需要 RESEND_API_KEY、MARKETING_EMAIL_FROM/AUTH_EMAIL_FROM、ACCOUNT_AUTH_SECRET。",code:"MARKETING_EMAIL_NOT_CONFIGURED"},503);
  await ensureMarketingDb(env);
  let body={};try{body=await request.json();}catch{}
  const subject=String(body.subject||"").trim().slice(0,180);
  const bodyText=String(body.body_text||"").trim().slice(0,20000);
  const scheduledAt=String(body.scheduled_at||"").trim();
  if(!subject||!bodyText||!scheduledAt||!Number.isFinite(Date.parse(scheduledAt)))return json({ok:false,error:"主题、正文和发送时间不能为空。",code:"INVALID_CAMPAIGN"},400);
  if(Date.parse(scheduledAt)<Date.now()-60000)return json({ok:false,error:"发送时间不能早于当前时间。",code:"INVALID_SCHEDULE"},400);
  const id=randomId("CMP"),now=nowIso();
  await env.BUILDER_DB.prepare(`INSERT INTO marketing_campaigns
    (campaign_id,subject,body_text,status,scheduled_at,created_at,updated_at)
    VALUES (?,?,?,'scheduled',?,?,?)`).bind(id,subject,bodyText,scheduledAt,now,now).run();
  return json({ok:true,campaign:{campaign_id:id,subject,status:"scheduled",scheduled_at:scheduledAt}});
}

async function listCampaigns(request,env){
  if(!(await isAdmin(request,env)))return json({ok:false,error:"Unauthorized"},403);
  await ensureMarketingDb(env);
  const rows=await env.BUILDER_DB.prepare(`SELECT campaign_id,subject,status,scheduled_at,created_at,updated_at,
      sent_count,failed_count,completed_at FROM marketing_campaigns ORDER BY created_at DESC LIMIT 100`).all();
  const usersTable=await env.BUILDER_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
  let subscribers=0;if(usersTable?.name){const r=await env.BUILDER_DB.prepare("SELECT COUNT(*) AS n FROM users WHERE status='active' AND marketing_consent=1").first();subscribers=Number(r?.n||0);}
  return json({ok:true,subscribers,campaigns:rows?.results||[]});
}

async function cancelCampaign(request,env){
  if(!(await isAdmin(request,env)))return json({ok:false,error:"Unauthorized"},403);
  await ensureMarketingDb(env);let body={};try{body=await request.json();}catch{}
  const id=String(body.campaign_id||"");if(!id)return json({ok:false,error:"缺少 campaign_id"},400);
  const result=await env.BUILDER_DB.prepare("UPDATE marketing_campaigns SET status='canceled',updated_at=? WHERE campaign_id=? AND status='scheduled'").bind(nowIso(),id).run();
  if(Number(result?.meta?.changes||0)!==1)return json({ok:false,error:"只有尚未开始发送的任务可以取消。"},409);
  return json({ok:true,campaign_id:id,status:"canceled"});
}

async function processOneCampaign(env,campaign){
  const usersTable=await env.BUILDER_DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
  if(!usersTable?.name){await env.BUILDER_DB.prepare("UPDATE marketing_campaigns SET status='completed',completed_at=?,updated_at=? WHERE campaign_id=?").bind(nowIso(),nowIso(),campaign.campaign_id).run();return;}
  await env.BUILDER_DB.prepare("UPDATE marketing_campaigns SET status='sending',updated_at=? WHERE campaign_id=? AND status IN ('scheduled','sending')").bind(nowIso(),campaign.campaign_id).run();
  const rows=await env.BUILDER_DB.prepare(`SELECT u.user_id,u.email
    FROM users u
    WHERE u.status='active' AND u.marketing_consent=1
      AND NOT EXISTS (
        SELECT 1 FROM marketing_deliveries d
        WHERE d.campaign_id=? AND d.user_id=u.user_id AND (d.status='sent' OR d.attempts>=?)
      )
    ORDER BY u.created_at ASC LIMIT ?`).bind(campaign.campaign_id,MAX_ATTEMPTS,BATCH_SIZE).all();
  const users=rows?.results||[];
  for(const user of users){
    const existing=await env.BUILDER_DB.prepare("SELECT attempts FROM marketing_deliveries WHERE campaign_id=? AND user_id=?").bind(campaign.campaign_id,user.user_id).first();
    const attempts=Number(existing?.attempts||0)+1;
    try{
      const messageId=await sendCampaignEmail(env,{campaign,user});
      await env.BUILDER_DB.prepare(`INSERT INTO marketing_deliveries
        (campaign_id,user_id,email,status,attempts,provider_message_id,error,updated_at,sent_at)
        VALUES (?,?,?,'sent',?,?,NULL,?,?)
        ON CONFLICT(campaign_id,user_id) DO UPDATE SET status='sent',attempts=excluded.attempts,
          provider_message_id=excluded.provider_message_id,error=NULL,updated_at=excluded.updated_at,sent_at=excluded.sent_at`)
        .bind(campaign.campaign_id,user.user_id,user.email,attempts,messageId,nowIso(),nowIso()).run();
    }catch(error){
      await env.BUILDER_DB.prepare(`INSERT INTO marketing_deliveries
        (campaign_id,user_id,email,status,attempts,error,updated_at)
        VALUES (?,?,?,'failed',?,?,?)
        ON CONFLICT(campaign_id,user_id) DO UPDATE SET status='failed',attempts=excluded.attempts,
          error=excluded.error,updated_at=excluded.updated_at`)
        .bind(campaign.campaign_id,user.user_id,user.email,attempts,String(error?.message||error).slice(0,500),nowIso()).run();
    }
  }
  const counts=await env.BUILDER_DB.prepare(`SELECT
      SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status='failed' AND attempts>=? THEN 1 ELSE 0 END) AS failed
    FROM marketing_deliveries WHERE campaign_id=?`).bind(MAX_ATTEMPTS,campaign.campaign_id).first();
  const remaining=await env.BUILDER_DB.prepare(`SELECT COUNT(*) AS n FROM users u
    WHERE u.status='active' AND u.marketing_consent=1
      AND NOT EXISTS (SELECT 1 FROM marketing_deliveries d WHERE d.campaign_id=? AND d.user_id=u.user_id AND (d.status='sent' OR d.attempts>=?))`)
    .bind(campaign.campaign_id,MAX_ATTEMPTS).first();
  const done=Number(remaining?.n||0)===0;
  await env.BUILDER_DB.prepare(`UPDATE marketing_campaigns SET status=?,sent_count=?,failed_count=?,completed_at=?,updated_at=? WHERE campaign_id=?`)
    .bind(done?'completed':'sending',Number(counts?.sent||0),Number(counts?.failed||0),done?nowIso():null,nowIso(),campaign.campaign_id).run();
}

async function processDueCampaigns(env){
  if(!marketingConfigured(env)||!env.BUILDER_DB)return;
  await ensureMarketingDb(env);
  const due=await env.BUILDER_DB.prepare(`SELECT campaign_id,subject,body_text,status,scheduled_at
    FROM marketing_campaigns WHERE status IN ('scheduled','sending') AND scheduled_at<=?
    ORDER BY scheduled_at ASC LIMIT 2`).bind(nowIso()).all();
  for(const campaign of due?.results||[])await processOneCampaign(env,campaign);
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url),p=url.pathname;
    if(p==="/api/admin/campaigns"&&request.method==="GET")return listCampaigns(request,env);
    if(p==="/api/admin/campaigns"&&request.method==="POST")return createCampaign(request,env);
    if(p==="/api/admin/campaigns/cancel"&&request.method==="POST")return cancelCampaign(request,env);
    return app.fetch(request,env,ctx);
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(processDueCampaigns(env));}
};
