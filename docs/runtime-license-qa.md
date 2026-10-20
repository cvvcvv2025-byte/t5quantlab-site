# Scoped native authorization QA

The existing compiled candidates can use administrator-issued QA credentials at
the same `/api/licenses/verify` route. A separate table stores hashes only;
product/platform/account/server must match. QA never opens customer activation,
grants website membership, creates a paid order or changes a released executable.

The protected `/admin/license-qa/` page uses the existing admin key for every
request, held only in the page input. Account identifiers are entered at runtime,
not committed to this public repository. Keys are once-visible masked fields;
admin list endpoints return no credential or credential hash.

The administrator independently confirms demo account type. Requiring a server
name containing Demo is an input safeguard, not cryptographic proof of demo type.
The service cannot log into or observe the broker account.

Default QA validity is 60 minutes, capped at 24 hours. Default lease is 600 seconds
to cover the unchanged client's 300-second refresh interval; leases may be set
between 10 and 600 seconds. Shorter leases intentionally produce idle gaps if
they expire before the next refresh. Offline lease validity never exceeds the
expiry known when it was issued. Revocation/shortening is not instant for a
previously issued lease: online clients learn it at their next check, while
offline clients retain that old lease until it expires. For a short expiry test,
restart the EA after setting the expiry so it obtains a fresh capped lease.

The private list records successful verifier calls and last verification time.
This is server handshake evidence, not proof of terminal orders, stops, exits,
restart recovery or strategy profitability. Those remain native demo acceptance
items. No production test key is issued just by deploying this code.
