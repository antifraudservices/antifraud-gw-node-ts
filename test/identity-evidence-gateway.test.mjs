// Flow contract: an authenticated employee with an active controller-authorized group records subject-identity or age-over evidence through the neutral gateway. The browser supplies only the evidence request and encrypted claims; the server supplies the employee, assignment, organization and group authorization. The gateway validates the canonical neutral evidence contract, writes a privacy-minimized anchor to identity-global and keeps the evidence payload confidential. Missing membership, capability, trusted authorization or caller-selected infrastructure fails closed.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EducationQualificationGateway,
  InMemoryAddressedReferenceIndex,
  InMemoryIdentityEvidenceLedger,
  InMemoryQualificationLedger,
  StaticIssuerDirectory,
} from '../dist/index.js'

const identityActor = {
  tenantId: 'tenant-employer',
  organizationReference: 'org:employer',
  employeeReference: 'employee:reviewer',
  assignmentReference: 'assignment:reviewer',
  active: true,
  groupReferences: ['group:controller-created-evidence-reviewers'],
  capabilities: ['identity.evidence.record'],
  groupAuthorization: {
    groupReference: 'group:controller-created-evidence-reviewers',
    authorizationReference: 'authorization:controller:evidence-reviewers',
    controllerReference: 'controller:employer',
    status: 'active',
    capabilities: ['identity.evidence.record'],
  },
}

function buildGateway() {
  const identityLedger = new InMemoryIdentityEvidenceLedger()
  const gateway = new EducationQualificationGateway({
    ledger: new InMemoryQualificationLedger(),
    identityLedger,
    index: new InMemoryAddressedReferenceIndex(),
    directory: new StaticIssuerDirectory([]),
    clock: () => '2026-10-17T20:00:00.000Z',
  })
  return { gateway, identityLedger }
}

function ageOverRequest() {
  return {
    actor: identityActor,
    operationId: 'identity-evidence:employee:001',
    subjectReference: 'person:employee:opaque-001',
    targets: [{
      kind: 'predicate', predicate: 'age-over',
      sourceSubjectReference: 'person:employee:opaque-001',
      sourceClaimPath: 'org.schema.Person.birthDate', threshold: 21, result: true,
    }],
    evidence: [{
      id: 'check:document:001', type: 'document', observedAt: '2026-10-17T19:59:00.000Z',
      checks: [{ checkMethod: 'document-and-holder-review', checkId: 'review:001' }],
    }],
    encryptedClaims: 'jwe.identity.evidence.001',
  }
}

test('records canonical employee age-over evidence on identity-global with authoritative readback', async () => {
  const { gateway, identityLedger } = buildGateway()
  const result = await gateway.recordIdentityEvidence(ageOverRequest())

  assert.equal(result.channel, 'identity-global')
  assert.match(result.transactionId, /^tx:/)
  assert.equal(result.anchor.evidenceId, 'identity-evidence:employee:001')
  assert.deepEqual(result.anchor.targetKinds, ['predicate'])
  assert.equal(result.anchor.employeeReference, identityActor.employeeReference)
  assert.deepEqual(await identityLedger.read('identity-global', result.anchor.evidenceId), result.anchor)
  assert.equal(JSON.stringify(result.anchor).includes('birthDate'), false)
  assert.equal(JSON.stringify(result.anchor).includes('jwe.identity'), false)
})

test('fails closed when trusted identity-evidence authority or infrastructure ownership is missing', async () => {
  const { gateway } = buildGateway()
  await assert.rejects(
    () => gateway.recordIdentityEvidence({ ...ageOverRequest(), actor: { ...identityActor, capabilities: [] } }),
    /capability/i,
  )
  await assert.rejects(
    () => gateway.recordIdentityEvidence({ ...ageOverRequest(), actor: { ...identityActor, groupAuthorization: undefined } }),
    /group authorization/i,
  )
  await assert.rejects(
    () => gateway.recordIdentityEvidence({ ...ageOverRequest(), channel: 'qualification-education-eu' }),
    /must not select/i,
  )
})
