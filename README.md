# Antifraud Data Space Gateway

Public scaffold for the multidomain Antifraud data-space gateway. It will
coordinate identity references, evidence indexes and ledger registration for
several business domains. Qualifications are one domain; they do not define
the whole gateway.

## Status

The first executable in-memory contract is implemented. It authenticates a
server-resolved workforce actor, records neutral employee identity evidence
(including age-over predicates), records education qualification evidence,
creates an addressed issuer inbox and accepts issuer decisions. Unit and real
HTTP integration tests cover these paths. No Fabric adapter, deployment
profile, local-network transaction or production readiness is claimed yet. A
superseded historical gateway is not a compatibility baseline.

Before implementation, compare the current shared gateway implementation with
the required Antifraud contracts. Reuse only neutral, test-proven managers and
adapters. Do not inherit another product's tenants, hosts, sectors, channels,
credentials or deployment evidence.

The current MVP is limited to the identity federation required by education
organizations and the complete `qualification-education-<zone>` evidence
journey. Animal qualifications, invoice evidence and other evidence domains are
documented future extensions and are not implementation or acceptance work for
this MVP.

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

Federation compatibility and future channel families include:

- `animal-pet-<zone>`: existing animal identity, ownership and clinical
  state;
- `qualification-animal-<zone>`: formal credentials whose subject is an
  animal and their supporting evidence; and
- `invoice-<sector>-<zone>`: invoice evidence and disclosure-safe indexes for
  invoices issued by organizations whose business sector is verified for that
  channel.

Examples include `identity-eu`, `identity-na`, `qualification-education-eu`,
`qualification-animal-na`, `invoice-energy-eu`, `invoice-telecom-na` and
`invoice-retail-eu`. Approved sector and zone catalogs are governed
server-side. A browser, portal or SDK request never selects a Fabric channel or
smart contract.

## Future invoice evidence — not MVP

The reserved future family is `invoice-<sector>-<zone>`. Only an organization
with a verified issuer sector may create and send an invoice there; the
recipient may be a person or an organization from another sector. A
cross-sector invoice is recorded once in the issuer's sector channel.
Departments determine employee authorization and never create Fabric channels.
Raw invoice content remains encrypted off ledger.

This paragraph preserves the architectural decision only. The MVP agent must
not implement invoice schemas, routes, user interfaces, CCAAS mappings or
tests.

## Evidence and CCAAS

For the MVP, `evidence-sc` must be evaluated for `identity-global` identity
evidence and for the approved `qualification-education-<zone>` channels.
The current implementation uses in-memory adapters only. Fabric keeps
independent state in each channel, so peer membership, lifecycle approval,
commitment, endorsement policy and authoritative readback remain required
before any local-network claim. Future evidence domains repeat that process in
a later increment.

## Application boundary

The neutral controller portal manages organizations, employees, departments,
groups, reusable workforce authorizations and the controller-authorized
employee identity, age-over and employer qualification-evidence workflows.
Product professional portals specialize sector and role operations separately;
the current increment does not add an antifraud workflow to a veterinarian or
another VetChain professional. Every portal reuses controlled components but
never selects ledger channels or grants authority in browser state.

## Implemented HTTP surface

- `POST /v1/identity/evidence` records a canonical neutral identity-evidence
  statement and a privacy-minimized `identity-global` anchor.
- `POST /v1/education/qualification-evidence` records an employer attestation
  and derives `qualification-education-<zone>` from governed jurisdiction.
- `GET /v1/clearing-house/inbox` lists only references addressed to the
  authenticated issuer organization.
- `POST /v1/clearing-house/evidence/:id/decision` records an addressed issuer
  confirmation, rejection or revocation.

These routes are currently proven with in-memory adapters. They are not Fabric
or Test Network evidence.

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
