// Flow contract: automated tests use immediate in-memory ledgers, an explicitly configured staging demo uses the same gateway contract with a six-second simulated Fabric operation delay, and every local-network, Test Network or production profile requires the real Fabric adapter. No public caller may select this profile.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  InMemoryIdentityEvidenceLedger,
  InMemoryQualificationLedger,
  resolveGatewayNetworkProfile,
} from '../dist/index.js'

const qualificationAnchor = {
  evidenceId: 'evidence:delay:001',
  subjectReference: 'person:opaque:001',
  employerOrganizationReference: 'organization:employer',
  issuerOrganizationReference: 'organization:issuer',
  qualificationReference: 'qualification:001',
  documentCid: 'zQmSyntheticCid',
  status: 'pending-issuer-confirmation',
  employerProofReference: 'proof:employer:001',
  recordedAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
}

const identityAnchor = {
  evidenceId: 'identity-evidence:delay:001',
  subjectReference: 'person:opaque:001',
  employerOrganizationReference: 'organization:employer',
  employeeReference: 'employee:reviewer',
  groupAuthorizationReference: 'authorization:reviewers',
  targetKinds: ['predicate'],
  status: 'recorded',
  employerProofReference: 'proof:employer:identity:001',
  recordedAt: '2026-10-18T00:00:00.000Z',
}

test('selects a six-second in-memory Fabric simulation only for an explicit staging demo', () => {
  assert.deepEqual(resolveGatewayNetworkProfile({
    ANTIFRAUD_DEPLOYMENT_STAGE: 'staging',
    ANTIFRAUD_DEMO_MODE: 'true',
  }), {
    networkKind: 'demo',
    adapter: 'memory',
    operationDelayMs: 6000,
  })

  assert.deepEqual(resolveGatewayNetworkProfile({ ANTIFRAUD_NETWORK_KIND: 'local-network' }), {
    networkKind: 'local-network', adapter: 'fabric', operationDelayMs: 0,
  })
  assert.deepEqual(resolveGatewayNetworkProfile({ ANTIFRAUD_NETWORK_KIND: 'test-network' }), {
    networkKind: 'test-network', adapter: 'fabric', operationDelayMs: 0,
  })
  assert.deepEqual(resolveGatewayNetworkProfile({ ANTIFRAUD_NETWORK_KIND: 'network' }), {
    networkKind: 'network', adapter: 'fabric', operationDelayMs: 0,
  })
  assert.throws(
    () => resolveGatewayNetworkProfile({ ANTIFRAUD_DEPLOYMENT_STAGE: 'network', ANTIFRAUD_DEMO_MODE: 'true' }),
    /staging only/i,
  )
})

test('applies the configured delay to qualification and identity ledger operations', async () => {
  const waits = []
  const wait = async milliseconds => { waits.push(milliseconds) }
  const qualification = new InMemoryQualificationLedger({ operationDelayMs: 6000, wait })
  const identity = new InMemoryIdentityEvidenceLedger({ operationDelayMs: 6000, wait })

  await qualification.create('qualification-education-eu', qualificationAnchor)
  await qualification.read('qualification-education-eu', qualificationAnchor.evidenceId)
  await identity.create('identity-global', identityAnchor)
  await identity.read('identity-global', identityAnchor.evidenceId)

  assert.deepEqual(waits, [6000, 6000, 6000, 6000])
})
