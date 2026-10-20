import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

let resendMode = 'restricted';
const source = fs.readFileSync('src/runtime-worker.js', 'utf8')
  .replace('import app from "./marketing-worker.js";', 'const app={};')
  .replace('import { releaseInfo } from "./release-info.js";', 'const releaseInfo={commit:"test"};')
  .replace('export default {', 'globalThis.worker={');
const context = vm.createContext({ Request, Response, URL, Headers, TextEncoder, crypto: webcrypto,
  AbortController, setTimeout, clearTimeout, btoa, console,
  async fetch(url) {
    if (url.includes('/v1/models/')) return Response.json({ id: 'test' });
    if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'test-token' });
    if (url.includes('/v1/notifications/webhooks?')) return Response.json({ webhooks: [{ id: 'WH-test', url: 'https://example.invalid/api/payment/paypal/webhook', event_types: [{ name: '*' }] }] });
    if (url.includes('/v2/payments/captures/')) return Response.json({ id: 'capture', status: 'COMPLETED', amount: { value: '14.90', currency_code: 'USD' } });
    if (url.includes('api.resend.com/domains')) return resendMode === 'verified'
      ? Response.json({ data: [{ name: 'example.invalid', status: 'verified', capabilities: { sending: 'enabled' } }] })
      : Response.json({ name: resendMode === 'restricted' ? 'restricted_api_key' : 'validation_error' }, { status: 401 });
    throw new Error('Unexpected request ' + url);
  }
});
vm.runInContext(source, context);
context.env = { OPENAI_API_KEY: 'fake', PAYPAL_CLIENT_ID: 'fake', PAYPAL_CLIENT_SECRET: 'fake', PAYPAL_WEBHOOK_ID: 'WH-test', PAYPAL_ENVIRONMENT: 'live', RESEND_API_KEY: 'fake', AUTH_EMAIL_FROM: 'test@example.invalid',
  BUILDER_DB: { prepare() { return { async all() { return { results: [{ order_id: 'ORDER-test', provider_trade_id: 'CAP-test', product_code: 'code_workshop_single', status: 'granted', amount_minor: 1490, currency: 'USD' }] }; } }; } } };
context.request = new Request('https://example.invalid/api/admin/runtime-health?deep=1');
let result = await vm.runInContext('externalDeepChecks(request,env)', context);
assert.equal(result.resend_domains.permission_limited, true);
assert.equal(result.resend_domains.domains.length, 0, 'unreadable domain list must not be reported as missing sender domains');
assert.equal(result.all_ok, false, 'sending-only permission is not proof that email delivery was verified');
assert.equal(result.paypal_delivery_samples[0].live_capture_found, true);
assert.equal(result.paypal_delivery_samples[0].amount_match, true);
resendMode = 'invalid'; result = await vm.runInContext('externalDeepChecks(request,env)', context);
assert.equal(result.resend_domains.permission_limited, false);
assert.equal(result.resend_domains.provider_error, 'validation_error');
resendMode = 'verified'; result = await vm.runInContext('externalDeepChecks(request,env)', context);
assert.equal(result.all_ok, true);
assert.equal(result.resend_domains.domains[0].ok, true);
console.log('Runtime health behavior OK: sending-only permission is distinct from invalid credentials and missing domains; existing live-capture evidence is read-only.');
