# Changelog

## Unreleased

- Pin `antifraud-data-utils-ts@0.1.4` so gateway tests and future delivery
  managers consume the released Schema.org confidential-document and DIDComm
  inline/protected-link attachment contracts.

- Add explicit network-profile selection: immediate memory for automated tests,
  a fixed six-second memory simulation only for staging demos, and mandatory
  real Fabric for `local-network`, `test-network` and `network`.
- Run gateway test files sequentially on local developer hardware.

- Replace optional-field issuer inference with explicit
  `participant-resolved`, `identity-resolved` and `not-resolved` outcomes.
  Reject incomplete participant directory bindings and preserve the
  no-fabricated-tenant onboarding path.
- Validate every qualification `documentCid` as the complete governed
  CIDv1(raw, SHA3-384) value before issuer resolution or persistence, and reuse
  the canonical synthetic fixture from `antifraud-data-utils-ts` in gateway,
  HTTP and local portal journeys.
- Pin `antifraud-data-utils-ts@0.1.3` for the canonical confidential-document
  graph, CID validator and shared fixture.

- Add authenticated organization-controller administration for licences,
  invitations, employees, registered devices, groups, departments, reusable
  authorizations, memberships, lifecycle and Communication notifications.
- Add HTTP routes and reconstruction tests proving authoritative readback from
  the controller store without browser-owned organization authority.

- Add the executable neutral evidence gateway with authenticated HTTP routes.
- Add server-authorized employee identity evidence, including age-over
  predicates, with privacy-minimized `identity-global` anchors.
- Add education qualification employer attestations, governed EU and North
  American routing, addressed issuer inboxes and issuer decisions.
- Reject browser-supplied actor, zone, channel and smart-contract authority.
- Add in-memory ledger, confidential-vault and addressed-index adapters for
  local contract testing. These adapters are not Fabric evidence.
- Add an unauthenticated liveness route and a synthetic local server fixture
  for the controller UI to backend-for-frontend to SDK to gateway journey.
