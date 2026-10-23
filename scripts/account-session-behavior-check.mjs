import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import runtime from '../src/runtime-worker.js';

const helper = fs.readFileSync('assets/account-session.js', 'utf8');
const login = [...fs.readFileSync('account/login/index.html', 'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
const tick = () => new Promise(resolve => setImmediate(resolve));
async function browser({ rejectCookie = false, authenticated = false, search = '?next=%2Faccount%2Fmember-center%2F' } = {}) {
  const elements = new Map(), redirects = [], calls = [];
  let cookie = authenticated, outage = false;
  function element(id) {
    if (!elements.has(id)) elements.set(id, { value: '', checked: false, disabled: false, textContent: '',
      classList: { add() {}, remove() {} }, focus() {}, handlers: {}, addEventListener(name, handler) { this.handlers[name] = handler; } });
    return elements.get(id);
  }
  const scope = { URL, URLSearchParams, console,
    location: { origin: 'https://t5quantlab.com', search, replace: value => redirects.push(value) },
    document: { getElementById: element },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (url === '/api/auth/me') return Response.json(outage ? { ok: false } : { ok: true, authenticated: cookie, user: cookie ? { email: 'member@example.invalid' } : undefined }, { status: outage ? 503 : 200 });
      if (url === '/api/auth/config') return Response.json({ ok: true, email_login_ready: true });
      if (url === '/api/auth/request-code') return Response.json({ ok: true, challenge_id: 'fake-challenge' });
      if (url === '/api/auth/verify-code') { cookie = !rejectCookie; return Response.json({ ok: true, authenticated: true }); }
      throw new Error('Unexpected browser request ' + url);
    }
  };
  scope.window = scope;
  vm.createContext(scope); vm.runInContext(helper, scope); vm.runInContext(login, scope);
  await tick(); await tick();
  return { scope, calls, redirects, element, setOutage: value => { outage = value; },
    async verify() {
      element('email').value = 'member@example.invalid';
      await element('sendCode').handlers.click();
      element('code').value = '123456';
      await element('verifyCode').handlers.click();
    } };
}

const good = await browser(); await good.verify();
assert.deepEqual(good.redirects, ['/account/member-center/']);
assert.deepEqual(good.calls.slice(-2).map(call => call.url), ['/api/auth/verify-code', '/api/auth/me']);
assert(good.calls.every(call => call.options.cache === 'no-store' && call.options.credentials === 'same-origin'));

const blocked = await browser({ rejectCookie: true }); await blocked.verify();
assert.deepEqual(blocked.redirects, [], 'a successful OTP without a stored cookie must not redirect');
assert(blocked.element('status').textContent.includes('未保留'));
await blocked.element('verifyCode').handlers.click();
await blocked.element('checkSession').handlers.click();
assert.equal(blocked.calls.filter(call => call.url === '/api/auth/verify-code').length, 1, 'session retry must not reuse a consumed OTP');
assert.deepEqual(blocked.redirects, []);

const stale = await browser({ authenticated: true }); stale.redirects.length = 0;
const messages = [];
await stale.scope.T5AccountSession.recover('/account/member-center/', text => messages.push(text));
assert.deepEqual(stale.redirects, [], 'an authenticated summary failure must not restart login');
assert(messages[0].includes('登录仍然有效'));
stale.setOutage(true);
await stale.scope.T5AccountSession.recover('/account/member-center/', text => messages.push(text));
assert.deepEqual(stale.redirects, [], 'network failure must not destroy login flow');

const missing = await browser();
await missing.scope.T5AccountSession.recover('/account/member-center/', () => {});
assert.equal(missing.redirects[0], '/account/login/?next=%2Faccount%2Fmember-center%2F&session=missing');
const returned = await browser({ authenticated: true, search: '?next=%2Faccount%2Fmember-center%2F&session=missing' });
assert.deepEqual(returned.redirects, [], 'a returning session error cannot bounce automatically');
await returned.element('checkSession').handlers.click();
assert.deepEqual(returned.redirects, ['/account/member-center/']);
for (const target of ['/account/login/', '/account/login/?next=/account/', '//example.invalid/', '/\\example.invalid/', 'https://example.invalid/']) {
  assert.equal(good.scope.T5AccountSession.safeNext(target), '/account/');
}

// Full routing stack, fake static assets only; no email, payment or customer data.
const env = { ASSETS: { fetch: async () => new Response('<html>Account</html>', { headers: { 'Cache-Control': 'public, max-age=600', 'Content-Type': 'text/html' } }) } };
for (const path of ['/account/login/?next=%2Faccount%2Fmember-center%2F', '/account/member-center/', '/api/auth/me']) {
  const response = await runtime.fetch(new Request('https://www.t5quantlab.com' + path), env, {});
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('Location'), 'https://t5quantlab.com' + path);
  assert.equal(response.headers.get('Set-Cookie'), null, 'origin normalization must not widen or mint credentials');
}
const account = await runtime.fetch(new Request('https://t5quantlab.com/account/member-center/'), env, {});
assert.equal(account.status, 200); assert(account.headers.get('Cache-Control').includes('no-store'));
const config = JSON.parse(fs.readFileSync('wrangler.jsonc', 'utf8'));
assert(config.assets.run_worker_first.includes('/account/*'), 'account documents must run origin/cache guards before assets');
console.log('Account session behavior OK: stored-cookie confirmation, blocked-cookie recovery, no OTP reuse, no auth bounce, safe return paths and canonical private account pages. No live emails or customer sessions.');
