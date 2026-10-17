---
name: build-antifraud-regional-gateway
description: Build or review the public Antifraud gateway for qualification operations and trusted regional blockchain-channel routing. Use when evaluating SOSChain gateway reuse, adding regional bindings, or proving an education qualification journey.
---

# Build Antifraud Regional Gateway

Read `docs/ARCHITECTURE.md` and `AGENTS.md` completely before changing the
gateway.

Treat the current SOSChain gateway as a possible source, not a template that
may be copied wholesale. Inspect its current contracts and record each needed
capability as adopted, already equivalent, Antifraud-specific or rejected.
Never inherit product tenants, hosts, channels, credentials, deployment files
or evidence.

Keep channel selection inside a trusted manager. Derive the binding from the
authenticated tenant, qualification domain, normalized jurisdiction and an
approved server-side catalog. Reject any channel or smart-contract name sent by
a portal, SDK request or general environment variable. Unknown and conflicting
bindings fail closed.

Preserve the distinction between regional operational support and authority.
Fundación UNID may support EMEA and Antifraud Foundation may support the
Americas and APAC, including Oceania, but those labels do not grant controller,
issuer, ledger-member, key-custody or confidential-data authority.

Use red-green-refactor. Prove manager derivation and negative cases first, then
route integration, high-level SDK behavior, the real local portal journey and
finally local-network ledger write plus authoritative readback. A mock,
fixture, screenshot, HTTP success or configured channel name is not ledger
proof.

Keep the repository public-safe. Do not include internal prompts, real hosts,
credentials, personal data, private organization evidence or unpublished
deployment details.
