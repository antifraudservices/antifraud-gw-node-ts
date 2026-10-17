# Architecture and acceptance

## Multidomain gateway boundary

The gateway belongs to the Antifraud data space. The current MVP implements the
education-qualification profile only. Invoice, animal-qualification and other
evidence types remain future profiles behind the same trusted routing and
authorization boundary.

A public request identifies an operation, governed domain and jurisdiction. It
does not contain a Fabric channel or smart-contract name. The gateway
authenticates the caller, resolves the tenant and active assignment, validates
the domain and jurisdiction, and derives the Fabric target inside a trusted
manager.

`<zone>` is a governed Fabric federation zone, such as `eu` or `na`. It is not
a country subdivision, administrative region or caller-supplied location. A
request carries the governed jurisdiction required by the business operation;
the trusted server maps that jurisdiction to one approved zone. Neither the
portal nor the SDK sends the zone or channel name.

“Fabric channel” never means a department, chat or message thread.
Communication records carry messages, attachments, review requests and
notifications. Organization departments and professional groups define
authorization scope; they do not create Fabric channels.

## Federated identity planes

The federation preserves these identity owners:

- `identity-global` owns natural-person identity commitments, personal-device
  key bindings and related identity evidence and events;
- `identity-<zone>`, including `identity-eu` and `identity-na`, owns legal
  organizations and their organization-scoped employees, controllers,
  locations and operational key bindings; and
- `animal-pet-<zone>` owns animal identity, ownership relationships and the
  existing animal clinical state.

Normal tenant organizations must not be written to `identity-global`.
Exceptional federation-governance bootstrap records, if required, need a
separate explicit policy and test.

## Domain evidence planes

Domain channels reference identity-plane assets using protected ledger-safe
identifiers. They do not duplicate confidential identities.

The current MVP channel family is:

- `qualification-education-<zone>` for education qualifications.

Reserved future channel families are:

- `qualification-animal-<zone>` for formal credentials whose subject is an
  animal; and
- `invoice-<sector>-<zone>` for invoice evidence and invoice indexes issued
  by organizations verified for that business sector.

A veterinary professional's degree or licence is a professional qualification,
not an animal qualification. Vaccinations and existing animal clinical
certificates remain in `animal-pet-<zone>` unless a separately governed
migration changes their canonical owner.

The channel catalog is extensible. A new evidence domain requires an explicit
domain definition, subject types, searchable claims, ledger-safe projection,
authorization rules, CCAAS inventory and executable tests. It must not be
introduced by accepting an arbitrary channel family from a caller.

## Future sector-and-zone invoice index — not MVP

The reserved family is `invoice-<sector>-<zone>`. The future trusted manager
will derive it from the verified issuer organization, sector, jurisdiction and
governed Fabric zone. The
recipient may belong to another sector, but the invoice will have one canonical
write in the issuer's sector channel. Departments will constrain employee
authorization and will not create Fabric channels. Raw invoices and
confidential business or personal data will remain encrypted off ledger.

This section is a retained architectural boundary, not a current deliverable.
The MVP agent must not implement invoice contracts, schemas, routes, portals,
CCAAS manifests or acceptance tests.

## Evidence contracts and CCAAS lifecycle

One immutable `evidence-sc` CCAAS package may be installed on a peer and
committed on several channels, but every channel has independent state. For the
MVP, work is limited to the applicable identity boundary and
`qualification-education-<zone>`.

The governed CCAAS inventory must be extended for each approved education
qualification channel. At minimum, MVP implementation must:

1. add the channel to the governed inventory and join the intended peer;
2. map `evidence-sc` to that channel in the deterministic manifest;
3. evaluate `artifact-sc`, `artifactevent-sc` and `credential-sc` for document
   hashes, lifecycle events and signed evidence;
4. install the immutable package on each endorsing peer and approve and commit
   its definition independently on the channel;
5. define the endorsement policy and verify service discovery;
6. record package identifier, image digest, sequence, policy, genesis binding
   and approving members; and
7. prove create, read, status change and history after restarting the peer,
   gateway and CCAAS runtime.

Reusing unchanged contract code does not require a new package identifier, but
new channel membership, approval and commitment remain mandatory. If a new
domain needs different validation or a different ledger-safe schema, release a
new immutable package and advance the definition sequence.

The current evidence contract accepts `subjectId` and `issuer`. Contract tests
must prove that only protected ledger-safe values reach Fabric. If the existing
schema cannot enforce that requirement, it must be versioned before use for
education qualification evidence.

## Source evaluation

The current shared gateway implementation may provide a starting point only
after a capability-by-capability audit. Compare claims-first validation,
encrypted persistence, workforce authorization, zone routing,
communication transport, process-owned key custody, OpenAPI and SDK coverage,
and local through Test Network evidence. Record every capability as adopted,
already equivalent, profile-specific or rejected. Never merge an entire
product branch or inherit its identities and deployment configuration.

## Completion condition

The gateway remains a scaffold until automated journeys prove:

1. people route to `identity-global` and education organizations and their
   employees route to `identity-<zone>`;
2. education qualification evidence routes to the exact
   `qualification-education-<zone>` channel;
3. callers cannot choose or override a channel or smart contract;
4. organization, assignment, department, group, sector and subject-policy
   mismatches fail closed;
5. confidential claims are encrypted and searchable values are protected;
6. the same identifier on two channels does not imply shared state;
7. a local-network write returns a real transaction identifier and is read back
   through the public API after restart; and
8. the professional portal completes the same workflow through its backend and
   high-level SDK with authoritative state after reload.

Animal qualification and invoice tests are explicitly excluded from this MVP.
Unit tests, mocks, screenshots, HTTP success or configured channel names are
not completion evidence for the education journey.
