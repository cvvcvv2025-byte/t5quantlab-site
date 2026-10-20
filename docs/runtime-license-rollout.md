# Runtime license rollout — 2026-10-20

## Release boundary

The existing seven customer packages remain unchanged. Their website download
entitlements expire, but none is advertised as remotely disabled by membership
expiry. No installed binary can be retrofitted by changing a website endpoint.

`RUNTIME_LICENSE_PRODUCTS` is deliberately absent in production configuration.
The activation service rejects all products until an operator explicitly enables
accepted product codes. Current customers do not need to enter a key.

The new server and account UI are a preparation for new licensed executables,
not evidence that current executables enforce subscriptions.

## New EA candidate behavior

- Website member generates a separate, once-visible random credential per product.
  Store only SHA-256; bind product, platform, account login and broker server.
- Indicator membership does not activate EA products; premium membership covers
  both tiers. A separate product entitlement also qualifies.
- One active binding per product. Revoke before replacing it; replacement rotates
  the key. A website renewal extends the same key by reading current entitlement.
- Check every five minutes from a ten-second timer. Native WebRequest blocks its
  program thread, including ticks while in flight; timeout is capped at one second.
- No license return at the top of OnTick. Gate the one shared order creation
  function, covering new positions and additional layers. Preserve existing exit,
  stop, profit, drawdown, state recovery and broker-side protective order logic.
- Hard denial clears the in-memory lease. Transient failures retain at most a
  24-hour lease capped by membership expiry. Revocation reaches online clients at
  the next check; offline clients can retain the previously issued lease until it
  expires. Restart requires an online check. No editable disk/global-variable
  license cache is accepted.
- Tester-only bypass is restricted to MQL_TESTER because WebRequest is unavailable
  in the Strategy Tester. Demo and live terminals both enforce the license.
- This is ordinary commercial access control, not a claim of tamper-proof DRM.
  Account/server binding is checked against terminal-reported values; protecting
  a hostile modified binary is outside this design.

## Indicator blocker

MetaTrader forbids WebRequest inside indicators. Do not copy the EA include into
an indicator, or accept an unsigned plaintext file / terminal global as license
proof. A production indicator requires an independently verified signed offline
license or a separate trusted authorization assistant with signature verification.
No indicator code is enabled in this rollout. Exact v0.1.2 Neckline and Progress
Candle source files have not been recovered from Library; only older v0.1.0
sources were found. Never silently downgrade their logic to add licensing.

Official references:
- https://www.mql5.com/en/docs/network/webrequest
- https://docs.mql4.com/common/webrequest

## Evidence and mandatory native acceptance

Server tests run through the actual Worker stack with local SQLite, covering
membership tiers, account/product/platform/server isolation, renewal, expiry,
revocation, owner-only replacement, hash-only storage, origin checks, and rate
limits. A portable C++ harness executes the actual MQL lease gate with clock and
account shims; it does not compile or execute a complete MQL EA.

Six private EA source candidates cover Attack Completion MT5, Trend Capture MT5,
Range Martingale MT4/MT5 and Range Aggressive MT4/MT5. Their source transformation
is checked by removing only the include, timer lifecycle and order-creation
guard; every original remaining character must match. This proves source-change
scope, not that released binaries were built from those sources.

Before enabling a product, require native MetaEditor compilation and demo checks:
valid member opens; expired member cannot open/add; existing position continues
SL/TP, partial/full close and recovery after restart; renewal resumes; account
switch fails; timeout/expiry fails safely. Run with the actual broker symbols and
record exact executable hashes. Publish a distinct licensed version/package and
its activation instructions. Do not replace the existing package in-place.

New commercial terms must explicitly describe account binding, offline grace,
activation and any refund usage criteria before enabling new licensed sales.
Do not retroactively alter existing customers' purchase terms.

Remaining unrelated acceptance gaps: real paid order → automatic entitlement →
paid AI execution remains unproven; support replies still require an operator
to check the on-site queue.
