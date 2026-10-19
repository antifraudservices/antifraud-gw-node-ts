# Changelog

## Unreleased

- Add addressed-issuer confidential evidence readback. The federated inbox and
  ledger anchor remain privacy-minimized, while the exact addressed issuer can
  open the employer attestation and canonical qualification classification.
  Firestore persists only managed-wallet-sealed claims; another organization
  fails closed.

- Expose `/health` beside the local `/healthz` probe so Cloud Run public
  verification reaches the service rather than a reserved frontend path.

- Add Firestore-backed, environment-prefixed Demo persistence for virtual
  ledger anchors, addressed references, vault state, controller workspaces and
  sealed JWE attachments. A Secret Manager seed reconstructs managed-wallet
  custody after process restart without exposing private keys to portals.
- Add the authenticated social-publication route and durable readback. The
  Gateway recomputes the public manifest binding, accepts only the canonical
  verified ML-DSA-65 proof and labels the six-second ledger receipt as the
  in-memory Fabric Demo adapter.
- Add authenticated confidential-artifact HTTP storage and retrieval. The
  Gateway verifies DIDComm bytes against the Schema.org MediaObject size,
  SHA3-384 digest and CID, seals bytes at rest through the Node managed wallet,
  and returns them only to the owning organization with `no-store` responses.
- Wire the disposable Demo runtime and local browser fixture to namespaced
  attachment storage without introducing FHIR `DocumentReference`.

- Add official Fabric Gateway adapters for privacy-minimized qualification and
  identity-evidence anchors. The unskipped local-network gate now writes and
  reads `identity-global`, `qualification-education-eu` and
  `qualification-education-na`, preserves server-owned channel/chaincode
  routing and returns real Fabric transaction IDs.

- Add the deployable Demo HTTP process and reproducible non-root Node 24
  container for Cloud Run. Bind four portal BFF credentials to fixed
  server-owned Demo actors, keep the six-second virtual-ledger receipt explicit,
  permit the Demo profile only on local, Beta or staging surfaces, and keep
  Production disabled.
- Add disposable environment-namespaced Demo persistence contracts and
  wallet-sealed confidential artifact storage. Only the Demo prefix can be
  administratively purged.

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
