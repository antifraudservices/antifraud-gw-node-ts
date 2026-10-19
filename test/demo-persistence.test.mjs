// Flow contract: reuse shared test fixtures and canonical types; do not introduce duplicated literals.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ConfidentialArtifactStore,
  InMemoryGatewayDocumentBackend,
  InMemoryGatewayObjectBackend,
  NamespacedGatewayDocumentStore,
  resolveGatewayPersistenceProfile,
} from '../dist/index.js'

test('derives disjoint server-owned collection prefixes and disposable Demo retention', async () => {
  assert.deepEqual(resolveGatewayPersistenceProfile({
    ANTIFRAUD_NETWORK_KIND: 'demo', ANTIFRAUD_DEMO_RETENTION_DAYS: '7',
  }), {
    environment: 'demo', collectionPrefix: 'antifraud_demo_', enabled: true,
    disposable: true, retentionDays: 7,
  })
  assert.deepEqual(resolveGatewayPersistenceProfile({
    ANTIFRAUD_NETWORK_KIND: 'test-network', ANTIFRAUD_TEST_NETWORK_ENABLED: 'true',
  }), {
    environment: 'test-network', collectionPrefix: 'antifraud_test_network_', enabled: true,
    disposable: false, retentionDays: null,
  })
  assert.deepEqual(resolveGatewayPersistenceProfile({ANTIFRAUD_NETWORK_KIND: 'test-network'}), {
    environment: 'test-network', collectionPrefix: 'antifraud_test_network_', enabled: false,
    disposable: false, retentionDays: null,
  })
  assert.deepEqual(resolveGatewayPersistenceProfile({ANTIFRAUD_NETWORK_KIND: 'network'}), {
    environment: 'production', collectionPrefix: 'antifraud_production_', enabled: false,
    disposable: false, retentionDays: null,
  })

  const backend = new InMemoryGatewayDocumentBackend()
  const demo = new NamespacedGatewayDocumentStore(backend, 'antifraud_demo_')
  const testNetwork = new NamespacedGatewayDocumentStore(backend, 'antifraud_test_network_')
  await demo.create('receipts', 'same-id', {environment: 'demo'})
  await testNetwork.create('receipts', 'same-id', {environment: 'test-network'})
  assert.deepEqual(await demo.read('receipts', 'same-id'), {environment: 'demo'})
  assert.deepEqual(await testNetwork.read('receipts', 'same-id'), {environment: 'test-network'})
  assert.deepEqual(backend.collectionNames(), [
    'antifraud_demo_receipts', 'antifraud_test_network_receipts',
  ])

  assert.equal(await demo.purgeEnvironment(), 1)
  assert.equal(await demo.read('receipts', 'same-id'), undefined)
  assert.deepEqual(await testNetwork.read('receipts', 'same-id'), {environment: 'test-network'})
  assert.throws(
    () => resolveGatewayPersistenceProfile({
      ANTIFRAUD_NETWORK_KIND: 'demo', ANTIFRAUD_DEMO_RETENTION_DAYS: '0',
    }),
    /retention/i,
  )
})

test('stores only wallet-sealed artifact bytes and requires exact organization authorization', async () => {
  const objects = new InMemoryGatewayObjectBackend()
  const walletCalls = []
  const store = new ConfidentialArtifactStore({
    objects,
    wallet: {
      async protectArtifact(owner, content) {
        walletCalls.push(['protect', owner, content])
        return `sealed:${Buffer.from(content).toString('base64url')}`
      },
      async unprotectArtifact(owner, sealed) {
        walletCalls.push(['unprotect', owner, sealed])
        return Buffer.from(sealed.slice('sealed:'.length), 'base64url')
      },
    },
    objectPrefix: 'antifraud_demo_attachments/',
  })
  const bytes = Buffer.from('%PDF-1.4\nminimal synthetic attachment\n%%EOF')
  const receipt = await store.put({
    artifactId: 'artifact:synthetic-pdf',
    organizationReference: 'organization:synthetic',
    mediaType: 'application/pdf',
    fileName: 'synthetic.pdf',
    bytes,
  })

  assert.equal((await objects.raw(receipt.objectName)).includes('%PDF'), false)
  await assert.rejects(
    store.get('artifact:synthetic-pdf', 'organization:other'),
    /not authorized/u,
  )
  assert.deepEqual(
    await store.get('artifact:synthetic-pdf', 'organization:synthetic'),
    {mediaType: 'application/pdf', fileName: 'synthetic.pdf', bytes},
  )
  assert.deepEqual(walletCalls.map(call => call[0]), ['protect', 'unprotect'])
})
