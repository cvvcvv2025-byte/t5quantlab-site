# Account-bound single-file chart delivery

Structure Decision Map MT4/MT5 uses a private native compiler queue. Other indicator and trading-EA deliveries retain their existing paths. Trading model 0.3.0 is retained; the single-file authorization/display wrapper is 0.3.1.

The member submits the existing account/server/platform/product binding. Existing paid or manually granted entitlement, policy acceptance, revocation and rebind cooldown checks remain authoritative. The server issues its existing encrypted-at-rest signed profile, enqueues a binding/revision-specific job and returns a private job ID. The browser polls status and downloads a ZIP with one EX and instructions, or the EX itself. No helper, template, SET or external credential is delivered for this product.

The native host authenticates each claim/completion with a separate local RSA identity. Only its public key is tracked. Signed requests bind method/path/time/nonce/body hash, expire after 60 seconds, and consume one-use nonces. Runtime lease signing private keys remain server-side. The native host receives only claimed profiles and compiles from locally pinned private MQ sources. Source-revision hashes, profile hashes, real compiler log, executable hash and private R2 readback gate readiness. Stale claims and revoked/expired entitlements cannot publish or download. Download requests recheck entitlement, account binding, token generation and file SHA256.

The private compiler is operated on the existing MetaEditor host, not inside Cloudflare Workers. It must remain awake and online for new builds. A 90-second heartbeat gates new issuance. When offline, new issuance fails clearly without rotating credentials; completed cached builds remain downloadable with valid entitlement. This is not a claim of independent 24/7 hosted compilation. The local agent restarts on login/process failure, never changes trading permissions, and never runs customer business programs on a live account.

Public repository: website/API queue, public compiler identity, behavioral checks, user instructions only. Private: MQ projects, embedded profiles, compiler private key, native builds and logs containing local paths. Never push those private files or customer EXs to GitHub.

Behavior checks use SQLite and test keys/binaries, and are not native compile evidence. MetaEditor logs and isolated terminal acceptance are maintained privately. Runtime model preservation was separately audited; this does not assert profitability.
