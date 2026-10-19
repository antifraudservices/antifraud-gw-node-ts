// Flow contract: Firestore stores only server-owned, environment-prefixed Demo documents; create is conflict-safe, restart reads exact state and purge deletes only the disposable Demo prefix.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FirestoreGatewayDocumentBackend,
  NamespacedGatewayDocumentStore,
} from '../dist/index.js'

class FakeDocumentReference {
  constructor(collection, id) { this.collection = collection; this.id = id }
  async create(value) {
    if (this.collection.values.has(this.id)) throw Object.assign(new Error('already exists'), {code: 6})
    this.collection.values.set(this.id, structuredClone(value))
  }
  async get() {
    const value = this.collection.values.get(this.id)
    return {exists: value !== undefined, data: () => value === undefined ? undefined : structuredClone(value)}
  }
  async set(value) { this.collection.values.set(this.id, structuredClone(value)) }
  async delete() { this.collection.values.delete(this.id) }
}

class FakeCollectionReference {
  constructor(id) { this.id = id; this.values = new Map() }
  doc(id) { return new FakeDocumentReference(this, id) }
  async get() {
    return {docs: [...this.values.keys()].map(id => ({
      id,
      data: () => structuredClone(this.values.get(id)),
      ref: this.doc(id),
    }))}
  }
}

class FakeFirestore {
  constructor() { this.collections = new Map() }
  collection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new FakeCollectionReference(name))
    return this.collections.get(name)
  }
  async listCollections() { return [...this.collections.values()] }
}

test('persists, lists and isolates prefixed documents across adapter reconstruction', async () => {
  const firestore = new FakeFirestore()
  const backend = new FirestoreGatewayDocumentBackend(firestore)
  const demo = new NamespacedGatewayDocumentStore(backend, 'antifraud_demo_')
  const testNetwork = new NamespacedGatewayDocumentStore(backend, 'antifraud_test_network_')
  await demo.create('receipts', 'one', {environment: 'demo'})
  await testNetwork.create('receipts', 'one', {environment: 'test-network'})
  await assert.rejects(demo.create('receipts', 'one', {duplicate: true}), /already exists/i)

  const restarted = new NamespacedGatewayDocumentStore(
    new FirestoreGatewayDocumentBackend(firestore),
    'antifraud_demo_',
  )
  assert.deepEqual(await restarted.read('receipts', 'one'), {environment: 'demo'})
  assert.deepEqual(await restarted.list('receipts'), [{id: 'one', value: {environment: 'demo'}}])
  assert.equal(await restarted.purgeEnvironment(), 1)
  assert.equal(await restarted.read('receipts', 'one'), undefined)
  assert.deepEqual(await testNetwork.read('receipts', 'one'), {environment: 'test-network'})
})
