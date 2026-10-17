# Antifraud Regional Gateway

Public scaffold for the trusted gateway profile used by the Antifraud data
space. The gateway will accept product-neutral qualification and identity
evidence operations and route ledger work to the correct regional channel from
trusted server-side context.

## Status

Scaffold only. No API, persistence adapter, blockchain connection, deployment
profile or executable end-to-end journey exists yet. The deleted historical
gateway is not a compatibility baseline.

Before implementation, compare the current SOSChain gateway with the required
Antifraud contracts. Reuse only the neutral, test-proven managers and adapters
that fit this data space; do not copy product identity, tenants, hosts, sectors,
channels, credentials or deployment evidence.

## Channel model

The channel family is qualification domain plus governed region, for example:

- `qualification-education-na`
- `qualification-education-eu`

These are examples, not a complete hard-coded list. The canonical region
catalog and exact channel bindings must be approved and tested before a channel
is enabled. A portal, browser, SDK request or environment variable must never
choose an arbitrary channel. The gateway manager derives the binding from the
authenticated tenant, qualification domain, jurisdiction and deployed policy.

Operational support is initially divided as follows:

- Fundación UNID may support Europe, Africa and the Middle East (EMEA).
- Antifraud Foundation may support the Americas and Asia-Pacific (APAC),
  including Oceania.

Support does not by itself confer controller authority, issuer authority,
ledger membership, key custody or access to confidential subject data. Those
bindings require separate legal, technical and deployment evidence.

## Application boundary

The Antifraud controller portal manages organizations, employees, departments,
groups and reusable workforce authorizations. The
`qualification-education-nextjs` professional portal will perform authorized
education subject operations.

Animal-sector workflows remain in the existing multisector VetChain
professional portal. VetChain specializes its home by active sector and role
and may reuse `antifraud-portal-components-react`; there is no separate
Antifraud animal portal.

## Implementation entry point

Read [the architecture contract](docs/ARCHITECTURE.md), [AGENTS.md](AGENTS.md)
and
[`build-antifraud-regional-gateway`](.codex/skills/build-antifraud-regional-gateway/SKILL.md)
before adding code.

## Public-repository boundary

Do not commit internal prompts, real hosts, credentials, private organization
evidence, personal data, commercial plans or unpublished deployment details.
Use synthetic fixtures and public contracts only.

## Licence

Copyright 2026 Antifraud Services Inc. Licensed under Apache-2.0.
