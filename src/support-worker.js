const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
async function hash(value) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), x => x.toString(16).padStart(2, '0')).join(''); }
async function setup(env) {
  await env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS support_tickets (
    ticket_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, email TEXT NOT NULL, order_id TEXT,
    message TEXT NOT NULL, reply TEXT, status TEXT NOT NULL DEFAULT 'open', ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`).run();
}
export async function supportResponse(request, env) {
  const p = new URL(request.url).pathname;
  if (!['/api/support/tickets', '/api/admin/support', '/api/admin/support/reply'].includes(p)) return null;
  if (!env.BUILDER_DB || !env.ACCOUNT_AUTH_SECRET) return json({ ok: false, error: '支持服务暂不可用，请稍后重试。' }, 503);
  const admin = p.startsWith('/api/admin/');
  if (admin && (!env.BUILDER_ACCESS_KEY || await hash(request.headers.get('X-Builder-Access-Key') || '') !== await hash(env.BUILDER_ACCESS_KEY))) return json({ ok: false, error: 'Unauthorized' }, 403);
  await setup(env);
  if (admin && p === '/api/admin/support' && request.method === 'GET') {
    const rows = await env.BUILDER_DB.prepare('SELECT ticket_id,email,order_id,message,reply,status,created_at,updated_at FROM support_tickets ORDER BY created_at DESC LIMIT 100').all();
    return json({ ok: true, tickets: rows.results || [] });
  }
  if (request.method === 'GET' && !admin) {
    const token = request.headers.get('X-Support-Token') || '';
    if (!/^[a-f0-9]{64}$/.test(token)) return json({ ok: false, error: '查询码无效' }, 403);
    const ticket = await env.BUILDER_DB.prepare('SELECT ticket_id,status,reply,updated_at FROM support_tickets WHERE token_hash = ?').bind(await hash(token)).first();
    return ticket ? json({ ok: true, ticket }) : json({ ok: false, error: '查询码无效' }, 403);
  }
  if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  if (Number(request.headers.get('Content-Length') || 0) > 16000) return json({ ok: false, error: '内容过长' }, 413);
  const raw = await request.text();
  if (raw.length > 12000) return json({ ok: false, error: '内容过长' }, 413);
  let body; try { body = JSON.parse(raw); } catch { return json({ ok: false, error: '请求内容无效' }, 400); }
  const now = new Date().toISOString();
  if (admin) {
    const reply = String(body.reply || '').trim();
    if (!reply || reply.length > 4000) return json({ ok: false, error: '回复需为1至4000字' }, 400);
    const result = await env.BUILDER_DB.prepare("UPDATE support_tickets SET reply=?,status='replied',updated_at=? WHERE ticket_id=?").bind(reply, now, String(body.ticket_id || '')).run();
    return Number(result.meta?.changes || 0) === 1 ? json({ ok: true }) : json({ ok: false, error: '工单不存在' }, 404);
  }
  const email = String(body.email || '').trim().toLowerCase(), message = String(body.message || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || message.length < 10 || message.length > 4000 || body.consent !== true) return json({ ok: false, error: '请填写有效邮箱、10至4000字问题描述，并确认处理授权。' }, 400);
  const ip = await hash(env.ACCOUNT_AUTH_SECRET + ':support:' + (request.headers.get('CF-Connecting-IP') || 'unknown'));
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, x => x.toString(16).padStart(2, '0')).join('');
  const id = 'T5-S-' + crypto.randomUUID();
  const result = await env.BUILDER_DB.prepare(`INSERT INTO support_tickets
    (ticket_id,token_hash,email,order_id,message,status,ip_hash,created_at,updated_at)
    SELECT ?,?,?,?,?,'open',?,?,? WHERE (SELECT COUNT(*) FROM support_tickets WHERE ip_hash=? AND created_at>?) < 5`)
    .bind(id, await hash(token), email, String(body.order_id || '').slice(0, 100), message, ip, now, now, ip, new Date(Date.now() - 86400000).toISOString()).run();
  if (Number(result.meta?.changes || 0) !== 1) return json({ ok: false, error: '今日提交次数已达上限，请保留已有工单并查询回复。' }, 429);
  return json({ ok: true, ticket_id: id, query_token: token });
}
