import fs from 'node:fs';

function need(file, text, label) {
  const src = fs.readFileSync(file, 'utf8');
  if (!src.includes(text)) throw new Error(`${label}: missing ${JSON.stringify(text)} in ${file}`);
}

need('wrangler.jsonc', '"main": "src/final-worker.js"', 'worker entrypoint');
need('src/commercial-worker.js', 'const PASS_ANALYZE_CREDITS = 3;', 'analysis credits');
need('src/commercial-worker.js', 'const PASS_MODIFY_CREDITS = 2;', 'modify credits');
need('src/commercial-worker.js', 'const DEFAULT_USD_PRICE_MINOR = 1490;', 'USD launch price');
need('src/commercial-worker.js', 'refund-v1-2026-09-28', 'terms version');
need('src/commercial-worker.js', 'CUSTOMER.DISPUTE.CREATED', 'dispute create handling');
need('src/commercial-worker.js', 'CUSTOMER.DISPUTE.RESOLVED', 'dispute resolve handling');
need('src/final-worker.js', '/api/orders/refund-eligibility', 'refund eligibility endpoint');
need('src/final-worker.js', 'status = ?, updated_at = ?', 'grant dispute state update');
need('checkout/index.html', 'terms_accepted:true', 'checkout terms acceptance');
need('checkout/index.html', '/refund-policy/', 'refund policy link');
need('refund-policy/index.html', 'refund-v1-2026-09-28', 'published terms version');
need('builder-schema.sql', 'CREATE TABLE IF NOT EXISTS service_events', 'fulfillment ledger');
need('builder-schema.sql', 'CREATE TABLE IF NOT EXISTS payment_disputes', 'dispute ledger');

console.log('Payment contract checks passed.');
