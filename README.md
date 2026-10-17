# Regional Qualification Gateway

Public scaffold for a trusted qualification data-space gateway. The gateway
will accept neutral qualification and identity
evidence operations and route ledger work to the correct regional channel from
trusted server-side context.

## Status

Scaffold only. No API, persistence adapter, blockchain connection, deployment
profile or executable end-to-end journey exists yet. The deleted historical
gateway is not a compatibility baseline.

Before implementation, compare the current shared gateway implementation with
the required qualification contracts. Reuse only neutral, test-proven managers
and adapters that fit this data space; do not copy product identity, tenants,
hosts, sectors, channels, credentials or deployment evidence.

## Channel model

The existing identity-channel taxonomy is retained across the Fabric
federation:

- `identity-global` holds natural-person identity commitments, personal-device
  key bindings and the related identity evidence and events;
- `identity-eu`, `identity-na` and other approved `identity-<region>` channels
  hold legal organizations and organization-scoped employees, controllers,
  locations and operational key bindings for that region.

Qualification state remains separate. Its channel family is qualification
domain plus governed region, for example:

- `qualification-education-na`
- `qualification-education-eu`

These are examples, not a complete hard-coded list. The canonical region
catalog and exact channel bindings must be approved and tested before a channel
is enabled. A portal, browser, SDK request or environment variable must never
choose an arbitrary channel. The gateway manager derives the binding from the
authenticated tenant, qualification domain, jurisdiction and deployed policy.

A peer may participate in the shared global identity channel and selected
regional identity and qualification channels. Channel participation does not
merge their ledgers or authorization policies. Qualification records reference
the applicable identity commitments; they do not duplicate confidential
identity data.

The intended operational support split is:

- one approved operator for Europe, Africa and the Middle East (EMEA); and
- one approved operator for the Americas and Asia-Pacific (APAC), including
  Oceania.

Operator identities belong to governed deployment records, not this public
repository. Support does not by itself confer controller authority, issuer
authority, ledger membership, key custody or access to confidential subject
data. Those bindings require separate legal, technical and deployment
evidence.

## Application boundary

The controller portal manages organizations, employees, departments, groups
and reusable workforce authorizations. The education professional portal will
perform authorized education subject operations.

Animal-sector workflows remain in the consuming multisector professional
portal. That portal specializes its home by active sector and role and may
reuse the same neutral components; no separate animal application is required.

## Implementation entry point

Read [the architecture contract](docs/ARCHITECTURE.md), [AGENTS.md](AGENTS.md)
and
[`build-regional-qualification-gateway`](.codex/skills/build-regional-qualification-gateway/SKILL.md)
before adding code.

## Public-repository boundary

Do not commit internal prompts, real hosts, credentials, private organization
evidence, personal data, commercial plans or unpublished deployment details.
Use synthetic fixtures and public contracts only.

## Licence

Licensed under Apache-2.0.
