# Antifraud Data Space Gateway

Public scaffold for the multidomain Antifraud data-space gateway. It will
coordinate identity references, evidence indexes and ledger registration for
several business domains. Qualifications are one domain; they do not define
the whole gateway.

## Status

Scaffold only. No API, persistence adapter, blockchain connection, deployment
profile or executable end-to-end journey exists yet. A superseded historical
gateway is not a compatibility baseline.

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

For the MVP, `evidence-sc` is evaluated and committed only for the approved
`qualification-education-<zone>` channels. Fabric keeps independent state in
each channel. Peer membership, lifecycle approval, commitment, endorsement
policy and authoritative readback are required. Future evidence domains repeat
that process in a later increment.

## Application boundary

The controller portal manages organizations, employees, departments, groups
and reusable workforce authorizations. Professional portals specialize their
home and available operations by sector and role. They reuse shared controlled
components but never select ledger channels or grant authority in browser
state.

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
