// Flow contract: an authenticated employee calls the public education-qualification API without supplying an actor, zone, channel or smart-contract name; the server resolves workforce authority from the bearer credential, records evidence, exposes only the addressed issuer inbox and persists an issuer decision. Unknown credentials and browser-supplied infrastructure fail closed.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import test from 'node:test'
import {
  EducationQualificationGateway,
  InMemoryAddressedReferenceIndex,
  InMemoryQualificationLedger,
  StaticIssuerDirectory,
  createAntifraudGatewayHttpHandler,
} from '../dist/index.js'

const actors = new Map([
  ['employer-token', {
    tenantId: 'tenant-employer', organizationReference: 'org:employer', employeeReference: 'employee:reviewer',
    active: true, groupReferences: ['group:qualification-evidence'], capabilities: ['qualification-evidence:create'],
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
    qualificationReference: 'qualification:opaque-http', documentCid: 'zQmHttpCid',
    encryptedClaims: 'jwe.http.payload',
  })
  assert.equal(recorded.response.status, 201)
  assert.equal(recorded.body.channel, 'qualification-education-eu')
  assert.match(recorded.body.transactionId, /^tx:/)

  const inbox = await jsonRequest(`${baseUrl}/v1/clearing-house/inbox`, 'GET', 'issuer-token')
  assert.equal(inbox.response.status, 200)
  assert.equal(inbox.body.items.length, 1)
  assert.equal(inbox.body.items[0].evidenceLocator, 'evidence:http:001')

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
    qualificationReference: 'qualification:opaque-http-2', documentCid: 'zQmHttpCid2',
    encryptedClaims: 'jwe.http.payload.2', channel: 'identity-global',
  })
  assert.equal(injected.response.status, 400)

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
})

async function jsonRequest(url, method, token, body) {
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { response, body: await response.json() }
}
