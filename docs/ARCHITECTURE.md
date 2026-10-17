# Architecture and acceptance

## Routing boundary

The public request identifies the qualification operation and governed
jurisdiction. It does not contain a ledger channel or smart-contract name. The
gateway authenticates the caller, resolves the tenant and active assignment,
normalizes the qualification domain and jurisdiction, and then derives the
configured channel binding inside the trusted manager.

## Federated identity channels

The federation preserves the established identity taxonomy:

- `identity-global` is the non-regional plane for natural-person identity
  commitments, personal-device key bindings and related identity evidence and
  events;
- `identity-<region>`, including `identity-eu` and `identity-na`, is the
  regional plane for legal organizations and their organization-scoped
  employees, controllers, locations and operational key bindings.

Normal tenant organizations must not be written to `identity-global`.
Exceptional federation-governance bootstrap records, if required, need a
separate explicit policy and test and must not weaken the normal routing rule.

The qualification channels are a separate application plane. For example,
`qualification-education-eu` may reference an organization registered in
`identity-eu` and a natural person registered in `identity-global` using
ledger-safe identifiers. It must not copy confidential identity claims between
channels.

Fabric peers join only the approved channel subset required for their role.
Shared network membership does not collapse channel state, endorsement policy
or authorization boundaries.

## Evidence contracts and CCAAS lifecycle

The contract name does not determine the data domain. One immutable
`evidence-sc` CCAAS package may be installed on a peer and committed on several
channels, but Fabric maintains independent contract state in each channel:

- identity evidence for a natural person belongs to `identity-global`;
- identity evidence for a regional legal organization or organization-scoped
  worker belongs to the matching `identity-<region>` channel; and
- evidence supporting an education qualification belongs to the matching
  `qualification-education-<region>` channel.

Evidence is not copied from an identity channel into a qualification channel.
The qualification record uses ledger-safe identifiers, hashes or multihashes
to reference the relevant subject, organization, credential and evidence. Raw
documents, personal identifiers, issuer URLs, contact data and confidential
claims remain off ledger.

The current CCAAS lifecycle inventory must therefore be extended. At minimum,
the implementation must:

1. add each approved qualification channel to the governed channel inventory;
2. join the intended peer to that channel before chaincode lifecycle work;
3. include `evidence-sc` in the deterministic manifest for that channel;
4. evaluate and normally include `artifact-sc`, `artifactevent-sc` and
   `credential-sc` for document hashes, lifecycle events and signed
   qualification credentials;
5. install the exact immutable CCAAS package on each endorsing peer and approve
   and commit its definition independently on each qualification channel;
6. define the channel-specific endorsement policy and verify service discovery;
7. record package identifier, image digest, sequence, policy, channel genesis
   binding and approving member set; and
8. prove create, read, status change and history after restarting the peer,
   gateway and CCAAS runtime.

Reusing unchanged contract code does not necessarily require a new CCAAS image
or package identifier. Adding a channel still requires channel membership,
approval and commitment. If qualification evidence needs new validation or a
different ledger-safe schema, release a new immutable package and advance the
definition sequence; do not silently reinterpret the existing contract.

The existing evidence contract accepts `subjectId` and `issuer` fields. Before
using it for qualification evidence, contract tests must prove that the gateway
passes only protected ledger-safe values. If that cannot be guaranteed with
the current schema, the contract requires a versioned change before deployment.

The initial naming convention is `qualification-<domain>-<region>`, with
`qualification-education-na` and `qualification-education-eu` as illustrative
bindings. A maintained catalog must define every supported region, alias,
operator and deployment state. Unknown or conflicting bindings fail closed.

## Regional support

The planned support split is:

- one approved operator for Europe, Africa and the Middle East (EMEA); and
- one approved operator for the Americas and Asia-Pacific (APAC), including
  Oceania.

Operator identities belong to governed deployment records and are not named in
this public repository. Operational support must not be interpreted as subject
consent, organization control, credential issuance authority, ledger membership
or cryptographic key custody. Each of those requires its own verified binding.

## Source evaluation

The current shared gateway implementation may provide a starting point after a
capability-by-capability audit. At minimum, compare:

1. claims-first validation and encrypted persistence;
2. organization, employee, group and qualification authority resolution;
3. regional channel derivation inside the manager;
4. communication, evidence and credential transport boundaries;
5. process-owned key unwrapping and tenant isolation;
6. OpenAPI, SDK and public example coverage; and
7. local, local-network and Test Network execution evidence.

Record each capability as adopted, already equivalent, profile-specific or
rejected. Never merge a complete product branch or inherit its tenants,
domains, channels or deployment configuration.

## Completion condition

The gateway is not complete until automated journeys prove:

1. an authorized education employee operation reaches the expected regional
   manager binding without accepting a caller-supplied channel;
2. jurisdiction, tenant, assignment and qualification-domain mismatches fail
   closed;
3. confidential claims are encrypted and searchable attributes are protected;
4. a local-network ledger write returns a real transaction identifier and is
   read back through the public API;
5. EMEA and Americas/APAC policy fixtures select distinct approved bindings;
6. unsupported regions fail without falling back to another operator; and
7. the professional portal completes the same journey through its backend and
   high-level SDK, with authoritative state still present after reload.

The test matrix must additionally prove that natural-person records select
`identity-global`, regional organizations select the matching
`identity-<region>` channel, and education qualification records select the
matching `qualification-education-<region>` channel without duplicating the
identity record.

It must also poison caller-supplied channel and chaincode values, verify that
identity evidence cannot be written to a qualification channel or vice versa,
and prove that the same evidence identifier in two channels does not imply
shared state.

Unit tests, mocked adapters, screenshots, an HTTP success or a channel name in
configuration are not completion evidence.
