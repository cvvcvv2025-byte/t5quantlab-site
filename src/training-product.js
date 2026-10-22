export const TRAINING_PRODUCT = 'training_breakout_v1';
export const TRAINING_TERMS = 'training-v1-2026-10-22';
export const TRAINING_PRICE_USD_MINOR = 1200;
export const TRAINING_REFUND_DAYS = 7;

// Live checkout requires an explicit operator switch and real, verified sandbox evidence
// for the exact pinned private content. A local/mock test cannot populate the remote ledger.
export async function trainingCheckoutOpen(env) {
  if (env.PAYPAL_ENVIRONMENT === 'sandbox') return env.T5_TRAINING_SANDBOX_CHECKOUT === 'true';
  if (env.PAYPAL_ENVIRONMENT !== 'live' || env.T5_TRAINING_LIVE_CHECKOUT !== 'true' || !env.TRAINING_LAUNCH_ORDER_ID) return false;
  try {
    const head = await env.USER_CODE_BUCKET?.head('private/training/breakout-confirmation/pilot-2026-10-22.json');
    const sha = head?.customMetadata?.sha256;
    if (!sha) return false;
    const proof = await env.BUILDER_DB.prepare(`SELECT o.order_id FROM orders o
      JOIN training_sandbox_test_orders t ON t.order_id=o.order_id
      WHERE o.order_id=? AND o.product_code='training_breakout_v1' AND o.status='refunded' AND t.content_sha256=?
      AND EXISTS (SELECT 1 FROM training_sandbox_webhook_events w WHERE w.order_id=o.order_id AND w.event_type='PAYMENT.CAPTURE.COMPLETED')
      AND EXISTS (SELECT 1 FROM training_sandbox_webhook_events w WHERE w.order_id=o.order_id AND w.event_type='PAYMENT.CAPTURE.REFUNDED')`).bind(env.TRAINING_LAUNCH_ORDER_ID,sha).first();
    return Boolean(proof);
  } catch { return false; }
}
