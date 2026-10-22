import { TRAINING_TERMS, TRAINING_PRICE_USD_MINOR, trainingCheckoutOpen } from './training-product.js';
const product = 'training_breakout_v1';
const version = 'pilot-2026-10-22';
export const TRAINING_CONTENT_KEY = 'private/training/breakout-confirmation/' + version + '.json';
async function loadCourse(env) {
  const object = await env.USER_CODE_BUCKET?.get(TRAINING_CONTENT_KEY);
  if (!object) return null;
  const course = JSON.parse(await object.text());
  if (course.contentVersion !== version || course.cases?.length !== 16 || !Array.isArray(course.policy)) throw Error('Invalid training content');
  return course;
}
const fields = ['action', 'reason', 'condition'];
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
const fail = (code, status) => json({ ok: false, code }, status);
async function ensureDb(env) {
  await env.BUILDER_DB.prepare(`CREATE TABLE IF NOT EXISTS training_attempts (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, content_version TEXT NOT NULL,
    case_id TEXT NOT NULL, request_id TEXT NOT NULL, choices TEXT NOT NULL, grade TEXT NOT NULL,
    created_at TEXT NOT NULL, UNIQUE(user_id, content_version, request_id))`).run();
  await env.BUILDER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_training_attempts_user
    ON training_attempts(user_id, content_version, case_id, seq)`).run();
}
async function access(env, userId) {
  const now = new Date().toISOString();
  return env.BUILDER_DB.prepare(`SELECT expires_at FROM product_entitlements WHERE user_id = ? AND product_code = ?
    AND status = 'active' AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)`).bind(userId, product, now, now).first();
}
async function attempts(env, userId) {
  return (await env.BUILDER_DB.prepare(`SELECT seq, case_id, request_id, choices, grade, created_at FROM training_attempts
    WHERE user_id = ? AND content_version = ? ORDER BY seq`).bind(userId, version).all()).results || [];
}
function records(rows) {
  const out = {};
  for (const row of rows) {
    const value = { choices: JSON.parse(row.choices), grade: JSON.parse(row.grade), at: row.created_at };
    const r = out[row.case_id] ||= { first: value, latest: value, attempts: 0 };
    r.latest = value; r.attempts++;
  }
  return out;
}
function unlocked(c, rec, course) {
  return !!rec[c.id] && (!['pre', 'post'].includes(c.phase) || course.cases.filter(x => x.phase === c.phase).every(x => rec[x.id]));
}
function report(rec, course) {
  const out = {};
  for (const c of course.cases) {
    const r = rec[c.id]; if (!r) continue;
    out[c.id] = { first: { choices: r.first.choices, at: r.first.at }, latest: { choices: r.latest.choices, at: r.latest.at }, attempts: r.attempts, feedback_pending: !unlocked(c, rec, course) };
    // Neither per-question nor aggregate grades may leak a partially submitted pre/post group.
    if (unlocked(c, rec, course)) { out[c.id].first.grade = r.first.grade; out[c.id].latest.grade = r.latest.grade; }
  }
  return out;
}
function safeCase(c) {
  return Object.fromEntries(['id', 'day', 'phase', 'group', 'title', 'direction', 'context', 'level', 'bars', 'rnet', 'reasonOptions', 'conditionOptions'].map(k => [k, c[k]]));
}
export async function trainingResponse(request, env, resolveSession) {
  if (env.T5_TRAINING_DELIVERY_ENABLED !== 'true') return fail('TRAINING_NOT_OPEN', 503);
  if (!env.BUILDER_DB) return fail('TRAINING_UNAVAILABLE', 503);
  const path = new URL(request.url).pathname.slice('/api/training/breakout/'.length);
  if (!['GET', 'POST'].includes(request.method)) return fail('METHOD_NOT_ALLOWED', 405);
  if (request.method === 'POST' && (request.headers.get('Origin') !== new URL(request.url).origin || request.headers.get('Sec-Fetch-Site') === 'cross-site')) return fail('SAME_ORIGIN_REQUIRED', 403);
  if (path === 'catalog' && request.method === 'GET') return json({
    ok: true, product_code: product, currency: 'USD', amount_minor: TRAINING_PRICE_USD_MINOR,
    sandbox_only: env.PAYPAL_ENVIRONMENT !== 'live', checkout_open: await trainingCheckoutOpen(env),
    terms_version: TRAINING_TERMS
  });
  const user = await resolveSession(request, env);
  if (!user) return fail('ACCOUNT_REQUIRED', 401);
  const course = await loadCourse(env);
  if (!course) return fail('TRAINING_CONTENT_NOT_READY', 503);
  await ensureDb(env);
  const entitlement = await access(env, user.user_id);
  const rec = records(await attempts(env, user.user_id));
  if (path === 'report' && request.method === 'GET') return json({ ok: true, content_version: version, active: !!entitlement, records: report(rec, course) });
  if (!entitlement) return fail('TRAINING_ACCESS_REQUIRED', 403);
  if (path === 'course' && request.method === 'GET') return json({ ok: true, content_version: version, course: course.course, disclosure: course.disclosure, policy: course.policy, expires_at: entitlement.expires_at, cases: course.cases.map(({ id, day, phase, group, title }) => ({ id, day, phase, group, title })) });
  if (path.startsWith('case/') && request.method === 'GET') {
    const c = course.cases.find(c => c.id === path.slice(5));
    if (!c) return fail('CASE_NOT_FOUND', 404);
    // Seal pretest before practice, and practice before posttest, so baseline answers remain independent.
    const prerequisite = c.phase === 'pre' ? [] : course.cases.filter(x => c.phase === 'post' ? x.phase !== 'post' : x.phase === 'pre');
    if (!prerequisite.every(x => rec[x.id])) return fail('PREREQUISITE_REQUIRED', 409);
    const feedback = unlocked(c, rec, course) ? { answer: c.answer, explanation: c.explanation, future: c.future, futureExplanation: c.futureExplanation } : null;
    return json({ ok: true, content_version: version, case: safeCase(c), feedback });
  }
  if (path === 'submit' && request.method === 'POST') {
    const text = await request.text(); if (text.length > 4096) return fail('PAYLOAD_TOO_LARGE', 413);
    let body; try { body = JSON.parse(text); } catch { return fail('INVALID_JSON', 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('INVALID_JSON', 400);
    if (body.content_version !== version) return fail('CONTENT_VERSION_MISMATCH', 409);
    const c = course.cases.find(c => c.id === body.case_id);
    if (!c || !/^[a-zA-Z0-9_-]{12,80}$/.test(body.request_id || '')) return fail('INVALID_SUBMISSION', 400);
    const prerequisite = c.phase === 'pre' ? [] : course.cases.filter(x => c.phase === 'post' ? x.phase !== 'post' : x.phase === 'pre');
    if (!prerequisite.every(x => rec[x.id])) return fail('PREREQUISITE_REQUIRED', 409);
    const a = body.choices;
    if (!a || !['WAIT', 'CANCEL', 'READY'].includes(a.action) || !c.reasonOptions.some(o => o.id === a.reason) || !c.conditionOptions.some(o => o.id === a.condition)) return fail('INVALID_CHOICES', 400);
    const choices = JSON.stringify(Object.fromEntries(fields.map(k => [k, a[k]])));
    const previous = await env.BUILDER_DB.prepare('SELECT case_id, choices FROM training_attempts WHERE user_id = ? AND content_version = ? AND request_id = ?').bind(user.user_id, version, body.request_id).first();
    if (previous && (previous.case_id !== c.id || previous.choices !== choices)) return fail('REQUEST_ID_CONFLICT', 409);
    const grade = Object.fromEntries(fields.map(k => [k, a[k] === c.answer[k]]));
    // Atomic insert gates on the entitlement again, so a concurrent revoke cannot commit a new answer.
    await env.BUILDER_DB.prepare(`INSERT INTO training_attempts (user_id, content_version, case_id, request_id, choices, grade, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM product_entitlements WHERE user_id = ? AND product_code = ?
      AND status = 'active' AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)) ON CONFLICT DO NOTHING`)
      .bind(user.user_id, version, c.id, body.request_id, choices, JSON.stringify(grade), new Date().toISOString(), user.user_id, product, new Date().toISOString(), new Date().toISOString()).run();
    if (!(await access(env, user.user_id))) return fail('TRAINING_ACCESS_REQUIRED', 403);
    const updated = records(await attempts(env, user.user_id));
    return json({ ok: true, content_version: version, records: report(updated, course) });
  }
  return fail('NOT_FOUND', 404);
}
