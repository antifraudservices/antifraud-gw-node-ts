# Antifraud Data Space Gateway

**Trust important facts online while sharing only the data required.**

The Antifraud Data Space helps people, families, businesses and digital
services distinguish verified evidence from unsupported claims. It brings
verifiable trust to age assurance, identity, employee authority,
qualifications, documents and organization services.

The Gateway is the server-side trust engine behind the Antifraud portals. It
checks who is acting, which verified organization they represent, what they
are allowed to do and how evidence must be protected before it is recorded or
shared.

## Why this matters

Online profiles often rely on self-declared age, identity and qualifications.
An adult can pretend to be a minor, gain a child's trust and use
private information for manipulation or extortion. The harm can include fear,
severe stress, depression and, in extreme cases, risk of self-harm. Businesses
also face false identities, forged documents, invented professional
qualifications and impersonation of legitimate organizations or employees.

Antifraud adds verifiable evidence to the wider safety ecosystem of families,
platforms, safeguarding teams and public authorities. When an important fact
must be checked, a service can rely on accountable evidence from an authorized
source.

## How the trust chain works

1. **An organization is verified before it joins the data space.** Trusted
   status comes from governed admission and authoritative evidence.
2. **The organization verifies its employees and their qualifications.** It
   also decides which employees may create, review or confirm each kind of
   evidence.
3. **An authorized employee creates evidence.** The Gateway checks the
   organization, active assignment and exact permission before accepting it.
4. **The requested disclosure is minimized.** A service can learn whether a
   person is over 14, 16, 18, 19 or another policy-defined age while the birth
   date and identity document remain private.
5. **The evidence remains accountable.** Its issuer, proof, status and history
   can be checked, expired or revoked while confidential content stays
   protected.

For example, the intended relying-party journey lets an online service request
the required age predicate from an authorized evidence provider while the
passport remains with its holder or authorized custodian.

```text
Person or organization
        ↓
Antifraud Portal → trusted portal backend → Antifraud Software Development Kit (SDK)
        ↓
Antifraud Gateway: identity + authority + policy + evidence
        ↓
Confidential storage + privacy-minimized integrity and audit record
```

## A cross-sector evidence model

Antifraud uses a **JSON:API primary document**—a standard format for structured
JavaScript Object Notation (JSON) application programming interface
documents—as its canonical envelope. **Schema.org** types describe people,
organizations, qualifications, documents, places and services in a language
that different systems can understand.

The description of a governed document may use Schema.org
`DigitalDocument` and `MediaObject`. Portable Document Format (PDF) files,
images, spreadsheets, videos and other confidential content travel as
protected Decentralized Identity Communication (DIDComm) attachments and
remain in authorized storage. The shared ledger receives only the minimum
protected references required for integrity, status and audit.

The model works across sectors. Each sector can connect through dedicated
adapters while the JSON:API primary document remains the canonical Antifraud
envelope.

## Shared Data Space roadmap

The complete Antifraud Data Space is designed as one connected trust network
for social networks, marketplaces, insurers, schools, banks and other relying
parties. Each request is limited to the evidence required for one declared
purpose.

The journey below is the product target. The current repository implements
only part of it; completing and proving the whole journey is a central part of
the work still to be planned and developed.

For an age-assurance request, the end-to-end journey is:

1. The relying party creates a confidential request limited by purpose,
   audience, required predicate and expiry.
2. Clearing House routes the request to the verified controller of the
   individual or business through a private addressed exchange.
3. The controller reviews who is asking, why and which claims are requested,
   then approves, narrows or rejects the disclosure.
4. The protected wallet creates a purpose-bound, audience-bound and expiring
   verifiable presentation containing only the authorized claims or derived
   predicates.
5. Clearing House verifies and delivers the response. The relying party may
   receive `age_over_18: true`, for example, while the source birth date,
   passport and unrelated identity claims remain protected.
6. The Gateway records the minimum protected status, integrity and audit
   evidence needed to detect replay, expiry or revocation. Authorized stores
   retain the confidential credentials and documents.

The same journey applies to organization identity, employee authority,
professional or educational qualifications, signed documents and verified
services. An individual controller governs personal disclosure. A business
controller governs organization evidence and delegates exact capabilities to
verified employees. Verified assignments and controller policy establish each
actor's authority.

### Payment-provider adapters

The Antifraud ecosystem will implement its own replaceable server-side payment
adapters. This will allow an organization to integrate providers such as
Stripe or compliant stablecoin payment rails through the same identity,
evidence and authorization model used by the rest of the data space.

A payment confirmation supplies evidence for one exact settlement. Identity,
age, professional qualification, consent and organization authority retain
their own evidence. Provider credentials and wallet keys stay in trusted
server-side custody, private payment details stay with authorized providers,
and the related transaction links only the minimum governed receipt or status.
Payment adapters form part of the Shared Data Space roadmap.

### Public repository ecosystem

The project is split into small repositories with explicit ownership. Data
contracts, trust decisions, user interfaces and infrastructure therefore
evolve through clear, reviewable boundaries.

| Repository | What it does | Why it matters |
|---|---|---|
| [antifraud-data-utils-ts](https://github.com/antifraudservices/antifraud-data-utils-ts) | Defines canonical Schema.org evidence, requests, predicates, presentations, proofs and lifecycle states. | Every service interprets identity, age and qualification evidence through the same interoperable claims. |
| [antifraud-sdk-core-ts](https://github.com/antifraudservices/antifraud-sdk-core-ts) | Provides runtime-neutral orchestration for requests, authorization, presentations, delivery and status changes. | Browsers, servers and wallets can participate in the same governed journey and security policy. |
| [antifraud-sdk-node-ts](https://github.com/antifraudservices/antifraud-sdk-node-ts) | Implements trusted Node.js and Backend for Frontend (BFF) adapters for wallets, verifiers, evidence providers and the Gateway. | Trusted server custody protects credentials and authority across portal interactions. |
| [antifraud-ica-node-ts](https://github.com/antifraudservices/antifraud-ica-node-ts) | Verifies authoritative identity and organization evidence and issues signed credentials. | Independently checked organizations and identities establish the root of the trust chain. |
| [antifraud-gw-node-ts](https://github.com/antifraudservices/antifraud-gw-node-ts) | Enforces authentication, organization and employee authority, confidential evidence handling, Clearing House routing and privacy-minimized audit. | Central policy enforcement gives every request server-verified authority and governed ledger routing. |
| [antifraud-fabric](https://github.com/antifraudservices/antifraud-fabric) | Governs Hyperledger Fabric membership, channel topology, Chaincode as a Service (CCAAS) lifecycle and ledger-safe evidence anchors. | Participants can verify integrity, status and history while personal credentials and documents stay in confidential storage. |
| [antifraud-common-components-react](https://github.com/antifraudservices/antifraud-common-components-react) | Supplies shared authentication, protected-profile and evidence controls. | Common security-sensitive interactions behave consistently across every portal. |
| [antifraud-portal-components-react](https://github.com/antifraudservices/antifraud-portal-components-react) | Supplies reusable request, consent, wallet, presentation, attachment and evidence-review journeys. | Individuals and professionals receive consistent, understandable privacy choices across products. |
| [antifraud-hosting-components-react](https://github.com/antifraudservices/antifraud-hosting-components-react) | Supplies organization and host-controller administration components. | Governance, workforce delegation and infrastructure operations remain visible and separate from professional work. |
| [antifraud-controller-nextjs](https://github.com/antifraudservices/antifraud-controller-nextjs) | Lets verified organizations manage employees, groups, delegated capabilities and business evidence. | An organization can build an auditable chain from its verified identity to the exact employee allowed to create or review evidence. |
| [antifraud-personal-next](https://github.com/antifraudservices/antifraud-personal-next) | Gives an individual controller access to requests, permissions, credentials, wallet actions and selective disclosure. | A person can approve only the required claim and keep the source credential or document private. |
| [antifraud-professional-nextjs](https://github.com/antifraudservices/antifraud-professional-nextjs) | Provides authorized employee workspaces for evidence creation, review and professional decisions. | Professional actions remain bound to a verified organization, active assignment and exact delegated capability. |
| [antifraud-social-demo-nextjs](https://github.com/antifraudservices/antifraud-social-demo-nextjs) | Demonstrates a synthetic social network acting as a relying party for governed requests and verifiable results. | It makes the real-world value visible: a platform can request trustworthy evidence while passports and birth dates stay with their authorized custodians. |

The public repositories contain reviewable architecture and contracts.
Controlled operational environments hold configuration, credentials,
deployment records, release evidence and private participant data.

The acceptance target is one automated journey across the real portal, BFF,
high-level SDK, Gateway, confidential store and selected network adapter.
Layer tests and portal demonstrations complement that shared end-to-end
evidence.

## Current foundation in this repository

This public repository is a working foundation for the multidomain Gateway,
not a finished Antifraud Data Space. Its current executable contracts:

- authenticates server-resolved organization and workforce actors;
- enforces active assignments and exact capabilities;
- records privacy-preserving identity and age-over evidence;
- records qualification evidence while preserving employer and issuer
  provenance as separate facts;
- routes addressed evidence to the correct verified issuer for review;
- stores confidential evidence and files in authorized repositories;
- derives ledger routing from trusted server policy; and
- maintains auditable evidence status and authoritative readback.

## What works today

The current education Minimum Viable Product (MVP) authenticates a
server-resolved workforce actor,
records neutral employee identity evidence including age-over predicates,
records education qualification evidence, creates an addressed issuer inbox,
accepts issuer decisions and maintains an authenticated
organization-controller workspace. Automated unit and real Hypertext Transfer
Protocol (HTTP) integration tests provide initial checks for these paths, but
they are not the complete test suite required for the Shared Data Space.

The source includes official Hyperledger Fabric Gateway adapters and an
explicit local-network gate for privacy-minimized identity and qualification
anchors. The hosted Demo profile exercises the same application programming
interface (API) with a clearly labelled six-second simulation. Local Network,
Test Network and production each advance through their own evidence gates.

The current MVP is deliberately narrow. It starts with identity and age-over
evidence for employees and qualification evidence for education
organizations. It proves that the basic trust chain can work, but it does not
yet provide the complete cross-sector product described above.

Some aspects of the architecture are patent pending.

## Work still to be planned and developed

Substantial work remains. The next development stages must turn the current
foundation into a complete Shared Data Space that organizations and online
services can use safely at scale.

The detailed development backlog has not yet been created. Defining,
prioritizing and maintaining that backlog is itself a major part of the work.
The following are high-level workstreams, not a claim that the required tasks
have already been analysed or completed.

| Area | Work still to be developed | Why it matters |
|---|---|---|
| Detailed backlog | Analyse the architecture and repositories, break every workstream into reviewable tasks, identify dependencies, define acceptance criteria and prioritize delivery. | The project needs an executable development plan rather than a list of broad intentions. |
| Complete selective-disclosure journey | Complete the request, controller approval, minimum-data presentation, Clearing House verification, delivery, expiry and revocation journey across the portals, software development kits and Gateway. | A service should receive only the necessary answer, such as whether a person is over an agreed age, without receiving the birth date or identity document. |
| More kinds of evidence | Extend the current age and education foundation to organization identity, employee authority, professional qualifications, licences, signed documents, verified services and other governed facts. | Fraud is not limited to one claim or one sector. |
| More sectors and regions | Define each new sector's rules, evidence types, trusted issuers, regional policies and dedicated adapters without changing the common evidence envelope. | The same trust model must support different industries while keeping their governance and data separate. |
| Organization admission and governance | Complete verified participant onboarding, employee delegation, controller changes, suspension, offboarding, dispute handling and audit procedures. | Every piece of evidence is only as trustworthy as the organization and authorized person behind it. |
| Clearing House federation | Complete private discovery and routing between relying parties, individual or business controllers, evidence providers and participating organizations. | Requests and responses must reach the correct verified party without becoming a public directory of personal activity. |
| Wallet and protected documents | Complete interoperable wallet custody, recovery, encrypted attachments, consent records and portable presentations. | People and organizations must remain in control of confidential credentials and documents. |
| Payment adapters | Build the planned replaceable adapters for providers such as Stripe and compliant stablecoin payment rails, with separate settlement evidence and server-side key custody. | Payments can support a governed service without becoming identity or authority evidence themselves. |
| Security and privacy hardening | Complete threat modelling, abuse controls, key rotation and recovery, replay protection, data-retention rules, incident response and independent security review. | The system handles high-impact evidence and must fail safely under attack or operational failure. |
| Complete test strategy and coverage | Design and implement the full unit, integration, contract and real end-to-end test suite for every journey, permission, failure outcome, adapter and lifecycle transition. Define coverage targets and add negative authorization, recovery, performance and accessibility tests. | The current preliminary checks do not prove the complete product; each promised capability must have repeatable evidence that it works and rejects unauthorized use. |
| Network and operational proof | Prove each increment through local, local-network, test-network and production-readiness gates, including monitoring, backup, recovery and participant runbooks. | Source code alone does not prove that a governed multi-organization network can operate reliably. |
| Integrator experience | Complete plain-language documentation, application programming interface examples, software development kit examples and reference journeys for every supported participant role. | New organizations must be able to understand, evaluate and integrate the system without relying on private project knowledge. |

This future backlog must span the public Antifraud repositories listed above.
Each increment should add its contracts, implementation, documentation and
automated proof together. The aim is not to claim that the full Data Space or
its delivery plan already exists, but to make the starting foundation and the
scale of the remaining work visible and reviewable.

## Fabric channel families

In this repository, a channel is a Hyperledger Fabric isolation boundary.
Chats, message threads, departments and user-interface communications retain
their own application-level models.

The MVP uses:

- `identity-global`: natural-person identity commitments, personal-device key
  bindings and related identity evidence and events;
- `identity-<zone>`: legal organizations and their organization-scoped
  employees, controllers, locations and operational key bindings;
- `qualification-education-<zone>`: education qualifications and supporting
  evidence.

Here, `<zone>` identifies a governed federation region. Examples include
`identity-eu` for Europe, `identity-na` for North America and
`qualification-education-eu` for education qualifications in Europe. Trusted
Gateway policy selects the applicable Fabric channel and smart contract for
each authorized request.

## Evidence and Chaincode as a Service

For the Minimum Viable Product, the `evidence-sc` evidence smart contract must
be evaluated for `identity-global` identity evidence and for the approved
`qualification-education-<zone>` channels.
Automated `test` operations use immediate in-memory adapters. The explicitly
enabled staging Demo uses the same contract with a fixed 6000 ms delay and is
always labelled as simulated. `local-network`, `test-network` and `network`
select the official Fabric Gateway adapter and require explicit trusted server
configuration. The repository includes an unskipped local-network test for
the current identity and qualification anchors. Test Network and production
deployment follow their corresponding promotion gates. Fabric keeps
independent state in each channel, so peer
membership, lifecycle approval, commitment, endorsement policy and
authoritative readback remain separate requirements. Future evidence domains
repeat that process in a later increment.

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
artifact storage. The JSON:API primary document and Schema.org resources keep
the Antifraud business model canonical, while Fabric receives protected
integrity references. Gateway implementation is tracked in
[GitHub issue #1](https://github.com/antifraudservices/antifraud-gw-node-ts/issues/1).
The controller uses controlled components while trusted server policy selects
ledger routing and establishes authority.

## Implemented Hypertext Transfer Protocol routes

The routes below use `GET` to read information and `POST` to submit new
information or decisions.

- `GET /v1/controller/workspace` reads authoritative organization, licence,
  workforce, structure, authorization and notification state.
- Controller department, group, invitation, acceptance, employee membership,
  status and purge routes mutate only the authenticated organization and
  return state that can be read after gateway reconstruction over the same
  store.
- `POST /v1/controller/places` and `POST /v1/controller/services` create
  Schema.org Place and Service records for the authenticated organization.
  Their catalog-publication routes require `controller.catalog.publish` and
  publish a Service after every referenced Place is public and belongs to the
  same department.
- `GET /v1/controller/service-catalog` gives the authenticated controller the
  current catalog, while
  `GET /v1/public/organization-service-catalog/:organizationReference` exposes
  only the explicitly public graph. Jurisdiction, sector and access web address
  come from trusted server configuration.
- `POST /v1/identity/evidence` records a canonical neutral identity-evidence
  statement and a privacy-minimized `identity-global` anchor.
- `POST /v1/education/qualification-evidence` records an employer attestation
  and derives `qualification-education-<zone>` from governed jurisdiction. Its
  `documentCid` is the complete Content Identifier version 1 (CIDv1) value for
  raw content using the 384-bit Secure Hash Algorithm 3 (SHA3-384), encoded as
  multibase base58btc; validation completes before the vault, index or ledger
  write. Issuer lookup returns one explicit outcome:
  `participant-resolved`, `identity-resolved` or `not-resolved`. Only the first
  contains both a tenant and confirmation service; the second remains
  `awaiting-issuer-onboarding`, and the third requires authoritative resolution
  before persistence.
- `GET /v1/clearing-house/inbox` lists only references addressed to the
  authenticated issuer organization.
- `GET /v1/clearing-house/evidence/:id` opens the confidential employer
  attestation for that addressed issuer. The inbox index and Fabric anchor
  retain privacy-minimized routing and integrity references.
- `POST /v1/clearing-house/evidence/:id/decision` records an addressed issuer
  confirmation, rejection or revocation.

These routes have automated in-memory contract coverage. The dedicated
local-network gate separately proves the current privacy-minimized identity
and qualification anchors through the Fabric adapter. The staging Demo
exercises the application routes with a clearly labelled six-second simulation;
promotion to Local Network and Test Network adds the corresponding network
evidence.

`GET /healthz` reports service liveness. `test/local-controller-gateway-server.mjs` is the
synthetic fixture used by controller Playwright and the temporary staging-demo
entry point. In `test` and Demo it uses the explicitly labelled memory adapter;
in `local-network` it uses the configured Fabric connection. Test Network and
production use their promoted service profiles.

Run the staging Demo with:

```bash
ANTIFRAUD_DEPLOYMENT_STAGE=staging \
ANTIFRAUD_DEMO_MODE=true \
npm run start:demo
```

The interactive Local Network controller portal uses the Fabric server selected
by `ANTIFRAUD_NETWORK_KIND=local-network` after its adapter and
restart-readback gate are green.

## Implementation entry point

Read [the architecture contract](docs/ARCHITECTURE.md), [AGENTS.md](AGENTS.md)
and
[`build-antifraud-data-space-gateway`](.codex/skills/build-antifraud-data-space-gateway/SKILL.md)
before adding code.

## Public-repository boundary

Public contributions use synthetic fixtures and public contracts. Internal
prompts, operator or partner identities, real hosts, credentials, private
organization evidence, personal data, commercial plans and unpublished
deployment details remain in their controlled environments.

## Licence

Copyright 2026 Antifraud Services Inc. Licensed under Apache-2.0.
