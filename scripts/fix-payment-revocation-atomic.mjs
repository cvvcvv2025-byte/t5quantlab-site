import fs from 'node:fs';

const file = 'src/gated-worker.js';
let src = fs.readFileSync(file, 'utf8');
const start = src.indexOf('async function revokePaidOrder(');
const end = src.indexOf('\nfunction paypalBase', start);
if (start < 0 || end < 0) throw new Error('revokePaidOrder function boundary not found');

const current = src.slice(start, end);
for (const expected of [
  'const isNew = await recordPaymentEvent(env, {',
  'eventType: "payment_refunded"',
  'if (!isNew) return { orderId, duplicate: true };',
  "UPDATE orders SET status = 'refunded'"
]) {
  if (!current.includes(expected)) throw new Error(`Unexpected revokePaidOrder source; missing ${expected}`);
}

const replacement = `async function revokePaidOrder(env, { orderId, provider, eventId = null, providerTradeId = null, eventType = "payment_refunded" }) {
  await ensureAccessDb(env);
  const order = await env.BUILDER_DB.prepare("SELECT order_id, status, grant_id FROM orders WHERE order_id = ?").bind(orderId).first();
  if (!order) throw new Error("ORDER_NOT_FOUND");

  let existingEvent = null;
  if (eventId) {
    existingEvent = await env.BUILDER_DB.prepare(\`SELECT provider, event_type, order_id, provider_trade_id
      FROM payment_events WHERE event_key = ?\`).bind(\`${'${provider}'}:${'${eventId}'}\`).first();
    if (existingEvent) {
      if (String(existingEvent.provider || "") !== provider
        || String(existingEvent.event_type || "") !== eventType
        || (existingEvent.order_id && String(existingEvent.order_id) !== orderId)
        || (existingEvent.provider_trade_id && providerTradeId && String(existingEvent.provider_trade_id) !== providerTradeId)) {
        throw new Error("PAYMENT_EVENT_CONFLICT");
      }
    }
  }

  const updated = nowIso();
  const statements = [];
  if (eventId) {
    statements.push(env.BUILDER_DB.prepare(\`INSERT INTO payment_events
      (event_key, provider, event_type, order_id, provider_trade_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(event_key) DO NOTHING\`)
      .bind(\`${'${provider}'}:${'${eventId}'}\`, provider, eventType, orderId, providerTradeId, updated));
  }
  statements.push(
    env.BUILDER_DB.prepare("UPDATE orders SET status = 'refunded', updated_at = ? WHERE order_id = ?")
      .bind(updated, orderId)
  );
  if (order.grant_id) {
    statements.push(env.BUILDER_DB.prepare("UPDATE builder_access_grants SET status = 'revoked', updated_at = ? WHERE grant_id = ?")
      .bind(updated, order.grant_id));
  }

  // The provider event ledger and local access revocation must commit together.
  await env.BUILDER_DB.batch(statements);

  const revoked = await env.BUILDER_DB.prepare(\`SELECT o.status AS order_status, o.grant_id, g.status AS grant_status
    FROM orders o LEFT JOIN builder_access_grants g ON g.grant_id = o.grant_id
    WHERE o.order_id = ?\`).bind(orderId).first();
  if (revoked?.order_status !== "refunded" || (revoked?.grant_id && revoked?.grant_status !== "revoked")) {
    throw new Error("PAYMENT_REVOCATION_INCOMPLETE");
  }
  return { orderId, duplicate: Boolean(existingEvent) };
}
`;

src = src.slice(0, start) + replacement + src.slice(end);

const reversalNeedle = `await revokePaidOrder(env, {\n          orderId: local.orderId,\n          provider: "paypal",\n          providerTradeId: String(resource.id || ""),\n          eventId: eventId || \`reversal:${'${resource.id}'}\`\n        });`;
if (!src.includes(reversalNeedle)) throw new Error('PayPal reversal revoke call not found');
const reversalReplacement = `await revokePaidOrder(env, {\n          orderId: local.orderId,\n          provider: "paypal",\n          providerTradeId: String(resource.id || ""),\n          eventId: eventId || \`reversal:${'${resource.id}'}\`,\n          eventType: "payment_reversed"\n        });`;
src = src.replace(reversalNeedle, reversalReplacement);

fs.writeFileSync(file, src);
console.log('Updated refund/reversal revocation to atomic, retry-safe handling.');
