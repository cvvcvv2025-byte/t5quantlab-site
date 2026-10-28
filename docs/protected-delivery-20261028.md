# Unified protected delivery — 2026-10-28

Scope: every indicator and EA, paid and manual grants. The sole download exception
is the verified session account cvvcvv2025@gmail.com; it still requires an active
product entitlement. No email submitted by a request or client parameter is trusted.

## Implemented distribution containment

- All eight indicator platform packages remain private and cannot be downloaded
  by customers until a runtime-protected release passes native acceptance.
- MT5 fallback packages are subject to the same gate; old binaries do not bypass it.
- Four licensed EA releases can be delivered only when both current v2 acceptance
  switches enable their registered license products. Existing client activation,
  expiry, revocation, binding and position management remain unchanged.
- Public delivery reports storage readiness separately from runtime protection.
  A successful upload or hash check does not imply runtime enforcement.
- Membership new orders and new payment links are held while required products
  are unavailable. Existing grants and already-paid recovery paths are preserved.
- Blocked attempts read no binary and create no fulfilled-download event.

## Remaining native-client work — NOT certified complete

The current private Structure Decision Map 0.3.0 MT4/MT5 source and its resources,
the current other MT5 indicator sources, and native compiler/terminal tooling
have not been recovered in this workspace. The recovered Library inventory has
older 0.2.2 sources and Oct20 EA license candidates, which must not replace 0.3.0.

Indicators cannot use WebRequest directly. They require verification of a signed
account/server/product/expiry-bound authorization, optionally renewed by a
trusted helper; unsigned files or terminal GlobalVariables are not authorization.
The signing private key must remain server-side. No indicator activation is
enabled until compiled clients reject missing, tampered, copied, expired and
revoked leases and pass MT4/MT5 chart tests.

Owner native no-key use must also be bound to verified owner terminal identities;
this change does not create a transferable universal unlocked owner release.
Website ownership exemption is not an exemption implemented inside EA binaries.
Already leaked unlocked executables cannot be retroactively locked by this server.

## Verification

Dedicated behavior checks cover all twelve download routes, manual and paid
entitlements, owner identity spoofing, anonymous access, release gates and denial
before storage access. Existing storage hash, checkout, payment retry and refund
regressions remain covered. Payment tests use a test-only future accepted catalog
only after asserting that the real unlocked catalog blocks new membership sales.
