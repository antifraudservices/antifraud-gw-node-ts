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

Other channel families require a separate governed increment and are not
defined by this repository yet.

## Qualification issuer identity and federation

An education-qualification write must keep three facts separate:

1. the legal identity of the claimed issuer;
2. whether that organization currently participates in the federation and
   advertises a qualification-confirmation service; and
3. the qualification evidence and its verification status.

`identity-<zone>` owns the first two facts. A verified participating
organization has an authoritative organization reference, tenant reference,
operational keys and discovered service endpoints. An organization that does
not yet participate may have only a protected claimed-issuer identity record,
created from a legal identifier and jurisdiction with explicit
`unverified` or `externally-verified` provenance. Such a record must never be
presented as tenant membership, issuer confirmation or controller authority.

`qualification-education-<zone>` owns the third fact. An employer attestation
references the protected issuer-organization identity and remains visibly an
employer assertion until an issuer proof or independently verified credential
is added. Confirmation appends issuer-owned provenance; it does not replace or
rewrite the employer assertion.

The portal must not choose either identity or qualification channels. Its
backend submits the issuer's legal identifier and jurisdiction. The gateway
normalizes them, resolves the organization, derives the governed zone and
records only protected references on ledger.

Issuer resolution therefore needs three outcomes rather than a binary lookup:

- `participant-resolved`: the organization identity and its authenticated
  tenant confirmation service are known;
- `identity-resolved`: the organization identity is known, but it has no
  federated tenant confirmation service; and
- `not-resolved`: no authoritative or explicitly provisional organization
  identity can be established under policy.

For `participant-resolved`, the gateway records the privacy-minimized
qualification anchor and queues a signed, idempotent tenant-to-tenant
confirmation request. For `identity-resolved`, it may record an employer
attestation with `awaiting-issuer-onboarding` status, but it must not fabricate
an issuer tenant or proof. `not-resolved` fails closed unless a separately
authorized workflow first creates a clearly provisional claimed-issuer
identity record.

### Addressed issuer inbox, not channel traversal

An issuer must never enumerate Fabric channels to find evidence that names it.
Fabric channel isolation is intentional, and a legal identifier is neither a
safe global search key nor proof of authorization.

Every successful qualification write must create a durable outbox event for
the writing host's local issuer-reference index. The index contains only the
protected issuer reference, opaque evidence locator, source host and channel
family, lifecycle status and event time. It contains no employee identity, raw
qualification, document, public legal identifier or bearer credential.

Discovery is host-to-host and does not require one central evidence index. A
participating issuer opens its inbox through its own tenant. Its home host
proves that the tenant controls the referenced organization identity and sends
an exact, authenticated discovery request to the approved peer hosts advertised
by federation discovery. Each peer searches only its local reference index and
returns matching opaque locators. The home host aggregates those results for
the issuer. A federation directory may cache host capabilities and routing
hints, but it must not become the authority for qualification state.

The issuer therefore sees only references addressed to its verified
organization identity and never needs to know the Fabric channel inventory of
another host or data space. The host that owns each locator enforces tenant,
channel and evidence policy before returning evidence or accepting a decision.
Local indexes are routing and recovery planes, not new sources of truth and not
copies of channel state.

If the issuer did not participate when the evidence was created, the writing
host's local index keeps the addressed reference pending. After onboarding
proves control of the same legal organization identity, the issuer's home host
binds its tenant service to that identity and performs the same exact discovery
against federation peers. Peer hosts can then return the historical pending
references from their local indexes. No historical channel scan is required.
External email or web notification may be added later, but it must carry only
a claim invitation and must not expose the evidence.

The exact cross-host protected-reference derivation is a protocol contract.
Implementations must not assume that tenant-local keyed hashes can be compared
between hosts. The federation must either issue a governed opaque issuer
reference during organization resolution or perform the exact legal-identifier
and jurisdiction match inside an authorized directory and return opaque
references to callers.

### Clearing House actors

The Clearing House exposes different views over the same addressed-reference
workflow. A host controller operates peer discovery, queues, retries, dead
letters, delivery receipts and unresolved protected organization references.
That operational role does not permit opening confidential tenant evidence or
confirming, rejecting, disputing or revoking an item for a tenant.

A tenant controller sees only references addressed to its verified
organization. It may act where controller policy permits or delegate exact
capabilities to an organization group: list inbox, open permitted evidence,
compare authoritative records, propose a decision, approve a decision or
submit the final signed decision. Group membership alone grants nothing; the
gateway requires active assignment, membership and reusable group
authorization for the requested action.

Host observability may expose total pending counts and aggregates by tenant,
addressed destination, domain, lifecycle and delivery state. It may resolve a
destination legal identifier and jurisdiction for an authenticated host
controller's operational display, but general logs, metric labels and
cross-host indexes carry protected organization references instead of raw
legal identifiers. Tenant controllers see only delivery state and safe errors
for items addressed to their organization.

Reuse the audited communication layering where compatible. DIDComm is the
authenticated and optionally encrypted delivery envelope and the binary-file
transport. The Antifraud body is a JSON:API primary document of neutral
Communication and Schema.org `DigitalDocument`/`MediaObject` resources. PDF,
spreadsheet, Word, image, video and other governed bytes travel only in
DIDComm `attachments[]`, as bounded base64url or protected links plus
multihash. No FHIR resource or `DocumentReference` belongs in Antifraud. A
governed `CommMsgExtended` event and durable outbox provide the atomic
confidential event. Preserve queued time, attempt count, last
attempt, next retry, delivered or failed state, safe error category, source and
destination host references and receipt reference. Never expose bearer tokens,
message bodies, evidence or unrestricted diagnostics through observability.

Execution is tracked in [GitHub issue #1](https://github.com/antifraudservices/antifraud-gw-node-ts/issues/1),
after the exact released data-utils and SDK versions exist.

The first MVP is a manual employee workflow. A future machine endpoint or
artificial-intelligence agent is a separately registered service principal
with its own workload credential, bounded assignment, exact capabilities and
audit trail. It may propose a result when authorized but does not inherit
controller authority or bypass a required human approval.

### Issuer credentials presented through a wallet

A credential presented through an EUDI Wallet or another supported OpenID for
Verifiable Presentations flow is issuer evidence, not automatic federation
membership. Before registration, the host must verify the presentation and
holder binding, credential signature and type, issuer trust and jurisdiction,
validity and revocation status, and the policy authorizing the requested use.

When those checks succeed, the gateway may register a privacy-minimized
credential anchor and an `externally-verified` issuer proof in
`qualification-education-<zone>`. It links that proof to the resolved
organization identity in `identity-<zone>`. It does not create a tenant,
controller authority or confirmation service for the issuer. When a valid
issuer credential already supplies the required issuer proof, the employer
attestation need not wait for a duplicate manual confirmation; both provenance
paths remain distinguishable in history.

The channel catalog is extensible. A new evidence domain requires an explicit
domain definition, subject types, searchable claims, ledger-safe projection,
authorization rules, CCAAS inventory and executable tests. It must not be
introduced by accepting an arbitrary channel family from a caller.

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

## Organization service-catalog boundary

The controller owns organization structure, including departments, employee
groups, Schema.org Places and client Services. Those concepts remain separate
in storage and in the portal. Creating structure never publishes it.

An actor with the separately reviewed `controller.catalog.publish` capability
may mark a Place or Service public. The gateway builds the organization catalog
from the shared claims-first contract and trusted server configuration for
publisher jurisdiction, sector, media type and access URL. The browser cannot
select those values. A public Service must belong to a public department and
reference at least one public Place in that same department.

The public graph contains only Schema.org Organization, Place and Service
resources plus its DCAT descriptor. Scheduling, Slots, Appointments, subjects,
research studies, contracts and payments are outside this manager. FHIR
translation, if required later, is an adapter concern rather than a second
canonical write.

## Reusable existing-employee entry

The portal may reuse the neutral existing-professional screen used by other
domains: scan or upload a signed credential QR, or enter one DID/URN plus the
organization sector manually. The presentation returns only a credential or a
routing hint and never grants authority.

The trusted Antifraud backend verifies signature, issuer trust, credential
status, employee binding and jurisdiction, then extracts the active employee
reference from the governed W3C credential and its protected JSON:API primary
document containing Schema.org resources. A health or veterinary host may use
the same screen with an SHC/FHIR adapter, but that adapter is not part of this
gateway. The employee invitation remains a temporary activation artifact, the
professional credential remains reusable evidence and DCR remains a separate
per-device registration.

## Completion condition

The gateway remains a scaffold until automated journeys prove:

1. people route to `identity-global` and education organizations and their
   employees route to `identity-<zone>`;
2. education qualification evidence routes to the exact
   `qualification-education-<zone>` channel;
3. callers cannot choose or override a channel or smart contract;
4. organization, assignment, department, group and subject-policy
   mismatches fail closed;
5. confidential claims are encrypted and searchable values are protected;
6. the same identifier on two channels does not imply shared state;
7. a local-network write returns a real transaction identifier and is read back
   through the public API after restart; and
8. the controller portal completes employee identity, age-over and
   employer qualification-evidence workflows through its backend and
   high-level SDK with authoritative state after reload.

The qualification journey additionally remains incomplete until automated
tests prove all of these paths:

1. a participating issuer is resolved by legal identifier and jurisdiction,
   receives one signed confirmation request and can confirm, reject or revoke
   only evidence addressed to it;
2. a known non-participating issuer produces an
   `awaiting-issuer-onboarding` employer attestation without fabricated tenant
   authority, and the reference appears in its inbox after verified onboarding;
3. a verified wallet credential creates a separate issuer-proof anchor only
   after signature, trust, status, holder-binding and policy checks succeed;
4. an issuer can retrieve addressed references through its own host, which
   performs exact authenticated discovery against peer-host local indexes
   across zones without listing channels or exposing unrelated evidence;
5. lost messages can be recovered from the addressed index without treating
   that index as authoritative qualification state; and
6. the real local controller portal, backend, high-level SDK and gateway complete the
   journey against the in-memory network adapter before any local-network
   Fabric proof is claimed.

The existing isolated React component tests, callback-based editor fixtures
and mocked portal routes do not satisfy these conditions.

Animal qualification and invoice tests are explicitly excluded from this MVP.
Unit tests, mocks, screenshots, HTTP success or configured channel names are
not completion evidence for the education journey.
