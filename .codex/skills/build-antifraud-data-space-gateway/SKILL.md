---
name: build-antifraud-data-space-gateway
description: Build or review the education-qualification MVP of the public multidomain Antifraud data-space gateway while preserving future evidence-domain boundaries.
---

# Build Antifraud Data Space Gateway

Read `docs/ARCHITECTURE.md` and `AGENTS.md` completely before changing the
gateway.

Treat the current shared gateway as a possible source, not a template that may
be copied wholesale. Inspect its current contracts and record each needed
capability as adopted, already equivalent, profile-specific or rejected.
Never inherit product tenants, hosts, channels, credentials, deployment files
or evidence.

Keep channel selection inside a trusted manager. Derive the binding from the
authenticated tenant, evidence domain, normalized jurisdiction and an approved
server-side catalog. Reject any channel or smart-contract name sent by a portal,
SDK request or general environment variable. Unknown and conflicting bindings
fail closed. A Fabric channel is not a department, professional group, chat or
Communication thread.

Preserve the federated identity taxonomy: natural persons use
`identity-global`; legal organizations and their organization-scoped workers,
controllers, locations and keys use `identity-<zone>`; qualification state
uses `qualification-<domain>-<zone>`; invoice evidence uses
`invoice-<sector>-<zone>`. Cross-channel relationships use ledger-safe
identifiers and never duplicate confidential claims. Treat any
governance-bootstrap exception as an explicit, separately tested policy.

Keep animal meanings distinct. `animal-pet-<zone>` owns animal identity,
ownership and existing animal clinical state. `qualification-animal-<zone>`
owns only formal credentials whose subject is an animal and their supporting
evidence. A veterinary professional's qualification is not an animal
qualification. Do not migrate existing clinical records merely because a new
qualification channel exists.

Keep issuer identity, federation membership and qualification evidence
separate. `identity-<zone>` owns the legal organization reference and any
verified tenant/service binding. `qualification-education-<zone>` owns the
employer assertion, credential proof and lifecycle. A non-participating issuer
may be referenced by a clearly provisional or externally verified organization
identity, but must not be represented as a tenant, controller or confirming
issuer.

Model issuer resolution with `participant-resolved`, `identity-resolved` and
`not-resolved` outcomes. The second may create an
`awaiting-issuer-onboarding` employer attestation when policy permits. Never
invent a tenant or service endpoint to turn it into the first outcome.

Do not make issuers scan Fabric channels. Emit privacy-minimized addressed
reference events to the writing host's local index and expose them through an
authenticated issuer inbox. The issuer's home host proves organization control
and sends an exact discovery request to approved federation peers; each peer
queries only its own local index and returns opaque locators. A federation
directory may advertise hosts and capabilities but is not the evidence index
or source of truth. Local indexes must not contain raw evidence, employee
identity, qualification claims, public legal identifiers or bearer
credentials, and must never replace authoritative channel readback. Do not
compare tenant-local keyed hashes across hosts; use a governed federation
reference or resolve the exact legal identifier and jurisdiction inside an
authorized directory.

Treat a credential presented through an EUDI Wallet or another supported
OpenID for Verifiable Presentations flow as issuer evidence, not automatic
tenant membership. Verify holder binding, signature, type, issuer trust,
jurisdiction, validity, revocation and use policy before anchoring an
externally verified issuer proof. Preserve employer and issuer provenance as
separate facts.

Limit the current MVP to education organizations, authorized education
employees, identity references and `qualification-education-<zone>` evidence.
Do not implement animal qualification or invoice schemas, routes, portal
screens, CCAAS mappings or tests. Preserve only their documented future channel
families. Departments affect employee authorization but never create Fabric
channels.

For the education MVP, inspect the current CCAAS manifest and lifecycle scripts.
Extend governed channel membership and commit `evidence-sc` on each approved
education qualification channel. Audit whether `artifact-sc`,
`artifactevent-sc` and `credential-sc` are also required. An unchanged CCAAS
package can be reused only when its schema and validation are already safe for
the domain; channel approval and commitment are still separate. Version the
package when semantics change.

Preserve the distinction between zone operational support and authority.
Operator identities remain in governed deployment records. An operator label
does not grant controller, issuer, ledger-member, key-custody or
confidential-data authority.

Use red-green-refactor. Prove manager derivation and negative cases first, then
route integration, high-level SDK behavior, the real local portal journey and
finally local-network ledger write plus authoritative readback. A mock,
fixture, screenshot, HTTP success or configured channel name is not ledger
proof.

The local portal acceptance journey must cover participating and
non-participating issuers, verified wallet evidence, signed outbox delivery,
issuer decisions, onboarding recovery and cross-host addressed discovery. Run
it first against the in-memory network adapter. Do not describe isolated React
tests or mocked portal routes as this proof.

Keep the repository public-safe. Do not include internal prompts, real hosts,
credentials, personal data, private organization evidence or unpublished
deployment details.
