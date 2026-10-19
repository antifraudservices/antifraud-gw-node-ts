// Flow contract: the identity-global adapter submits and evaluates only the minimized workforce evidence anchor, preserves target kinds such as age-over predicate, returns the Fabric transaction ID and rejects every other channel.
import assert from 'node:assert/strict'
import test from 'node:test'
import {FabricIdentityEvidenceLedger} from '../dist/index.js'

const anchor = Object.freeze({
  evidenceId: 'identity-evidence:fabric:001', subjectReference: 'person:opaque:fabric',
  employerOrganizationReference: 'organization:employer', employeeReference: 'employee:reviewer',
  groupAuthorizationReference: 'authorization:evidence', targetKinds: ['predicate'], status: 'recorded',
  employerProofReference: 'proof:employer:identity-evidence:fabric:001', recordedAt: '2027-01-15T08:00:00.000Z',
})

test('creates and reads identity evidence through Fabric', async () => {
  let stored
  const ledger = new FabricIdentityEvidenceLedger(async channel => ({
    async submit(name, evidenceId, serialized) {
      assert.equal(channel, 'identity-global'); assert.equal(name, 'CreateIdentityEvidenceAnchor')
      stored = JSON.parse(serialized)
      return {transactionId: 'fabric:identity:1', result: Buffer.from(JSON.stringify(stored))}
    },
    async evaluate(name, evidenceId) {
      assert.equal(name, 'ReadIdentityEvidenceAnchor'); assert.equal(evidenceId, anchor.evidenceId)
      return Buffer.from(JSON.stringify(stored))
    },
  }))
  const created = await ledger.create('identity-global', anchor)
  assert.equal(created.transactionId, 'fabric:identity:1')
  assert.deepEqual(await ledger.read('identity-global', anchor.evidenceId), anchor)
})
