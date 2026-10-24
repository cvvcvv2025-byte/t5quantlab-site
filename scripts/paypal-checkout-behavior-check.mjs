import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const helper = fs.readFileSync('assets/paypal-checkout.js', 'utf8');
let checks = 0;
for (const page of ['membership/checkout/index.html', 'membership/automation-checkout/index.html', 'checkout/index.html']) {
  const html = fs.readFileSync(page, 'utf8');
  assert(html.indexOf('/assets/paypal-checkout.js') < html.indexOf('<script>'));
  const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const code = source.slice(0, source.lastIndexOf('(async()=>{'));
  for (const wechat of [true, false]) {
    const elements = new Map();
    const element = () => ({ textContent: '', className: '', disabled: false, style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, dataset: {}, appendChild() {}, after() {}, addEventListener() {} });
    const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
    let calls = 0, navigate = '', release;
    const response = new Promise(resolve => { release = resolve; });
    const ctx = vm.createContext({ URL, URLSearchParams, Intl, console, navigator: { userAgent: wechat ? 'MicroMessenger' : 'Safari' }, document: { getElementById: get, createElement: element }, location: { origin: 'https://t5quantlab.com', pathname: '/' + page.replace('index.html', ''), assign: url => { navigate = url; } }, localStorage: { setItem() {}, getItem() { return null; }, removeItem() {} }, setInterval() {}, clearInterval() {}, fetch: async () => { calls++; return response; } });
    vm.runInContext('window = this', ctx);
    vm.runInContext(helper, ctx);
    vm.runInContext(code, ctx);
    vm.runInContext("activeOrder={order_id:'TEST',order_token:'TEST'};catalog={providers:{paypal:{enabled:true}}}", ctx);
    const name = page.startsWith('membership/') ? 'paypal' : 'startPayPal';
    const first = vm.runInContext(name + '()', ctx);
    if (wechat) {
      await first; assert.equal(calls, 0, 'WeChat blocked before payment request');
      assert.match(get('message').textContent, /浏览器打开/); assert.equal(navigate, '');
      assert.equal(get('payPaypal').disabled, false); checks += 4;
    } else {
      await vm.runInContext(name + '()', ctx);
      assert.equal(calls, 1, 'duplicate clicks send one request');
      release({ ok: true, json: async () => ({ ok: true, approval_url: 'https://www.paypal.com/checkoutnow?token=TEST' }) });
      await first; assert.match(navigate, /^https:\/\/www.paypal.com\//); assert.equal(get('payPaypal').disabled, false); checks += 3;
    }
    for (const bad of ['http://www.paypal.com/pay', 'https://paypal.com.attacker.invalid/pay', 'https://user:pass@www.paypal.com/pay', 'javascript:alert(1)']) {
      assert.throws(() => ctx.T5PayPalCheckout.redirect(bad)); checks++;
    }
    assert.match(ctx.T5PayPalCheckout.message({ code: 'PAYPAL_APPROVAL_RECEIVED' }), /请勿重复付款/); checks++;
  }
}
console.log(`PayPal checkout behavior: ${checks} assertions passed; no live requests or captures.`);
