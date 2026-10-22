# Antifraud Data Space Gateway

Public scaffold for the multidomain Antifraud data-space gateway. It will
coordinate identity references, evidence indexes and ledger registration for
several business domains. Qualifications are one domain; they do not define
the whole gateway.

## Status

The first executable in-memory contract is implemented. It authenticates a
server-resolved workforce actor, records neutral employee identity evidence
(including age-over predicates), records education qualification evidence,
creates an addressed issuer inbox, accepts issuer decisions and maintains an
authenticated organization-controller workspace. Unit and real HTTP
integration tests cover these paths. An explicit staging demo profile uses the
same API with a fixed six-second delay for each simulated ledger operation. No
real Fabric adapter, local-network transaction or production readiness is
claimed yet. A
superseded historical gateway is not a compatibility baseline.

Before implementation, compare the current shared gateway implementation with
the required Antifraud contracts. Reuse only neutral, test-proven managers and
adapters. Do not inherit another application's tenants, hosts, channels,
credentials or deployment evidence.

The current MVP is limited to the identity federation required by education
organizations and the complete `qualification-education-<zone>` evidence
journey. Other evidence domains are outside this implementation.

## Fabric channel families

In this repository, a channel means a Hyperledger Fabric channel. It does not
mean a chat, message thread, department or user-interface communication
channel.

The MVP uses:

- `identity-global`: natural-person identity commitments, personal-device key
  bindings and related identity evidence and events;
- `identity-<zone>`: legal organizations and their organization-scoped
  employees, controllers, locations and operational key bindings;
- `qualification-education-<zone>`: education qualifications and supporting
  evidence.

Examples include `identity-eu`, `identity-na` and
`qualification-education-eu`. A browser, portal or SDK request never selects a
Fabric channel or smart contract.

## Evidence and CCAAS

For the MVP, `evidence-sc` must be evaluated for `identity-global` identity
evidence and for the approved `qualification-education-<zone>` channels.
The current implementation uses in-memory adapters only. Automated `test`
operations are immediate. The explicitly enabled staging demo uses the same
adapters with a fixed 6000 ms delay. `local-network`, `test-network` and
`network` resolve to a real-Fabric requirement and are rejected by the demo
server. Fabric keeps
independent state in each channel, so peer membership, lifecycle approval,
commitment, endorsement policy and authoritative readback remain required
before any local-network claim. Future evidence domains repeat that process in
a later increment.

## Application boundary

The neutral controller portal manages organizations, employees, departments,
groups, reusable workforce authorizations and the controller-authorized
employee identity, age-over and employer qualification-evidence workflows.
It also manages organization Places and client Services as separate structure
records. Explicit catalog publication is a distinct controller capability;
schedules, appointments, subjects, research studies and dataset-contract
approval remain separate workflows.

Antifraud document persistence is Schema.org-native: `DigitalDocument` plus
`MediaObject`. PDF, spreadsheet, Word, image, video and other governed bytes
arrive through DIDComm `attachments[]` and are stored only in confidential
artifact storage. They are never FHIR `DocumentReference` resources and never
enter Fabric. Gateway implementation is tracked in
[GitHub issue #1](https://github.com/antifraudservices/antifraud-gw-node-ts/issues/1).
The controller reuses controlled components but never selects ledger channels
or grants authority in browser state.

## Implemented HTTP surface

- `GET /v1/controller/workspace` reads authoritative organization, licence,
  workforce, structure, authorization and notification state.
- Controller department, group, invitation, acceptance, employee membership,
  status and purge routes mutate only the authenticated organization and
  return state that can be read after gateway reconstruction over the same
  store.
- `POST /v1/controller/places` and `POST /v1/controller/services` create
  Schema.org Place and Service records for the authenticated organization.
  Their catalog-publication routes require `controller.catalog.publish` and
  reject a public Service unless every referenced Place is public and belongs
  to the same department.
- `GET /v1/controller/service-catalog` gives the authenticated controller the
  current catalog, while
  `GET /v1/public/organization-service-catalog/:organizationReference` exposes
  only the explicitly public graph. Jurisdiction, sector and access URL come
  from trusted server configuration.
- `POST /v1/identity/evidence` records a canonical neutral identity-evidence
  statement and a privacy-minimized `identity-global` anchor.
- `POST /v1/education/qualification-evidence` records an employer attestation
  and derives `qualification-education-<zone>` from governed jurisdiction. Its
  `documentCid` is the complete CIDv1(raw, SHA3-384) multibase base58btc value;
  malformed or profile-mismatched content identifiers fail before any vault,
  index or ledger write. Issuer lookup returns one explicit outcome:
  `participant-resolved`, `identity-resolved` or `not-resolved`. Only the first
  contains both a tenant and confirmation service; the second remains
  `awaiting-issuer-onboarding`, and the third fails closed before persistence.
- `GET /v1/clearing-house/inbox` lists only references addressed to the
  authenticated issuer organization.
- `GET /v1/clearing-house/evidence/:id` opens the confidential employer
  attestation only for that addressed issuer. It does not copy classification
  values into the inbox index or Fabric anchor.
- `POST /v1/clearing-house/evidence/:id/decision` records an addressed issuer
  confirmation, rejection or revocation.

These routes are currently proven with in-memory adapters. A staging demo can
exercise them with the six-second simulation, but it is not Fabric or Test
Network evidence.

`GET /healthz` is an unauthenticated liveness check and returns no tenant,
actor or ledger state. `test/local-controller-gateway-server.mjs` is the
synthetic fixture used by controller Playwright and the temporary staging-demo
entry point. It fails closed when configured for `local-network`, Test Network
or production.

Run that staging demo only with:

```bash
ANTIFRAUD_DEPLOYMENT_STAGE=staging \
ANTIFRAUD_DEMO_MODE=true \
npm run start:demo
```

The interactive local controller portal must instead use the real Fabric
server selected by `ANTIFRAUD_NETWORK_KIND=local-network` after its adapter and
restart-readback gate are green.

## Implementation entry point

Read [the architecture contract](docs/ARCHITECTURE.md), [AGENTS.md](AGENTS.md)
and
[`build-antifraud-data-space-gateway`](.codex/skills/build-antifraud-data-space-gateway/SKILL.md)
before adding code.

## Public-repository boundary

Do not commit internal prompts, operator or partner identities, real hosts,
credentials, private organization evidence, personal data, commercial plans or
unpublished deployment details. Use synthetic fixtures and public contracts.

## Licence

Licensed under Apache-2.0.
