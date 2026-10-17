# Architecture and acceptance

## Multidomain gateway boundary

The gateway belongs to the Antifraud data space. Qualification, invoice and
future evidence types are domain profiles behind the same trusted routing and
authorization boundary.

A public request identifies an operation, governed domain and jurisdiction. It
does not contain a Fabric channel or smart-contract name. The gateway
authenticates the caller, resolves the tenant and active assignment, validates
the domain and jurisdiction, and derives the Fabric target inside a trusted
manager.

“Fabric channel” never means a department, chat or message thread.
Communication records carry messages, attachments, review requests and
notifications. Organization departments and professional groups define
authorization scope; they do not create Fabric channels.

## Federated identity planes

The federation preserves these identity owners:

- `identity-global` owns natural-person identity commitments, personal-device
  key bindings and related identity evidence and events;
- `identity-<region>`, including `identity-eu` and `identity-na`, owns legal
  organizations and their organization-scoped employees, controllers,
  locations and operational key bindings; and
- `animal-pet-<region>` owns animal identity, ownership relationships and the
  existing animal clinical state.

Normal tenant organizations must not be written to `identity-global`.
Exceptional federation-governance bootstrap records, if required, need a
separate explicit policy and test.

## Domain evidence planes

Domain channels reference identity-plane assets using protected ledger-safe
identifiers. They do not duplicate confidential identities.

Initial channel families are:

- `qualification-education-<region>` for education qualifications;
- `qualification-animal-<region>` for formal credentials whose subject is an
  animal; and
- `invoice-<region>` for invoice evidence and invoice indexes.

A veterinary professional's degree or licence is a professional qualification,
not an animal qualification. Vaccinations and existing animal clinical
certificates remain in `animal-pet-<region>` unless a separately governed
migration changes their canonical owner.

The channel catalog is extensible. A new evidence domain requires an explicit
domain definition, subject types, searchable claims, ledger-safe projection,
authorization rules, CCAAS inventory and executable tests. It must not be
introduced by accepting an arbitrary channel family from a caller.

## Regional invoice index

An invoice may link:

- one or more legal organizations registered in `identity-<region>`;
- a natural person registered in `identity-global`; or
- both, such as an individual customer receiving an invoice from a supplier.

The encrypted operational record may preserve the complete invoice and its
standard representation. The regional Fabric channel receives only the
approved projection: document hash or content identifier, protected subject
and organization references, proof and verification status, lifecycle events
and explicitly approved disclosure-safe index values. It never receives the
raw invoice, names, addresses, contact values, bank details, tax identifiers or
complete line-item content.

Energy, telecommunications, retail and other sectors use explicit governed
sector values in the record and authorization policy. They do not automatically
receive separate Fabric channels. Accounting, purchasing, sales and other
departments are organization-internal authorization scopes. For example, an
accounting group may receive permission to review an invoice index without
receiving permission to read every attached document or another department's
records.

Invoice automation must keep these decisions separate:

1. whether the employee may perform the operation;
2. which organization, department, group and sector scope applies;
3. whether the invoice parties authorized the requested use where required;
4. which invoice claims may be indexed or disclosed; and
5. which regional Fabric channel the trusted manager derives.

## Evidence contracts and CCAAS lifecycle

One immutable `evidence-sc` CCAAS package may be installed on a peer and
committed on several channels, but every channel has independent state. Identity
evidence stays in the applicable identity channel. Qualification evidence stays
in the applicable qualification channel. Invoice evidence stays in the
applicable `invoice-<region>` channel.

The governed CCAAS inventory must be extended for every approved domain
channel. At minimum, implementation must:

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
qualification or invoice evidence.

## Source evaluation

The current shared gateway implementation may provide a starting point only
after a capability-by-capability audit. Compare claims-first validation,
encrypted persistence, workforce authorization, regional routing,
communication transport, process-owned key custody, OpenAPI and SDK coverage,
and local through Test Network evidence. Record every capability as adopted,
already equivalent, profile-specific or rejected. Never merge an entire
product branch or inherit its identities and deployment configuration.

## Completion condition

The gateway remains a scaffold until automated journeys prove:

1. people route to `identity-global`, organizations to `identity-<region>` and
   animals to `animal-pet-<region>`;
2. education, animal-qualification and invoice evidence route to their exact
   regional domain channels;
3. callers cannot choose or override a channel or smart contract;
4. organization, assignment, department, group, sector and subject-policy
   mismatches fail closed;
5. confidential claims are encrypted and searchable values are protected;
6. the same identifier on two channels does not imply shared state;
7. a local-network write returns a real transaction identifier and is read back
   through the public API after restart; and
8. the professional portal completes the same workflow through its backend and
   high-level SDK with authoritative state after reload.

Invoice acceptance must include a natural-person customer, a legal-organization
customer, an organization-to-organization invoice, at least two sectors and two
departments with different permissions. Unit tests, mocks, screenshots, HTTP
success or configured channel names are not completion evidence.
