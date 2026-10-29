# Signed runtime v3: gated rollout

This change adds a signed lease service and admin bootstrap. It does not enable any new customer product, change payment credentials, or upload a client binary. Existing v1/v2 clients retain their identifiers and policy. V3 EA identifiers end in `_v3`; indicator clients declare protocol 3. Only products explicitly present in `RUNTIME_SIGNED3_PRODUCTS` may activate customer bindings. Download readiness remains independently gated by accepted private artifacts.

## Signing and binding

`POST /api/admin/runtime-signing-key` requires the existing administrator header. It generates RSA-2048 server-side and conditionally stores an AES-GCM encrypted private JWK in the private bucket. The wrapping secret is domain-separated from the existing account authentication secret. Concurrent/idempotent calls do not rotate an existing signing key. Public responses contain only the key ID, modulus, exponent and algorithm. No private key is returned to the browser or embedded in a native program. Preserve encrypted key storage and its wrapping secret in the existing private operational backup; changing either without a migration invalidates pinned clients.

`POST /api/licenses/lease-v3` checks the existing token, active membership or manual entitlement, product/platform/account/server binding, revocation, expiry, rate limits and atomic single-terminal slot, then signs a lease lasting at most 300 seconds. The signed message also contains installation binding and a new native process nonce. Indicators verify this signature locally; their companion EA handles HTTPS. EA programs manage existing positions independently of the new-entry license gate. A disconnected client cannot renew; issued leases can remain valid only until their fixed deadline, not indefinitely.

The exact message is 14 pipe-separated fields: protocol, pinned key ID, hashed license ID, product, platform, account login, SHA-256 of UTF-8 broker server, installation digest, nonce, issued epoch, lease deadline, entitlement deadline (0 means perpetual), server-derived owner flag, active state. The next line is a 256-byte PKCS#1-v1.5/SHA-256 signature encoded as lowercase hexadecimal.

## Owner flow

Only the verified session belonging to the configured owner email can request `POST /api/account/runtime-licenses/owner-profile`. It still requires the normal entitlement, release gate, policy consent and binding rules. The download is a signed account/product/platform credential for a helper, not an unlocked binary or proof that can directly authorize an indicator. Every run still requires a signed online lease. A submitted email never selects the owner identity. No shared owner binary exists.

## Native QA

The existing admin QA route accepts an explicit `protocol_version:3` request for up to 16 signed-client bindings, only with admin authorization and demo confirmation. Such QA tokens are short-lived and bound to the specified platform/account/server. They do not enable customer activation or downloads. The QA UI can save a local private JSON test configuration; it is not persistent browser storage and must not enter a public repository or customer package.

A successful server handshake is not native compilation, visual acceptance, or broker-position management acceptance. Native source, binaries, logs and account identities remain private. Keep each product held until its actual native compile, mount, expiry/revocation/offline/restart/copy and management scenarios pass. Previously distributed unlocked executables cannot be remotely locked by this service.

## Activation acceptance stage — 2026-10-29

Production-root native clients passed connected demo HTTPS signature/binding checks, all eight indicator platform mounts with offline expiry/resume and server revoke/renew/entitlement-expiry cases, and six EA platform broker-position management fixtures with unauthorized entry guards. These functional results do not qualify trading performance.

The explicit signed-v3 activation list is configured to permit entitled, authenticated account binding and the verified owner's signed credential download for final client acceptance. This activation stage does not change artifact hashes, stored ZIPs, indicator download holds, checkout readiness, payment configuration, or existing v2 licenses. Customer artifacts must still pass independent private storage/readback and release gates before downloads are restored. Private source, binaries, credentials and native identities are excluded from this repository.

## Accepted artifact registration

The twelve signed-v3 customer ZIPs are pinned in `runtime-v3-artifacts.json`. The account registry requires the accepted client generation, production public-key ID, signed activation gate and exact stored version/hash. A signed indicator release cannot resolve a legacy fallback. Performance qualification remains false. Old files already shared outside the service cannot be remotely locked.

The admin QA surface supports audited cleanup only for the verified owner’s binding that exactly matches a successful protocol-v3 demo QA record, with explicit admin demo confirmation. It revokes that test credential and releases its test cooldown while preserving the existing terminal lease slot. It cannot reset ordinary customers, unverified QA, other bindings or their cooldowns. This prevents acceptance fixtures from occupying the owner's later production binding.


## 2026-10-29 customer install simplification
- Member catalog lists only products covered by active rights, labeled indicator/EA.
- The authenticated install-package endpoint embeds a signed bound credential in a private ZIP, reusing existing accepted native readers. T5OWNER3 is a compatibility envelope name; owner privilege remains derived only from the server license record.
- Existing manual-key customers can explicitly upgrade the same binding; its token rotates once. Re-download retrieves the encrypted stored credential and preserves terminal slots. A per-binding issuance lock prevents concurrent rotation. Revoked bindings still obey cooldown.
- Rebind cooldown is now 1800 seconds, calculated from the original revocation timestamp, including preexisting records. Lease deadlines and existing-position management are unchanged.
- Download uses the existing artifact SHA256/entitlement/release gates. The 12 shared originals in R2 are unchanged; personal wrappers are generated per authenticated request and never cached or uploaded to public storage.
- Windows helper copies files as the current user and does not enable trading/DLL or change security settings. Indicator template loading verified on native MT4 and MT5 demo terminals; Windows dialog interaction has not been exercised on native Windows in this macOS environment. Mac/Wine retains documented manual file placement.
- All strategy and licensing binaries stay byte-for-byte unchanged. No new indicator/EA native compilation is claimed; only new QA probes were natively compiled.
