// Flow contract: the social BFF submits one exact verified managed-wallet proof, the Gateway recomputes its public manifest binding, waits on the explicit virtual-ledger adapter, persists one authoritative Demo receipt and reloads it after restart; replay and cross-tenant read fail closed.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ManagedSigningAlgorithm,
  ManagedSignatureProofStatus,
  buildSocialPublicationManifestDigest,
} from 'antifraud-data-utils-ts'
import {
  GatewayDocumentSocialPublicationStore,
  InMemoryGatewayDocumentBackend,
  NamespacedGatewayDocumentStore,
  SocialPublicationDemoGateway,
} from '../dist/index.js'

const content = Object.freeze({
  mediaId: 'synthetic-coastline-001', caption: 'Field notes from the open learning lab.',
})
const relyingParty = 'https://social-demo.antifraud.services'
const purpose = 'synthetic-publication-manifest-signing'
const proof = Object.freeze({
  proofId: 'urn:proof:publication:one', requestId: 'urn:request:publication:one',
  operationId: 'urn:operation:publication:one',
  manifest: Object.freeze({
    id: 'urn:manifest:publication:one', version: '1', digestAlgorithm: 'sha3-384',
    digest: buildSocialPublicationManifestDigest({...content, relyingParty, purpose}),
  }),
  relyingParty, purpose, signerReference: 'urn:user:synthetic-social-demo',
  algorithm: ManagedSigningAlgorithm.MlDsa65,
  verificationMethod: 'did:key:synthetic#actor-signing',
  createdAt: '2026-10-18T12:00:01.000Z', signature: 'c3ludGhldGljLXNpZ25hdHVyZQ',
  status: ManagedSignatureProofStatus.Verified,
})
const actor = Object.freeze({
  tenantId: 'tenant:demo-social', organizationReference: 'organization:demo-social',
  employeeReference: 'service:demo-social', active: true,
  groupReferences: ['group:demo-social'], capabilities: ['social-publication:record'],
})

test('persists and reloads one proof-bound simulated publication receipt', async () => {
  const backend = new InMemoryGatewayDocumentBackend()
  const documents = new NamespacedGatewayDocumentStore(backend, 'antifraud_demo_')
  const gateway = new SocialPublicationDemoGateway({
    store: new GatewayDocumentSocialPublicationStore(documents),
    wait: async () => undefined,
    operationDelayMs: 6000,
    clock: () => '2026-10-18T12:00:07.000Z',
    transactionId: () => 'demo-memory-opaque',
  })

  const recorded = await gateway.record({actor, content, proof})
  assert.equal(recorded.status, 'demo-recorded')
  assert.equal(recorded.receipt.cryptographicProof, true)
  assert.equal(recorded.receipt.adapter, 'in-memory-fabric-demo')

  const restarted = new SocialPublicationDemoGateway({
    store: new GatewayDocumentSocialPublicationStore(documents),
  })
  assert.deepEqual(await restarted.read({actor, publicationId: proof.requestId}), recorded)
  await assert.rejects(gateway.record({actor, content, proof}), /already exists/i)
  await assert.rejects(
    restarted.read({actor: {...actor, organizationReference: 'organization:other'}, publicationId: proof.requestId}),
    /not authorized/i,
  )
})

test('rejects content changed after the managed-wallet ceremony', async () => {
  const documents = new NamespacedGatewayDocumentStore(
    new InMemoryGatewayDocumentBackend(), 'antifraud_demo_',
  )
  const gateway = new SocialPublicationDemoGateway({
    store: new GatewayDocumentSocialPublicationStore(documents),
    wait: async () => undefined,
  })
  await assert.rejects(
    gateway.record({actor, content: {...content, caption: 'Changed'}, proof}),
    /manifest digest/i,
  )
})
