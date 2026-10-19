// Flow contract: an authenticated employee calls the public education-qualification API without supplying an actor, zone, channel or smart-contract name; the server resolves workforce authority from the bearer credential, records evidence, exposes only the addressed issuer inbox and persists an issuer decision. Unknown credentials and browser-supplied infrastructure fail closed.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test from 'node:test'
import {
  SyntheticConfidentialDocumentFixture,
  buildDidCommInlineBinaryAttachment,
  buildSha3_384EvidenceContentIdFromDigest,
} from 'antifraud-data-utils-ts'
import {
  ConfidentialArtifactStore,
  EducationQualificationGateway,
  InMemoryAddressedReferenceIndex,
  InMemoryControllerAdministrationStore,
  InMemoryGatewayObjectBackend,
  InMemoryQualificationLedger,
  OrganizationControllerGateway,
  StaticIssuerDirectory,
  createAntifraudGatewayHttpHandler,
} from '../dist/index.js'

const actors = new Map([
  ['employer-token', {
    tenantId: 'tenant-employer', organizationReference: 'org:employer', employeeReference: 'employee:reviewer',
    active: true, groupReferences: ['group:qualification-evidence'],
    capabilities: ['qualification-evidence:create', 'confidential-artifact:write', 'confidential-artifact:read'],
  }],
  ['issuer-token', {
    tenantId: 'tenant-issuer', organizationReference: 'org:issuer', employeeReference: 'employee:issuer-reviewer',
    active: true, groupReferences: ['group:qualification-decisions'], capabilities: ['qualification-inbox:list', 'qualification-evidence:decide'],
  }],
  ['identity-token', {
    tenantId: 'tenant-employer', organizationReference: 'org:employer', employeeReference: 'employee:identity-reviewer',
    assignmentReference: 'assignment:identity-reviewer', active: true,
    groupReferences: ['group:controller-created-identity-reviewers'], capabilities: ['identity.evidence.record'],
    groupAuthorization: {
      groupReference: 'group:controller-created-identity-reviewers',
      authorizationReference: 'authorization:controller:identity-reviewers',
      controllerReference: 'controller:employer', status: 'active', capabilities: ['identity.evidence.record'],
    },
  }],
  ['controller-token', {
    tenantId: 'tenant-employer', organizationReference: 'org:employer', employeeReference: 'employee:controller',
    active: true, groupReferences: ['group:controllers'],
    capabilities: ['controller.organization.read', 'controller.structure.write', 'controller.workforce.write'],
  }],
])

test('completes the authenticated HTTP evidence and issuer-decision journey', async t => {
  const gateway = new EducationQualificationGateway({
    ledger: new InMemoryQualificationLedger(),
    index: new InMemoryAddressedReferenceIndex(),
    directory: new StaticIssuerDirectory([{
      legalIdentifier: 'EU-UNIVERSITY-1', jurisdiction: 'ES', organizationReference: 'org:issuer',
      tenantId: 'tenant-issuer', confirmationService: 'https://issuer.invalid/confirm',
    }]),
  })
  const handler = createAntifraudGatewayHttpHandler({
    gateway,
    controller: new OrganizationControllerGateway({ store: new InMemoryControllerAdministrationStore() }),
    resolveActor: async bearer => actors.get(bearer),
  })
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const baseUrl = `http://127.0.0.1:${address.port}`

  const health = await fetch(`${baseUrl}/healthz`)
  assert.equal(health.status, 200)
  assert.deepEqual(await health.json(), { status: 'ok' })

  const recorded = await jsonRequest(`${baseUrl}/v1/education/qualification-evidence`, 'POST', 'employer-token', {
    evidenceId: 'evidence:http:001', subjectReference: 'person:opaque-http',
    issuer: { legalIdentifier: 'EU-UNIVERSITY-1', jurisdiction: 'ES' },
    qualificationReference: 'qualification:opaque-http',
    documentCid: SyntheticConfidentialDocumentFixture.attachment.contentId,
    confidentialClaims: {
      qualification: {classification: {system: 'urn:example:qualification', version: '2026', code: 'BACHELOR-001'}},
      assertionKind: 'employer-attestation',
    },
  })
  assert.equal(recorded.response.status, 201)
  assert.equal(recorded.body.channel, 'qualification-education-eu')
  assert.match(recorded.body.transactionId, /^tx:/)

  const inbox = await jsonRequest(`${baseUrl}/v1/clearing-house/inbox`, 'GET', 'issuer-token')
  assert.equal(inbox.response.status, 200)
  assert.equal(inbox.body.items.length, 1)
  assert.equal(inbox.body.items[0].evidenceLocator, 'evidence:http:001')

  const detail = await jsonRequest(`${baseUrl}/v1/clearing-house/evidence/evidence%3Ahttp%3A001`, 'GET', 'issuer-token')
  assert.equal(detail.response.status, 200)
  assert.deepEqual(detail.body.confidentialClaims.qualification.classification, {
    system: 'urn:example:qualification', version: '2026', code: 'BACHELOR-001',
  })
  assert.equal(detail.body.confidentialClaims.assertionKind, 'employer-attestation')
  const wrongOrganizationDetail = await jsonRequest(`${baseUrl}/v1/clearing-house/evidence/evidence%3Ahttp%3A001`, 'GET', 'employer-token')
  assert.equal(wrongOrganizationDetail.response.status, 400)

  const decided = await jsonRequest(`${baseUrl}/v1/clearing-house/evidence/evidence%3Ahttp%3A001/decision`, 'POST', 'issuer-token', {
    decision: 'confirmed', issuerProofReference: 'proof:issuer:http:001',
  })
  assert.equal(decided.response.status, 200)
  assert.equal(decided.body.status, 'confirmed')

  const unauthenticated = await jsonRequest(`${baseUrl}/v1/clearing-house/inbox`, 'GET', 'unknown-token')
  assert.equal(unauthenticated.response.status, 401)
  const injected = await jsonRequest(`${baseUrl}/v1/education/qualification-evidence`, 'POST', 'employer-token', {
    evidenceId: 'evidence:http:002', subjectReference: 'person:opaque-http-2',
    issuer: { legalIdentifier: 'EU-UNIVERSITY-1', jurisdiction: 'ES' },
    qualificationReference: 'qualification:opaque-http-2',
    documentCid: SyntheticConfidentialDocumentFixture.attachment.contentId,
    encryptedClaims: 'jwe.http.payload.2', channel: 'identity-global',
  })
  assert.equal(injected.response.status, 400)

  const invalidCid = await jsonRequest(`${baseUrl}/v1/education/qualification-evidence`, 'POST', 'employer-token', {
    evidenceId: 'evidence:http:invalid-cid', subjectReference: 'person:opaque-http-3',
    issuer: { legalIdentifier: 'EU-UNIVERSITY-1', jurisdiction: 'ES' },
    qualificationReference: 'qualification:opaque-http-3', documentCid: 'z123',
    encryptedClaims: 'jwe.http.payload.3',
  })
  assert.equal(invalidCid.response.status, 400)
  assert.match(invalidCid.body.error, /CIDv1 raw with a SHA3-384 multihash/i)
  const unchangedInbox = await jsonRequest(`${baseUrl}/v1/clearing-house/inbox`, 'GET', 'issuer-token')
  assert.equal(unchangedInbox.body.items.length, 1)

  const identityEvidence = await jsonRequest(`${baseUrl}/v1/identity/evidence`, 'POST', 'identity-token', {
    operationId: 'identity-evidence:http:001', subjectReference: 'person:employee:http:001',
    targets: [{
      kind: 'predicate', predicate: 'age-over', sourceSubjectReference: 'person:employee:http:001',
      sourceClaimPath: 'org.schema.Person.birthDate', threshold: 18, result: true,
    }],
    evidence: [{
      id: 'check:http:001', type: 'document', observedAt: '2026-10-17T20:00:00.000Z',
      checks: [{ checkMethod: 'document-and-holder-review', checkId: 'review:http:001' }],
    }],
    encryptedClaims: 'jwe.identity.http.001',
  })
  assert.equal(identityEvidence.response.status, 201)
  assert.equal(identityEvidence.body.channel, 'identity-global')
  assert.equal(identityEvidence.body.anchor.targetKinds[0], 'predicate')

  const createdDepartment = await jsonRequest(`${baseUrl}/v1/controller/departments`, 'POST', 'controller-token', {name: 'Operations'})
  assert.equal(createdDepartment.response.status, 201)
  const state = await jsonRequest(`${baseUrl}/v1/controller/workspace`, 'GET', 'controller-token')
  assert.equal(state.response.status, 200)
  assert.equal(state.body.departments[0].name, 'Operations')
  const authorityInjection = await jsonRequest(`${baseUrl}/v1/controller/departments`, 'POST', 'controller-token', {
    name: 'Injected', organizationReference: 'org:other',
  })
  assert.equal(authorityInjection.response.status, 400)
})

test('stores and retrieves exact PDF bytes through Schema.org and DIDComm contracts', async t => {
  const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n')
  const digestBytes = createHash('sha3-384').update(pdfBytes).digest()
  const digest = digestBytes.toString('base64')
  const contentId = buildSha3_384EvidenceContentIdFromDigest(digestBytes)
  const documentInput = {
    manifest: SyntheticConfidentialDocumentFixture.manifest,
    documents: [{
      ...SyntheticConfidentialDocumentFixture.document,
      attachment: {
        id: 'urn:attachment:http-minimal-pdf',
        mediaType: 'application/pdf',
        contentSize: pdfBytes.byteLength,
        contentUrl: `/v1/confidential-artifacts/${encodeURIComponent(contentId)}`,
        digestAlgorithm: 'sha3-384',
        digest,
        contentId,
      },
    }],
  }
  const store = new ConfidentialArtifactStore({
    objects: new InMemoryGatewayObjectBackend(),
    objectPrefix: 'test:artifacts:',
    wallet: {
      async protectArtifact(owner, bytes) {
        return `${owner}.${Buffer.from(bytes).toString('base64url')}`
      },
      async unprotectArtifact(owner, sealed) {
        assert.ok(sealed.startsWith(`${owner}.`))
        return Buffer.from(sealed.slice(owner.length + 1), 'base64url')
      },
    },
  })
  const gateway = new EducationQualificationGateway({
    ledger: new InMemoryQualificationLedger(),
    index: new InMemoryAddressedReferenceIndex(),
    directory: new StaticIssuerDirectory([]),
  })
  const handler = createAntifraudGatewayHttpHandler({
    gateway,
    artifacts: store,
    resolveActor: async bearer => actors.get(bearer),
  })
  const server = createServer(handler)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const baseUrl = `http://127.0.0.1:${address.port}`

  const created = await jsonRequest(`${baseUrl}/v1/confidential-artifacts`, 'POST', 'employer-token', {
    document: documentInput,
    attachment: buildDidCommInlineBinaryAttachment({
      id: documentInput.documents[0].attachment.id,
      mediaType: 'application/pdf',
      bytes: pdfBytes,
    }),
    fileName: 'synthetic-minimal.pdf',
  })
  assert.equal(created.response.status, 201)
  assert.equal(created.body.document.jsonapi.version, '1.1')
  assert.equal(created.body.artifact.byteCount, pdfBytes.byteLength)
  assert.equal('DocumentReference' in JSON.parse(JSON.stringify(created.body)), false)

  const retrieved = await fetch(`${baseUrl}/v1/confidential-artifacts/${encodeURIComponent(contentId)}`, {
    headers: { authorization: 'Bearer employer-token' },
  })
  assert.equal(retrieved.status, 200)
  assert.equal(retrieved.headers.get('content-type'), 'application/pdf')
  assert.deepEqual(Buffer.from(await retrieved.arrayBuffer()), pdfBytes)

  const denied = await fetch(`${baseUrl}/v1/confidential-artifacts/${encodeURIComponent(contentId)}`, {
    headers: { authorization: 'Bearer issuer-token' },
  })
  assert.equal(denied.status, 400)
})

async function jsonRequest(url, method, token, body) {
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { response, body: await response.json() }
}
