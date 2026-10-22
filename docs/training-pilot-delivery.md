# Breakout training delivery — staged implementation

Status: local acceptance only. No production rollout and no live checkout activation.

Product `training_breakout_v1` grants an independent 30-day entitlement. It never grants indicator, EA or Builder quotas. Suggested study schedule is seven days; access duration is thirty days. Current USD 12 price is a sandbox test value, not a validated selling price.

## Private course storage

The repository is public. Do not commit the complete authored course, answer key, or internal review package. The Worker loads the pinned `pilot-2026-10-22` course from the existing private `USER_CODE_BUCKET` R2 binding at:

`private/training/breakout-confirmation/pilot-2026-10-22.json`

Do not enable R2 public access or expose this object through static assets. The internal authoring deliverable `author/server-content.json` is the upload source; it remains outside this repository. The two-case public sample is intentionally public. CI uses a separate toy fixture, not the paid course. `src/**` and `scripts/**` remain excluded by `.assetsignore`.

## Controls

- Default delivery closed. `T5_TRAINING_DELIVERY_ENABLED=true` is required.
- Checkout additionally requires `T5_TRAINING_SANDBOX_CHECKOUT=true`, explicit `PAYPAL_ENVIRONMENT=sandbox`, private content presence and normal account/payment readiness. Live checkout requires T5_TRAINING_LIVE_CHECKOUT=true and TRAINING_LAUNCH_ORDER_ID pointing to a refunded sandbox training order with both verified capture/refund callbacks and a stored content hash matching the pinned private object. The switches are not enabled by this patch.
- Existing signed-in session resolves user ID. Clients cannot supply a different learner ID.
- GET course/case is entitlement checked. No answer, future, explanation or assessment tag before an eligible submission.
- Before daily practice the learner must submit all three pretest cases. Before posttest the learner must submit all previous cases. Pre/post scores and answers are withheld until the group is complete.
- Server validates choices and computes the grade. Append-only attempts are ordered by database sequence; the first accepted attempt never changes. A request ID is unique per account/version, so network replay adds no attempt. A new attempt requires a new ID.
- POST requires same-origin Origin and rejects cross-site fetches.
- Expiry/revocation blocks content and new submissions, while account-bound response/score records remain readable/exportable. Only the current pinned content version has a public report route; a future version migration needs an explicit historical-report policy.
- Existing verified capture and webhook handling grants the entitlement. Duplicate capture does not extend access. Verified full refund and dispute handling revoke/suspend by source order; learning records are retained. Partial refunds follow the existing manual policy and do not automatically revoke.
- Training terms version is training-v1-2026-10-22. Refund eligibility is a seven-calendar-day window from successful payment, regardless of use, with manual support processing. Tool-download/AI usage rules never govern this product. The public privacy page discloses server-side paid-training records.

## Local verification

`node scripts/prepare-release.mjs --local-test`

`node scripts/training-behavior-check.mjs`

The same suite accepts a private course path as its first argument to verify the actual sixteen-case author file without adding it to source control.

`node scripts/training-local-preview.mjs /absolute/path/to/author/server-content.json`

Preview binds only 127.0.0.1:8877 and uses an isolated temporary SQLite database and a local test session. Its PayPal and AI responses are mocked. It is not an authenticated production customer account. Only the training/sample asset paths are served, never src, scripts or the private author file. The helper is excluded from deployed assets. Closing the helper ends the local preview; it does not modify production.

Pages:
- `/training/breakout-confirmation/`: two-case public sample draft, noindex.
- `/training/breakout-confirmation/member/`: account-bound training interface.
- `/training/breakout-confirmation/checkout/`: explicitly labeled sandbox-only checkout and provider return handler.

Automated acceptance covers full routing through runtime/account/payment layers and SQLite, ownership, default/live checkout closure, server-owned price, duplicate capture, all sixteen submissions, sealed assessment groups, immutable first attempts, replay, cross-origin rejection, expiry, full refund and late recapture rejection. The ordinary delivery regression also passes with mocked outage tests.

## Still required before selling

1. Review the real course and sales/refund copy as a customer; keep every claim consistent with synthetic teaching data.
2. Deploy to an isolated staging Worker/database/bucket, upload the private course, and execute an actual PayPal sandbox browser create/approve/return/capture/webhook/refund round trip. Current acceptance uses mocked provider responses; it is not proof of real PayPal connectivity.
3. Finalize tax, fees, support and refund details. The training-specific terms are pinned and eligibility is implemented; verify the actual merchant identity, PayPal currency and transaction receipt before enabling live checkout.
4. Review changes and run CI before production deployment. This patch does not upload content, set secrets/flags, migrate the live database, or open sales.


## Existing protected sandbox adapter

`/admin/training-sandbox/` uses existing `PAYPAL_SANDBOX_CLIENT_ID`, `PAYPAL_SANDBOX_CLIENT_SECRET`, `PAYPAL_SANDBOX_WEBHOOK_ID` and `ENABLE_PAYPAL_SANDBOX_E2E=true`. It never changes the global live PayPal environment. Access requires the existing admin key; creating training orders also requires a signed-in T5 test account and the training-specific terms acceptance. Test orders and events are labeled in dedicated training sandbox tables in the existing D1 database; this adapter is controlled sandbox mode, not a separate staging Worker/database.

The administrator can upload the author file once to the pinned private R2 path. Existing content cannot be overwritten. The current uploaded object SHA is copied into each training sandbox test order. The admin page redirects only to sandbox.paypal.com and returns to the dedicated training admin page. Capture grants the separate training entitlement. `/admin/training-sandbox/learn/` uses the same account-bound learner endpoints under an admin-protected prefix while public training remains closed.

Only signature-verified actual sandbox callbacks populate `training_sandbox_webhook_events` remotely. Both payment/refund callback types, final refunded order state and exact content hash are required by the live checkout gate. Mock tests run on temporary local SQLite and do not satisfy a production gate.

Before approving a test order, ensure the existing sandbox application's webhook URL is `https://t5quantlab.com/api/payment/paypal-sandbox/webhook` and subscribes to capture completed/refunded and the existing reversal/dispute events. A manually captured/refunded order without signed callback evidence is not an accepted end-to-end result. Enable public delivery/live flags only after signed callbacks, actual training save and post-refund denial have all been checked. No live flags are set by this patch.

The operator must separately confirm test completion; this patch prepares the actual test surface but does not claim real PayPal testing occurred.
