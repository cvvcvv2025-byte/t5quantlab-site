import fs from 'node:fs';

function need(file, text, label) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes(text)) throw new Error(`${label}: missing ${JSON.stringify(text)} in ${file}`);
}

need('wrangler.jsonc', '"main": "src/marketing-worker.js"', 'worker entrypoint');
need('src/marketing-worker.js', 'import app from "./account-worker.js";', 'marketing wrapper must preserve account stack');
need('src/account-worker.js', 'import app from "./final-worker.js";', 'account wrapper must preserve commercial/payment stack');
need('src/commercial-worker.js', 'const PASS_ANALYZE_CREDITS = 3;', 'analysis credits');
need('src/commercial-worker.js', 'const PASS_MODIFY_CREDITS = 2;', 'modify credits');
need('src/commercial-worker.js', 'const DEFAULT_USD_PRICE_MINOR = 1490;', 'USD launch price');
need('src/commercial-worker.js', 'refund-v1-2026-09-28', 'terms version');
need('src/commercial-worker.js', 'CUSTOMER.DISPUTE.CREATED', 'dispute create handling');
need('src/commercial-worker.js', 'CUSTOMER.DISPUTE.RESOLVED', 'dispute resolve handling');
need('src/final-worker.js', '/api/orders/refund-eligibility', 'refund eligibility endpoint');
need('src/final-worker.js', 'status = ?, updated_at = ?', 'grant dispute state update');
need('src/account-worker.js', 'p === "/api/orders/create"', 'account-bound order interception');
need('src/account-worker.js', 'outHeaders.delete("Set-Cookie")', 'pending Builder cookie stripping');
need('src/account-worker.js', 'body.email = user.email;', 'order email must follow logged-in account');
need('checkout/index.html', 'terms_accepted:true', 'checkout terms acceptance');
need('checkout/index.html', '/refund-policy/', 'refund policy link');
need('checkout/index.html', '/api/auth/me', 'checkout account guard');
need('refund-policy/index.html', 'refund-v1-2026-09-28', 'published terms version');
need('builder-schema.sql', 'CREATE TABLE IF NOT EXISTS service_events', 'fulfillment ledger');
need('builder-schema.sql', 'CREATE TABLE IF NOT EXISTS payment_disputes', 'dispute ledger');
need('builder-schema.sql', 'user_id TEXT', 'orders must be account-bindable');

console.log('Payment contract checks passed.');
