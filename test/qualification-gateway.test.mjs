// Flow contract: an authorized education employee records encrypted qualification evidence without choosing a ledger target; the trusted gateway derives the zone and channel, persists an authoritative anchor with a transaction identifier, creates one privacy-minimized addressed reference, supports exact issuer inbox discovery and accepts only issuer-owned decisions. A known non-participating issuer remains awaiting onboarding. Inactive assignments, missing capabilities, mismatched organizations and caller-supplied channels fail closed.
import assert from 'node:assert/strict'
import test from 'node:test'
import { SyntheticConfidentialDocumentFixture } from 'antifraud-data-utils-ts'
import {
  EducationQualificationGateway,
  InMemoryAddressedReferenceIndex,
  InMemoryQualificationLedger,
  StaticIssuerDirectory,
} from '../dist/index.js'

const employerActor = {
  tenantId: 'tenant-employer', organizationReference: 'org:employer', employeeReference: 'employee:reviewer',
  active: true, groupReferences: ['group:qualification-evidence'],
  capabilities: ['qualification-evidence:create'],
}
const issuerActor = {
  tenantId: 'tenant-issuer', organizationReference: 'org:issuer', employeeReference: 'employee:issuer-reviewer',
  active: true, groupReferences: ['group:qualification-decisions'],
  capabilities: ['qualification-inbox:list', 'qualification-evidence:decide'],
}
const validDocumentCid = SyntheticConfidentialDocumentFixture.attachment.contentId

function buildGateway() {
  const ledger = new InMemoryQualificationLedger()
  const index = new InMemoryAddressedReferenceIndex()
  const directory = new StaticIssuerDirectory([
    { legalIdentifier: 'EU-UNIVERSITY-1', jurisdiction: 'ES', organizationReference: 'org:issuer', tenantId: 'tenant-issuer', confirmationService: 'https://issuer.invalid/confirm' },
    { legalIdentifier: 'EU-UNIVERSITY-2', jurisdiction: 'ES', organizationReference: 'org:known-issuer' },
  ])
  return { gateway: new EducationQualificationGateway({ ledger, index, directory }), ledger, index }
}

test('derives the education channel and completes participant issuer confirmation with authoritative readback', async () => {
  const { gateway, ledger, index } = buildGateway()
  const result = await gateway.recordEmployerEvidence({
    actor: employerActor,
    evidenceId: 'evidence:001', subjectReference: 'person:opaque-subject',
    issuer: { legalIdentifier: 'EU-UNIVERSITY-1', jurisdiction: 'ES' },
    qualificationReference: 'qualification:opaque-1', documentCid: validDocumentCid,
    encryptedClaims: 'jwe.compact.payload',
  })

  assert.equal(result.channel, 'qualification-education-eu')
  assert.match(result.transactionId, /^tx:/)
  assert.equal(result.status, 'pending-issuer-confirmation')
  assert.deepEqual(await ledger.read('qualification-education-eu', 'evidence:001'), result.anchor)
  assert.equal((await index.listForDestination('org:issuer')).length, 1)

  const inbox = await gateway.listIssuerInbox({ actor: issuerActor })
  assert.equal(inbox.length, 1)
  assert.equal(inbox[0].evidenceLocator, 'evidence:001')
  assert.equal(JSON.stringify(inbox).includes('EU-UNIVERSITY-1'), false)
  assert.equal(JSON.stringify(inbox).includes('opaque-subject'), false)

  const decision = await gateway.recordIssuerDecision({
    actor: issuerActor, evidenceLocator: 'evidence:001', decision: 'confirmed', issuerProofReference: 'proof:issuer:001',
  })
  assert.equal(decision.status, 'confirmed')
  assert.match(decision.transactionId, /^tx:/)
  assert.equal((await ledger.read('qualification-education-eu', 'evidence:001'))?.status, 'confirmed')
})

test('keeps a known non-participating issuer awaiting verified onboarding', async () => {
  const { gateway, index } = buildGateway()
  const result = await gateway.recordEmployerEvidence({
    actor: employerActor,
    evidenceId: 'evidence:002', subjectReference: 'person:opaque-subject-2',
    issuer: { legalIdentifier: 'EU-UNIVERSITY-2', jurisdiction: 'ES' },
    qualificationReference: 'qualification:opaque-2', documentCid: validDocumentCid,
    encryptedClaims: 'jwe.compact.payload.2',
  })
  assert.equal(result.status, 'awaiting-issuer-onboarding')
  assert.equal((await index.listForDestination('org:known-issuer'))[0].deliveryState, 'awaiting-onboarding')
})

test('fails closed for client-selected infrastructure and invalid workforce authority', async () => {
  const { gateway } = buildGateway()
  const request = {
    actor: employerActor,
    evidenceId: 'evidence:003', subjectReference: 'person:opaque-subject-3',
    issuer: { legalIdentifier: 'EU-UNIVERSITY-1', jurisdiction: 'ES' },
    qualificationReference: 'qualification:opaque-3', documentCid: validDocumentCid,
    encryptedClaims: 'jwe.compact.payload.3',
  }
  await assert.rejects(() => gateway.recordEmployerEvidence({ ...request, channel: 'identity-global' }), /must not select/i)
  await assert.rejects(() => gateway.recordEmployerEvidence({ ...request, actor: { ...employerActor, active: false } }), /active assignment/i)
  await assert.rejects(() => gateway.recordEmployerEvidence({ ...request, actor: { ...employerActor, capabilities: [] } }), /capability/i)
  await assert.rejects(() => gateway.recordEmployerEvidence({ ...request, issuer: { legalIdentifier: 'UNKNOWN', jurisdiction: 'ES' } }), /issuer could not be resolved/i)
  await assert.rejects(() => gateway.recordEmployerEvidence({
    ...request,
    evidenceId: 'evidence:invalid-cid',
    documentCid: 'z123',
  }), /CIDv1 raw with a SHA3-384 multihash/i)
})

test('does not let another organization list or decide addressed evidence', async () => {
  const { gateway } = buildGateway()
  await gateway.recordEmployerEvidence({
    actor: employerActor,
    evidenceId: 'evidence:004', subjectReference: 'person:opaque-subject-4',
    issuer: { legalIdentifier: 'EU-UNIVERSITY-1', jurisdiction: 'ES' },
    qualificationReference: 'qualification:opaque-4', documentCid: validDocumentCid,
    encryptedClaims: 'jwe.compact.payload.4',
  })
  const intruder = { ...issuerActor, tenantId: 'tenant-other', organizationReference: 'org:other' }
  assert.deepEqual(await gateway.listIssuerInbox({ actor: intruder }), [])
  await assert.rejects(() => gateway.recordIssuerDecision({
    actor: intruder, evidenceLocator: 'evidence:004', decision: 'rejected', issuerProofReference: 'proof:other',
  }), /addressed issuer/i)
})

test('retains the trusted North American route across gateway recreation without exposing it in the inbox', async () => {
  const ledger = new InMemoryQualificationLedger()
  const index = new InMemoryAddressedReferenceIndex()
  const directory = new StaticIssuerDirectory([{
    legalIdentifier: 'NA-UNIVERSITY-1', jurisdiction: 'US', organizationReference: 'org:issuer-na',
    tenantId: 'tenant-issuer-na', confirmationService: 'https://issuer-na.invalid/confirm',
  }])
  const firstGateway = new EducationQualificationGateway({ ledger, index, directory })
  const recorded = await firstGateway.recordEmployerEvidence({
    actor: employerActor,
    evidenceId: 'evidence:na:001', subjectReference: 'person:opaque-subject-na',
    issuer: { legalIdentifier: 'NA-UNIVERSITY-1', jurisdiction: 'US' },
    qualificationReference: 'qualification:opaque-na', documentCid: validDocumentCid,
    encryptedClaims: 'jwe.compact.payload.na',
  })
  assert.equal(recorded.channel, 'qualification-education-na')

  const issuerNaActor = {
    ...issuerActor, tenantId: 'tenant-issuer-na', organizationReference: 'org:issuer-na',
  }
  const inbox = await firstGateway.listIssuerInbox({ actor: issuerNaActor })
  assert.equal(JSON.stringify(inbox).includes('qualification-education-na'), false)

  const recreatedGateway = new EducationQualificationGateway({ ledger, index, directory })
  const decision = await recreatedGateway.recordIssuerDecision({
    actor: issuerNaActor,
    evidenceLocator: 'evidence:na:001',
    decision: 'confirmed',
    issuerProofReference: 'proof:issuer:na:001',
  })
  assert.equal(decision.channel, 'qualification-education-na')
  assert.equal((await ledger.read('qualification-education-na', 'evidence:na:001'))?.status, 'confirmed')
})
