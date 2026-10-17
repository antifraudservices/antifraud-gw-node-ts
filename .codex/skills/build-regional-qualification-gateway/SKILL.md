---
name: build-regional-qualification-gateway
description: Build or review a public gateway for qualification operations and trusted regional blockchain-channel routing. Use when evaluating shared gateway reuse, adding regional bindings, or proving an education qualification journey.
---

# Build Regional Qualification Gateway

Read `docs/ARCHITECTURE.md` and `AGENTS.md` completely before changing the
gateway.

Treat the current shared gateway as a possible source, not a template that may
be copied wholesale. Inspect its current contracts and record each needed
capability as adopted, already equivalent, profile-specific or rejected.
Never inherit product tenants, hosts, channels, credentials, deployment files
or evidence.

Keep channel selection inside a trusted manager. Derive the binding from the
authenticated tenant, qualification domain, normalized jurisdiction and an
approved server-side catalog. Reject any channel or smart-contract name sent by
a portal, SDK request or general environment variable. Unknown and conflicting
bindings fail closed.

Preserve the federated identity taxonomy: natural persons use
`identity-global`; legal organizations and their organization-scoped workers,
controllers, locations and keys use `identity-<region>`; qualification state
uses `qualification-<domain>-<region>`. Cross-channel relationships use
ledger-safe identifiers and never duplicate confidential claims. Treat any
governance-bootstrap exception as an explicit, separately tested policy.

When qualification evidence is added, inspect the current CCAAS manifest and
lifecycle scripts. Extend governed channel membership and commit `evidence-sc`
on each approved qualification channel. Audit whether `artifact-sc`,
`artifactevent-sc` and `credential-sc` are also required by the complete flow.
An unchanged CCAAS package can be reused only when its schema and validation are
already safe for the new domain; channel approval and commitment are still
separate. Version the package if qualification semantics change.

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
