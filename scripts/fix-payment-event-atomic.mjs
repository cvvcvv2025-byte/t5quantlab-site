import fs from 'node:fs';

const file = 'src/gated-worker.js';
const src = fs.readFileSync(file, 'utf8');
const start = src.indexOf('async function completePaidOrder(');
const end = src.indexOf('\nasync function revokePaidOrder', start);
if (start < 0 || end < 0) throw new Error('completePaidOrder function boundary not found');

const current = src.slice(start, end);
for (const expected of [
  'await recordPaymentEvent(env, {',
  'const grantId = order.grant_id || randomId("GRANT")',
  'ON CONFLICT(token_hash) DO NOTHING',
  "UPDATE orders SET status = 'granted'"
]) {
  if (!current.includes(expected)) throw new Error(`Unexpected completePaidOrder source; missing ${expected}`);
}

const replacement = `async function completePaidOrder(env, { orderId, provider, providerTradeId, paidAmountMinor, currency, eventId = null }) {
  await ensureAccessDb(env);
  const order = await env.BUILDER_DB.prepare(\`SELECT order_id, builder_token_hash, product_code, amount_minor, currency, status, grant_id
    FROM orders WHERE order_id = ?\`).bind(orderId).first();
  if (!order) throw new Error("ORDER_NOT_FOUND");

  if (order.status === "granted" && order.grant_id) {
    return { orderId, grantId: order.grant_id, duplicate: true };
  }
  if (order.status !== "pending" && order.status !== "paid") throw new Error("ORDER_NOT_GRANTABLE");
  if (Number(paidAmountMinor) !== Number(order.amount_minor)) throw new Error("PAYMENT_AMOUNT_MISMATCH");
  if (String(currency || "").toUpperCase() !== String(order.currency).toUpperCase()) throw new Error("PAYMENT_CURRENCY_MISMATCH");
  if (!provider || !providerTradeId) throw new Error("PAYMENT_REFERENCE_REQUIRED");

  const product = PRODUCT_CATALOG[order.product_code];
  if (!product) throw new Error("PRODUCT_NOT_FOUND");

  let existingEvent = null;
  if (eventId) {
    existingEvent = await env.BUILDER_DB.prepare(\`SELECT provider, order_id, provider_trade_id
      FROM payment_events WHERE event_key = ?\`).bind(\`${'${provider}'}:${'${eventId}'}\`).first();
    if (existingEvent) {
      if (String(existingEvent.provider || "") !== provider
        || (existingEvent.order_id && String(existingEvent.order_id) !== orderId)
        || (existingEvent.provider_trade_id && String(existingEvent.provider_trade_id) !== providerTradeId)) {
        throw new Error("PAYMENT_EVENT_CONFLICT");
      }
    }
  }

  // Deterministic for a given order so concurrent capture/webhook fulfillment attempts
  // cannot point the order at different random grant IDs.
  const grantId = order.grant_id || \`GRANT-${'${orderId}'}\`;
  const created = nowIso();
  const expiresAt = new Date(Date.now() + product.expiresDays * 86400000).toISOString();
  const statements = [];

  if (eventId) {
    statements.push(env.BUILDER_DB.prepare(\`INSERT INTO payment_events
      (event_key, provider, event_type, order_id, provider_trade_id, created_at)
      VALUES (?, ?, 'payment_completed', ?, ?, ?) ON CONFLICT(event_key) DO NOTHING\`)
      .bind(\`${'${provider}'}:${'${eventId}'}\`, provider, orderId, providerTradeId, created));
  }

  statements.push(
    env.BUILDER_DB.prepare(\`INSERT INTO builder_access_grants
      (grant_id, token_hash, label, plan, status, analyze_remaining, modify_remaining, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)
      ON CONFLICT DO NOTHING\`)
      .bind(grantId, order.builder_token_hash, \`Order ${'${orderId}'}\`, order.product_code,
        product.analyzeCredits, product.modifyCredits, expiresAt, created, created),
    env.BUILDER_DB.prepare(\`UPDATE orders SET status = 'granted', payment_provider = ?, provider_trade_id = ?,
      grant_id = ?, paid_at = COALESCE(paid_at, ?), granted_at = COALESCE(granted_at, ?), updated_at = ?
      WHERE order_id = ? AND status IN ('pending','paid','granted')\`)
      .bind(provider, providerTradeId, grantId, created, created, created, orderId)
  );

  // D1 batch is transactional: payment event de-duplication, grant creation, and
  // order fulfillment either commit together or roll back together.
  await env.BUILDER_DB.batch(statements);

  const fulfilled = await env.BUILDER_DB.prepare(\`SELECT o.status, o.grant_id, g.grant_id AS live_grant
    FROM orders o LEFT JOIN builder_access_grants g ON g.grant_id = o.grant_id
    WHERE o.order_id = ?\`).bind(orderId).first();
  if (fulfilled?.status !== "granted" || !fulfilled?.grant_id || !fulfilled?.live_grant) {
    throw new Error("PAYMENT_FULFILLMENT_INCOMPLETE");
  }

  return { orderId, grantId: fulfilled.grant_id, duplicate: Boolean(existingEvent) };
}
`;

const next = src.slice(0, start) + replacement + src.slice(end);
fs.writeFileSync(file, next);
console.log('Updated completePaidOrder to atomic, retry-safe fulfillment.');
