# Alipay website checkout

This adapter adds CNY page-pay for the existing three account products. Training
checkout remains USD/PayPal. Existing PayPal checkout and stored product artifacts
are preserved. No source credential or real merchant PID is committed.

## Configuration and release gate

Keep `ALIPAY_CHECKOUT_ENABLED` absent or `false` until prices are approved and live
acceptance is complete. Set these in the production Worker's secrets:

- `ALIPAY_APP_ID`: approved application ID.
- `ALIPAY_PRIVATE_KEY`: application private key (PKCS#8 PEM/raw base64; PKCS#1
  exports are wrapped into PKCS#8 locally). Never the Alipay platform private key.
- `ALIPAY_PUBLIC_KEY`: Alipay platform public key downloaded for this application,
  not the application public key uploaded to Alipay.
- `ALIPAY_SELLER_ID`: the receiving merchant's 16-digit PID beginning 2088.
- `T5_BUILDER_PASS_PRICE_CNY_MINOR`, `T5_INDICATOR_MEMBERSHIP_PRICE_CNY_MINOR`,
  `T5_PREMIUM_MEMBERSHIP_PRICE_CNY_MINOR`: approved integer amounts in fen.
  There are no default CNY prices and no live FX conversion. An unpriced product
  cannot create a CNY order or expose an Alipay entry point.
- `ALIPAY_CHECKOUT_ENABLED=true`: final release switch, not set by this change.

User-reported merchant approval and uploaded keys alone are not live acceptance.
Never ask for private keys, payment passwords or OTPs in chat.

## Flow

Existing checkout pages show a CNY alternative only when the provider and that
product's price and delivery are ready. `/checkout/alipay/?product=...` creates
an ordinary logged-in, terms-accepted order using server prices and an account
binding. The adapter snapshots the app/merchant identity before returning a
signed official `alipay.trade.page.pay` URL. Old URLs have a fixed absolute
15-minute expiry; requesting a link again does not extend it.

`/api/payment/alipay/webhook` accepts form-encoded RSA2 notifications. Duplicate
parameters, wrong signatures, app/merchant/order/transaction/amount substitutions
and non-CNY orders fail closed. Only confirmed SUCCESS/FINISHED grants access.
Neither return_url parameters nor a signed outgoing URL constitute payment proof.

`/api/payment/alipay/query` is account AND order-token protected and verifies the
exact raw signed query response before reconciling a lost notification. New-sales
disabling does not disable processing existing paid callbacks or queries.
A short per-order lease serializes common transactional fulfillment, immutable
provider-event deduplication and Builder Pass credit normalization. Failures are
not acknowledged as success and are retryable. No emails or actual payment
provider mutations are performed by the test suite.

Closing a remote unpaid trade requires a signed successful `trade.close` result;
ordinary local cancel cannot invalidate a live Alipay receipt. A never-opened
link may be locally closed only after its fixed expiry plus a one-minute margin
and a verified TRADE_NOT_EXIST response. If payment won the race, it is reconciled
rather than canceled. Closed/refunded orders cannot be reactivated by old success
notifications.

A verified CLOSED for a previously paid matching trade revokes local access
because Alipay defines this as a fully refunded trade. A pending CLOSED cancels
without granting. Refund requests are reviewed through existing support and
executed by the merchant in Alipay; no new autonomous refund API is exposed.
Partial refunds/disputes require manual review. Lost refund notifications require
a signed query from the order page to reconcile; no unattended refund cron is
claimed here.

## Acceptance still required before customer launch

1. Approve all intended CNY prices and verify receiving PID, application and key
   format without exposing secrets.
2. Temporarily enable the channel for an explicitly authorized real checkout;
   user completes payment and confirms merchant/amount in Alipay.
3. Match the same transaction to the account order, exact CNY amount, one grant,
   refresh/relogin recovery and usable delivery. A signed URL is not sufficient.
4. Exercise approved refund in merchant UI and observe local revocation; do not
   create fake successful payments or substitute gifted membership for acceptance.

Local RSA keys, SQLite and signed provider fixtures cover forgery, ownership,
amount changes, rollback/retry, duplicate notifications, signed query, close,
full-refund revocation and existing-payments recovery while new sales are off.
These tests are engineering evidence, not a live payment receipt.
