# T5 Quant Lab — Production Runbook

This document is the operational checklist for `t5quantlab.com`. It is intentionally separate from product/content documentation.

## 1. Production entrypoint

The production Worker entrypoint must be:

```text
src/runtime-worker.js
```

Effective Worker stack:

```text
runtime-worker
  -> marketing-worker
  -> account-worker
  -> final-worker
  -> commercial-worker
  -> gated-worker
  -> worker
```

Do not deploy an inner Worker directly as the production entrypoint. The runtime layer contains checkout readiness checks, duplicate-purchase protection, runtime health endpoints, and scheduled-handler forwarding.

## 2. Cloudflare bindings

The Worker must have these bindings from `wrangler.jsonc`:

```text
ASSETS
BUILDER_DB          -> t5quantlab-builder
USER_CODE_BUCKET    -> t5quantlab-user-code
```

The production D1 database ID and R2 bucket name are already defined in `wrangler.jsonc`.

## 3. Required production secrets / variables

Never commit secret values to GitHub.

Required for the paid Builder path:

```text
OPENAI_API_KEY
ACCOUNT_AUTH_SECRET
RESEND_API_KEY
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
AUDIT_HASH_SALT
BUILDER_ACCESS_KEY
```

Required production variable:

```text
PAYPAL_ENVIRONMENT=live
```

The following sender variables are currently declared in `wrangler.jsonc` and their domains must be verified with the email provider:

```text
AUTH_EMAIL_FROM=T5 Quant Lab <login@t5quantlab.com>
MARKETING_EMAIL_FROM=T5 Quant Lab <updates@t5quantlab.com>
```

`ENABLE_PAYMENT_TEST_MODE` must be absent or false in production. It exists only to deliberately allow sandbox checkout during controlled testing.

## 4. GitHub deployment credentials

The manual `Deploy Production` workflow needs GitHub repository/environment secrets:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

Use a Cloudflare API token scoped only to the required account/resources. Never put either value in source files.

The workflow deploys the exact tested SHA after a successful main-push Syntax Check. Manual dispatch remains available for controlled recovery; avoid a second independent deployment pipeline.

## 5. Database schema

For a new environment or after schema additions, apply:

```text
builder-schema.sql
```

to the remote `t5quantlab-builder` D1 database before deployment. The manual deployment workflow can do this automatically.

The schema is additive (`CREATE TABLE/INDEX IF NOT EXISTS`). Account code also contains compatibility logic for the legacy `orders.user_id` column.

Critical core tables:

```text
users
auth_challenges
auth_sessions
orders
builder_access_grants
projects
jobs
versions
payment_intents
payment_events
order_terms
entitlement_adjustments
service_events
payment_disputes
```

Marketing tables are checked separately:

```text
marketing_consent_events
marketing_campaigns
marketing_deliveries
```

## 6. PayPal live configuration

Production checkout must remain closed until all of the following are true:

```text
PAYPAL_CLIENT_ID configured
PAYPAL_CLIENT_SECRET configured
PAYPAL_WEBHOOK_ID configured
PAYPAL_ENVIRONMENT=live
ENABLE_PAYMENT_TEST_MODE != true
```

Webhook URL:

```text
https://t5quantlab.com/api/payment/paypal/webhook
```

The webhook subscription must include the payment capture/refund/reversal and dispute events handled by the Worker.

Do not treat sandbox success as production payment verification.

## 7. Pre-flight checks after every production deploy

### Public check

Open:

```text
https://t5quantlab.com/api/health
```

Expected production state:

```text
public_site_ready: true
free_source_inspector_ready: true
account_ready: true
paid_builder_ready: true
checkout_ready: true
payment_environment: live
```

This endpoint never returns secret values.

### Private admin check

Open:

```text
https://t5quantlab.com/admin/health/
```

Enter `BUILDER_ACCESS_KEY` in the page. The key is stored only in that browser tab's `sessionStorage`.

Before accepting real payment, require:

```text
Core service health       PASS
Production payment ready  PASS
Account login             PASS
Paid Builder base         PASS
Checkout                  PASS
D1 actual query           PASS
R2 actual access          PASS
Free source inspection    PASS
```

Marketing may remain separate from the paid Builder launch, but if campaigns are going to be used, `Marketing email` must also pass.

## 8. Manual end-to-end launch test

Run this sequence with a test T5 account before public launch:

1. Open the home page and several Library/Market Lab pages.
2. Run Free Source Inspection with a harmless `.mq5`, `.mq4`, `.pine`, or `.txt` file. Confirm it stays local and makes no paid AI request.
3. Request a T5 email login code and complete login.
4. Open `My T5` and confirm account summary loads.
5. Open Checkout and confirm price is `$14.90`, package is `3 analyses / 2 modifications / 30 days`, and PayPal shows `Live`.
6. Create one real low-risk production order only after the previous checks pass.
7. Complete PayPal payment and confirm the order becomes `granted`.
8. Confirm My T5 shows exactly `3` analysis credits and `2` modification credits with a 30-day expiry.
9. Upload a source file. Confirm upload succeeds.
10. Run one paid analysis. Confirm analysis remaining changes from `3` to `2` only after success; a failed request must restore the reserved credit.
11. Run one modification. Confirm modify remaining changes from `2` to `1` only after success.
12. Download the generated source and CHANGELOG.
13. Refresh/re-login and confirm entitlement remains bound to the same T5 account.
14. Attempt a second purchase while credits remain. It must be blocked with `ACTIVE_ACCESS_REMAINS`.
15. Review the service/audit ledgers before opening checkout publicly.

## 9. Failure behavior that must remain fail-closed

The site must not create a payment order when:

- the paid-service runtime is incomplete;
- PayPal is sandbox outside explicit payment test mode;
- account entitlement pre-check fails;
- the logged-in account still has usable Builder credits.

A service outage is preferable to charging a customer when fulfillment cannot be verified.

## 10. Admin surfaces

```text
/admin/                 operations hub
/admin/health/          runtime pre-flight
/admin/accounts/        customer accounts
/admin/campaigns/       opt-in marketing campaigns
```

All admin pages must remain `noindex,nofollow`. Never expose the admin key in source code, URLs, screenshots, `localStorage`, or cookies.

## 11. What CI proves — and what it does not

A green GitHub `Syntax Check` proves repository-level contracts and syntax are consistent. It does not prove that:

- the latest commit has been deployed to Cloudflare;
- production secrets exist or are correct;
- email sender domains are verified;
- PayPal live credentials/webhook are valid;
- DNS is reachable from every network;
- a real PayPal capture has completed.

Those are production checks and must be confirmed after deployment with `/admin/health/` plus the manual end-to-end launch test above.


## 12. Automatic production deploy and live smoke

The normal release path is now an **automatic production deploy** after the GitHub `Syntax Check` workflow completes successfully on `main`. The deployment workflow checks out the **exact tested commit SHA** from that successful workflow run; it must not silently deploy an untested newer revision.

The manual `workflow_dispatch` entry remains available for controlled recovery or operator-initiated deployment.

After Wrangler deploy completes, GitHub Actions polls:

```text
https://t5quantlab.com/api/health
```

The release fails if the public site or free source inspector is not ready. The same smoke output also prints `account_ready`, `paid_builder_ready`, `checkout_ready`, and `payment_environment` so incomplete commercial configuration is visible in the deployment log rather than hidden.

A successful public smoke check does **not** replace the private `/admin/health/?deep=1` provider verification or the manual real-payment end-to-end test before opening live checkout.


## 13. Customer delivery recovery (2026-10-20)

- CI runs delivery-behavior-check.mjs against local SQLite with simulated providers; no live charge or email.
- The production build stamps release.commit/built_at. Deployment requires account, paid Builder and checkout readiness, live PayPal, and the expected commit in addition to public readiness.
- /api/products/delivery checks all seven registered object metadata records. Membership checkout fails closed when its promised files are unavailable.
- /admin/delivery/ reads actual customer package bytes and hashes, runs private provider health, and lists customer support tickets. Check the ticket queue daily; support currently uses on-site replies, not automatic email notifications.
- Download events retain source_order_id. Existing download records are attributed by purchase timestamp in an idempotent migration, independent of current entitlement renewal state.
- builder_operations records atomic quota reservations and blocks simultaneous execution per project/action. Explicit failures compensate once; the 15-minute cron reconciles abandoned attempts older than 15 minutes using persisted output. Provider calls time out after 120 seconds. Do not manually add credits until checking this ledger.
- New projects bind to verified accounts and are listed in My T5. Status, analysis and source downloads are recoverable without charging again. A legacy project may be linked only with its valid capability token.
- Before acceptance, use an existing authorised order to check seven downloads, native package contents, expired/revoked access and provider health. A successful public deployment alone is not acceptance of a real payment or trading performance.
# Release origin boundary (2026-10-20)

The generated `src/release-info.js` is deliberately absent from git. A fresh
Cloudflare Git-integration deployment cannot bundle the Worker without it.
Use the existing Deploy Production workflow, which prepares this module only
after CI and validates TESTED_SHA against the checkout. Do not restore an
`unreleased` placeholder to make another provider's build turn green.

For local tests run `node scripts/prepare-release.mjs --local-test` first.
GitHub test/preflight jobs use `--ci`; only Deploy Production uses `--production`.
This also blocks an unprepared provider that ignores Wrangler custom build hooks.
An account administrator can additionally disconnect the redundant provider Git
auto-deploy trigger; no Cloudflare dashboard configuration is claimed changed here.
