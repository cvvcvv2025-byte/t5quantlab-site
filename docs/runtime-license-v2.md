# Terminal licensing v2: acceptance candidate, not a production release

The four separate `_v2` product codes avoid retroactively changing existing
license keys and purchase contracts. They recognize the corresponding existing
product entitlement or premium membership, but issue a separate key. Both
`RUNTIME_LICENSE_PRODUCTS` and `RUNTIME_LICENSE_V2_PRODUCTS` must explicitly list
the exact new code before customer activation is possible. Never add old codes
to the v2 release or replace an existing R2 ZIP in place.

## Implemented candidate policy

- Product + platform + trading login + broker server remain bound.
- One installation identity may hold a lease per user and v2 product. Multiple
  charts on that installation work. Acquisition/refresh uses one atomic SQLite
  UPSERT rather than a read/check/write race.
- Refresh every 60 seconds; maximum lease 300 seconds, capped by entitlement
  expiry. A different installation waits for the last issued lease to expire.
  There is no immediate takeover while a previous offline grant is still valid.
- Revoking a key starts a seven-day self-service rebind cooldown. Repeated revoke
  requests do not reset it. Replacement rotates the key; old keys cannot renew.
  The cooling-off period is disclosed before activation and before revocation.
- The v2 client rejects v1 responses, wrong nonce, terminal, product, platform,
  account, expired or overlong grants. New-code clients cannot downgrade to v1.
- Lease denial gates only the existing shared new-entry/addition function. Exit,
  stop-loss and position management source stays unchanged.
- No plaintext key, account password or filesystem path is stored server-side.
  Installation IDs are salted/hashed before storage. The local ID file alone is
  not a license proof; valid server authorization is still required.

## Honest security boundary

An installation ID is not hardware attestation. Someone copying a complete
environment including its identifier, or modifying a binary, is outside this
ordinary access-control guarantee. A revoked/offline client can continue new
entries only until its previously issued short lease elapses. Multiple old
unlicensed binaries cannot be remotely hardened. Do not advertise unbreakable
DRM or assert that existing installed copies now enforce these rules.

Indicators remain disabled for runtime activation. Their future design needs
independently verified signed authorizations bound to account/server/product
and expiry (or a trusted helper with signature verification). Do not treat an
editable plaintext file or a terminal GlobalVariable as authorization, and do
not put WebRequest inside an indicator.

## Before enabling customer release

1. Rebase this isolated patch onto current main; run behavior and contract checks.
2. Record native compiler logs and SHA256 of all six exact binaries. Publish
   distinct compiled-only ZIPs with activation/migration instructions; do not
   expose source or private includes in the website assets.
3. In isolated broker DEMO terminals, verify correct key, wrong account/server,
   same-installation multi-chart, second installation denied, migration after
   expiry, disconnect, restart, local clock rollback, expiry, revoke, refund,
   renewal, existing-position stop/partial-close/recovery behavior.
4. Confirm the customer policy and privacy notice cover the actual short lease
   and seven-day cooldown. A simulation or compile is not broker acceptance.
5. Upload exact accepted artifacts, verify authenticated download hashes, then
   enable only the new codes. Keep current production switches closed until all
   evidence exists. Rollback closes new activation; it cannot retract leases
   already issued and must preserve current positions' management.

## References

- https://www.mql5.com/en/docs/network/webrequest
- https://www.mql5.com/en/docs/common/cryptencode
