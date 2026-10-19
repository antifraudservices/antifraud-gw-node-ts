// Flow contract: the local-network ledger adapter submits and evaluates the exact privacy-minimized qualification anchor on the server-derived Fabric channel, returns Fabric transaction IDs and never sends confidential claims or binary attachments.
import assert from 'node:assert/strict'
import test from 'node:test'

import { FabricQualificationLedger } from '../dist/fabric-qualification-ledger.js'

const anchor = Object.freeze({
  evidenceId: 'evidence:qualification:fabric:001',
  subjectReference: 'person:opaque:fabric:001',
  employerOrganizationReference: 'organization:employer',
  issuerOrganizationReference: 'organization:issuer',
  qualificationReference: 'qualification:opaque:fabric:001',
  documentCid: 'z5Wzs7vSyntheticallyOpaqueCid',
  status: 'pending-issuer-confirmation',
  employerProofReference: 'proof:employer:evidence:qualification:fabric:001',
  recordedAt: '2027-01-15T08:00:00.000Z',
  updatedAt: '2027-01-15T08:00:00.000Z',
})

test('creates, reads and updates through the resolved Fabric channel contract', async () => {
  const records = new Map()
  const calls = []
  const ledger = new FabricQualificationLedger(async channel => ({
    async submit(transactionName, ...args) {
      calls.push({channel, transactionName, args})
      if (transactionName === 'CreateQualificationAnchor') records.set(args[0], JSON.parse(args[1]))
      if (transactionName === 'UpdateQualificationAnchor') records.set(args[0], {...records.get(args[0]), ...JSON.parse(args[1])})
      return {transactionId: `fabric:${calls.length}`, result: Buffer.from(JSON.stringify(records.get(args[0])))}
    },
    async evaluate(transactionName, ...args) {
      calls.push({channel, transactionName, args})
      return Buffer.from(JSON.stringify(records.get(args[0])))
    },
  }))

  const created = await ledger.create('qualification-education-na', anchor)
  assert.equal(created.transactionId, 'fabric:1')
  assert.deepEqual(await ledger.read('qualification-education-na', anchor.evidenceId), anchor)
  const updated = await ledger.update('qualification-education-na', anchor.evidenceId, {
    status: 'confirmed', issuerProofReference: 'proof:issuer:001', updatedAt: '2027-01-15T09:00:00.000Z',
  })
  assert.equal(updated.transactionId, 'fabric:3')
  assert.equal(updated.anchor.status, 'confirmed')
  assert.deepEqual(calls.map(call => call.transactionName), [
    'CreateQualificationAnchor', 'ReadQualificationAnchor', 'UpdateQualificationAnchor',
  ])
  assert.doesNotMatch(JSON.stringify(calls), /encryptedClaims|attachment|privateKey/u)
})

test('rejects browser-selected or unsupported channels before resolving Fabric', async () => {
  const ledger = new FabricQualificationLedger(async () => { throw new Error('must not resolve') })
  await assert.rejects(ledger.create('identity-global', anchor), /qualification-education channel/u)
})
