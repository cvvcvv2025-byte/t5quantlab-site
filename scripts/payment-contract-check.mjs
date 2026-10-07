import fs from 'node:fs';

function need(file, text, label) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes(text)) throw new Error(`${label}: missing ${JSON.stringify(text)} in ${file}`);
}

function forbid(file, re, label) {
  const src = fs.readFileSync(file, 'utf8');
  if (re.test(src)) throw new Error(`${label}: forbidden ${re} in ${file}`);
}

need('wrangler.jsonc', '"main": "src/runtime-worker.js"', 'worker entrypoint');
need('src/runtime-worker.js', 'import app from "./marketing-worker.js";', 'runtime guard must preserve marketing/payment stack');
need('src/marketing-worker.js', 'import app from "./account-worker.js";', 'marketing wrapper must preserve account stack');
need('src/account-worker.js', 'import app from "./final-worker.js";', 'account wrapper must preserve final payment stack');
need('src/final-worker.js', 'import app from "./audit-guard-worker.js";', 'final worker must route through paid audit guard');
need('src/audit-guard-worker.js', 'import app from "./commercial-worker.js";', 'audit guard must preserve commercial stack');
need('src/audit-guard-worker.js', 'AUDIT_CONFIG_NOT_READY', 'paid audit guard must fail closed with explicit error');
need('src/audit-guard-worker.js', 'String(env.AUDIT_HASH_SALT || "").trim().length >= 16', 'audit salt must meet minimum secret length');
for(const route of ['/api/builder/upload','/api/builder/analyze','/api/builder/modify','/api/builder/download']) need('src/audit-guard-worker.js', route, `audit guard must protect ${route}`);
forbid('src/audit-guard-worker.js',/core\.fetch|OPENAI_API_KEY|USER_CODE_BUCKET\.put/,'audit guard must remain a side-effect-free preflight layer');

need('src/gated-worker.js', 'analyzeCredits: 1,', 'legacy base grant analysis credit');
need('src/gated-worker.js', 'modifyCredits: 1,', 'legacy base grant modify credit');
need('src/gated-worker.js', 'expiresDays: 30', 'base grant expiry');
need('src/gated-worker.js', 'const grantId = order.grant_id || `GRANT-${orderId}`;', 'payment fulfillment must use deterministic per-order grant id');
need('src/gated-worker.js', 'PAYMENT_EVENT_CONFLICT', 'duplicate provider events must be checked for ownership conflicts');
need('src/gated-worker.js', "VALUES (?, ?, 'payment_completed', ?, ?, ?) ON CONFLICT(event_key) DO NOTHING", 'payment completion event must be part of atomic fulfillment statements');
need('src/gated-worker.js', 'ON CONFLICT DO NOTHING', 'concurrent deterministic grant insert must be idempotent');
need('src/gated-worker.js', 'await env.BUILDER_DB.batch(statements);', 'payment event, grant and order update must commit in one transaction');
need('src/gated-worker.js', 'PAYMENT_FULFILLMENT_INCOMPLETE', 'payment fulfillment must verify a live grant before reporting success');
forbid('src/gated-worker.js',/const grantId = order\.grant_id \|\| randomId\("GRANT"\)/,'random grant id is unsafe under concurrent capture/webhook fulfillment');
need('src/gated-worker.js', 'function paypalSafeDiagnostics(error) {', 'PayPal failures must expose a sanitized diagnostic projection');
need('src/gated-worker.js', 'console.error("paypal_create_failed", JSON.stringify(diagnostics));', 'PayPal create diagnostics must be available in provider logs');
need('src/gated-worker.js', '[unit?.custom_id, unit?.invoice_id, unit?.reference_id]', 'PayPal capture must accept the documented purchase-unit reference_id while cross-checking every returned order reference');
need('src/gated-worker.js', 'handlePayPalCapture(request, ready.sandboxEnv, { adminAuthorized: true })', 'Sandbox admin capture must recover an approved order without relying on tab-local order tokens');
need('admin/paypal-sandbox/index.html', "orderId=q.get('order_id')||stored?.order_id||''", 'Sandbox callback order id must override stale tab-local test state');
for (const field of ['issue: diagnostics.issue','description: diagnostics.description','debug_id: diagnostics.debug_id']) {
  need('src/gated-worker.js', field, `PayPal safe diagnostic response missing ${field}`);
}
forbid('src/gated-worker.js',/paypal\s*:\s*(?:error\?\.|error\.|diagnostics\.)?paypal/,'raw PayPal error payload must never be returned to clients');

need('src/gated-worker.js', 'function paypalSandboxEnv(env) {', 'sandbox E2E must use an isolated PayPal credential projection');
for (const secret of ['PAYPAL_SANDBOX_CLIENT_ID','PAYPAL_SANDBOX_CLIENT_SECRET','PAYPAL_SANDBOX_WEBHOOK_ID']) {
  need('src/gated-worker.js', secret, `sandbox E2E missing isolated secret ${secret}`);
}
need('src/gated-worker.js', 'PAYPAL_ENVIRONMENT: "sandbox"', 'sandbox E2E must pin the PayPal API environment');
need('src/gated-worker.js', 'callbackPath: "/admin/paypal-sandbox/"', 'sandbox approval must return to the private test surface');
need('src/gated-worker.js', 'paypalSandboxE2EEnabled(env)', 'sandbox routes must fail closed behind an explicit feature flag');
need('src/gated-worker.js', 'await isAdmin(request, env)', 'sandbox control routes must require the admin key');
need('src/gated-worker.js', '/api/payment/paypal-sandbox/webhook', 'sandbox webhook must be isolated from the live endpoint');
need('src/gated-worker.js', '/v2/payments/captures/${encodeURIComponent(order.provider_trade_id)}/refund', 'sandbox cleanup must issue a provider refund');
need('src/gated-worker.js', "UPDATE payment_intents SET status = 'refunded'", 'refunds must synchronize the local payment-intent status');
need('src/gated-worker.js', 'row.status === "refunded" && row.payment_status !== "refunded"', 'Sandbox status must reconcile legacy refunded test records without another provider refund');
need('src/commercial-worker.js', 'url.pathname === "/api/admin/paypal-sandbox/capture"', 'sandbox capture must pass through commercial 3+2 normalization');
need('src/commercial-worker.js', 'url.pathname === "/api/payment/paypal-sandbox/webhook"', 'sandbox webhook must pass through commercial entitlement normalization');
need('admin/paypal-sandbox/index.html', 'X-Builder-Access-Key', 'sandbox UI must authenticate every control request');
need('admin/paypal-sandbox/index.html', 'sessionStorage', 'sandbox UI must keep admin and test state tab-scoped');
need('admin/paypal-sandbox/index.html', '3次分析与2次修改已自动授权', 'sandbox UI must verify the commercial entitlement result');
forbid('admin/paypal-sandbox/index.html',/PAYPAL_(?:SANDBOX_)?CLIENT_(?:ID|SECRET)|PAYPAL_(?:SANDBOX_)?WEBHOOK_ID/,'sandbox credentials must not appear in static admin assets');

need('src/commercial-worker.js', 'const PASS_ANALYZE_CREDITS = 3;', 'analysis credits');
need('src/commercial-worker.js', 'const PASS_MODIFY_CREDITS = 2;', 'modify credits');
need('src/commercial-worker.js', 'const PASS_EXPIRES_DAYS = 30;', 'commercial expiry');
need('src/commercial-worker.js', 'const DEFAULT_USD_PRICE_MINOR = 1490;', 'USD launch price');
need('src/commercial-worker.js', "VALUES (?, 'builder-pass-3a-2m-v1', ?) ON CONFLICT(grant_id) DO NOTHING", '3+2 entitlement adjustment marker must be idempotent');
need('src/commercial-worker.js', 'await env.BUILDER_DB.batch([', 'entitlement normalization must use transactional D1 batch');
need('src/commercial-worker.js', "WHERE grant_id = ? AND plan <> 't5_builder_pass_30d'", 'entitlement retries must not double-credit an already normalized grant');
need('src/commercial-worker.js', 'PASS_ANALYZE_CREDITS - 1, PASS_MODIFY_CREDITS - 1', 'legacy base 1+1 must adjust exactly to commercial 3+2');
need('src/commercial-worker.js', "SET plan = 't5_builder_pass_30d'", 'grant must be normalized to Builder Pass plan');
need('src/commercial-worker.js', 'refund-v1-2026-09-28', 'terms version');
need('src/commercial-worker.js', 'CUSTOMER.DISPUTE.CREATED', 'dispute create handling');
need('src/commercial-worker.js', 'CUSTOMER.DISPUTE.RESOLVED', 'dispute resolve handling');
need('src/final-worker.js', '/api/orders/refund-eligibility', 'refund eligibility endpoint');
need('src/final-worker.js', 'status = ?, updated_at = ?', 'grant dispute state update');
need('src/account-worker.js', 'p === "/api/orders/create"', 'account-bound order interception');
need('src/account-worker.js', 'outHeaders.delete("Set-Cookie")', 'pending Builder cookie stripping');
need('src/account-worker.js', 'body.email = user.email;', 'order email must follow logged-in account');
need('src/account-worker.js', "o.product_code = 'code_workshop_single'", 'Builder entitlement must be scoped to the purchased Builder product');

need('src/runtime-worker.js', 'ACTIVE_ACCESS_REMAINS', 'server-side duplicate purchase guard');
need('src/runtime-worker.js', 'ACCOUNT_PRECHECK_FAILED', 'account precheck must fail closed');
need('src/runtime-worker.js', 'CHECKOUT_NOT_READY', 'checkout must fail closed');
need('src/runtime-worker.js', 'FULFILLMENT_NOT_READY_BEFORE_CAPTURE', 'PayPal capture must fail closed when fulfillment config disappears');
need('src/runtime-worker.js', 'guardedPayPalCreate', 'PayPal create must recheck runtime readiness');
need('src/runtime-worker.js', 'guardedPayPalCapture', 'PayPal capture must recheck fulfillment readiness');
need('src/runtime-worker.js', 'String(env.AUDIT_HASH_SALT || "").trim().length >= 16', 'runtime paid readiness must match audit guard secret strength');

need('checkout/index.html', 'terms_accepted:true', 'checkout terms acceptance');
need('checkout/index.html', '/refund-policy/', 'refund policy link');
need('checkout/index.html', '/api/auth/me', 'checkout account guard');
need('src/runtime-worker.js', 'PAYPAL_NOT_LIVE', 'runtime must preserve the sandbox safety lock');
need('src/runtime-worker.js', 'PAID_SERVICE_NOT_READY', 'runtime must preserve the paid-service readiness lock');
for (const internalCode of ['PAYPAL_NOT_LIVE', 'PAID_SERVICE_NOT_READY', 'PAYPAL_NOT_CONFIGURED']) {
  if (fs.readFileSync('checkout/index.html', 'utf8').includes(internalCode)) throw new Error(`checkout must not expose internal provider state ${internalCode}`);
}
need('checkout/index.html', "return Boolean(p?.prices?.USD)&&Boolean(pp.enabled)", 'create order button must require enabled PayPal provider');
need('refund-policy/index.html', 'refund-v1-2026-09-28', 'published terms version');
need('builder-schema.sql', 'CREATE TABLE IF NOT EXISTS service_events', 'fulfillment ledger');
need('builder-schema.sql', 'CREATE TABLE IF NOT EXISTS payment_disputes', 'dispute ledger');
need('builder-schema.sql', 'user_id TEXT', 'orders must be account-bindable');

console.log('Payment contract checks passed: $14.90 / 30d / 3 analyses / 2 modifications, atomic payment/grant fulfillment, atomic retry-safe entitlement, fail-closed audit boundary, account/product binding, dispute handling and payment gates are protected.');
