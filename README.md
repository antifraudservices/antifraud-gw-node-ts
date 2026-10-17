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

## Fabric channel families

In this repository, a channel means a Hyperledger Fabric channel. It does not
mean a chat, message thread, department or user-interface communication
channel.

The initial Fabric channel families are:

- `identity-global`: natural-person identity commitments, personal-device key
  bindings and related identity evidence and events;
- `identity-<region>`: legal organizations and their organization-scoped
  employees, controllers, locations and operational key bindings;
- `animal-pet-<region>`: animal identity, ownership and existing animal
  clinical state;
- `qualification-education-<region>`: education qualifications and supporting
  evidence;
- `qualification-animal-<region>`: formal credentials whose subject is an
  animal and their supporting evidence; and
- `invoice-<region>`: invoice evidence and disclosure-safe indexes for invoices
  involving natural persons or legal organizations.

Examples include `identity-eu`, `identity-na`, `qualification-education-eu`,
`qualification-animal-na`, `invoice-eu` and `invoice-na`. The approved region
catalog is governed server-side. A browser, portal or SDK request never selects
a Fabric channel or smart contract.

## Invoice evidence

An invoice may involve a natural person, a legal organization or both. Its
regional invoice channel references the applicable identity commitments; it
does not copy confidential identity data. Raw invoices and personal or
commercial details remain encrypted off ledger. The ledger records only
approved hashes, content identifiers, proof status, lifecycle events and
disclosure-safe indexed values.

Energy, telecommunications, retail and other sectors can use the same regional
invoice channel. Sector classification and authorization remain explicit data
and policy. Accounting, purchasing, sales or other departments do not receive
their own Fabric channels: department and group membership determine which
employees may create, review, attest or read the permitted invoice data.

Messages, review requests and notifications are Communication records. They
are not Fabric channels.

## Evidence and CCAAS

`evidence-sc` can be committed on several approved channels while Fabric keeps
independent state in each channel. Adding a qualification or invoice channel
requires peer membership, lifecycle approval, commitment, endorsement policy
and authoritative readback for that channel. The immutable CCAAS package may
be reused only when its schema and validation are already safe for the domain;
otherwise it must be versioned.

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
