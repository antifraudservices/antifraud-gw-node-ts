# Architecture and acceptance

## Routing boundary

The public request identifies the qualification operation and governed
jurisdiction. It does not contain a ledger channel or smart-contract name. The
gateway authenticates the caller, resolves the tenant and active assignment,
normalizes the qualification domain and jurisdiction, and then derives the
configured channel binding inside the trusted manager.

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

Unit tests, mocked adapters, screenshots, an HTTP success or a channel name in
configuration are not completion evidence.
