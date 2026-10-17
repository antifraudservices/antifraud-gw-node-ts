---
name: build-antifraud-data-space-gateway
description: Build or review the public multidomain Antifraud data-space gateway for identity, qualification, invoice and future evidence operations with trusted regional Fabric routing.
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
controllers, locations and keys use `identity-<region>`; qualification state
uses `qualification-<domain>-<region>`; invoice evidence uses
`invoice-<region>`. Cross-channel relationships use ledger-safe identifiers and
never duplicate confidential claims. Treat any governance-bootstrap exception
as an explicit, separately tested policy.

Keep animal meanings distinct. `animal-pet-<region>` owns animal identity,
ownership and existing animal clinical state. `qualification-animal-<region>`
owns only formal credentials whose subject is an animal and their supporting
evidence. A veterinary professional's qualification is not an animal
qualification. Do not migrate existing clinical records merely because a new
qualification channel exists.

For invoice evidence, reference natural persons from `identity-global` and
legal organizations from `identity-<region>`. Keep raw invoices, bank details,
tax identifiers, contacts and line items encrypted off ledger. Sector and
department affect authorization and index policy; they do not create separate
Fabric channels. Prove individual-to-organization and
organization-to-organization invoice flows.

When an evidence domain is added, inspect the current CCAAS manifest and
lifecycle scripts. Extend governed channel membership and commit `evidence-sc`
on each approved domain channel. Audit whether `artifact-sc`,
`artifactevent-sc` and `credential-sc` are also required. An unchanged CCAAS
package can be reused only when its schema and validation are already safe for
the domain; channel approval and commitment are still separate. Version the
package when semantics change.

Preserve the distinction between regional operational support and authority.
Operator identities remain in governed deployment records. An operator label
does not grant controller, issuer, ledger-member, key-custody or
confidential-data authority.

Use red-green-refactor. Prove manager derivation and negative cases first, then
route integration, high-level SDK behavior, the real local portal journey and
finally local-network ledger write plus authoritative readback. A mock,
fixture, screenshot, HTTP success or configured channel name is not ledger
proof.

Keep the repository public-safe. Do not include internal prompts, real hosts,
credentials, personal data, private organization evidence or unpublished
deployment details.
