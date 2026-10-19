// Flow contract: the deployable Demo process exposes the real Gateway HTTP handler on a server-owned address, proves authenticated BFF access and never treats its virtual receipt as Fabric evidence.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'

import {
  ManagedSigningAlgorithm,
  ManagedSignatureProofStatus,
  buildSocialPublicationManifestDigest,
} from 'antifraud-data-utils-ts'
import { createGatewayDemoServer } from '../dist/demo-server.js'

const controllerToken = 'controller-secret-token'
const socialToken = 'social-secret-token'
const environment = {
  ANTIFRAUD_DEPLOYMENT_STAGE: 'staging',
  ANTIFRAUD_DEMO_MODE: 'true',
  ANTIFRAUD_NETWORK_KIND: 'demo',
  ANTIFRAUD_DEMO_BFF_TOKENS_JSON: JSON.stringify({
    controller: controllerToken,
    professional: 'professional-secret-token',
    personal: 'personal-secret-token',
    social: socialToken,
  }),
}

test('serves health and authenticated controller readback through the deployable HTTP boundary', async t => {
  const server = createGatewayDemoServer(environment, { wait: async () => undefined })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const baseUrl = `http://127.0.0.1:${address.port}`

  const health = await fetch(`${baseUrl}/healthz`)
  assert.deepEqual(await health.json(), { status: 'ok' })
  const cloudHealth = await fetch(`${baseUrl}/health`)
  assert.equal(cloudHealth.status, 200)
  assert.deepEqual(await cloudHealth.json(), { status: 'ok' })

  const unauthorized = await fetch(`${baseUrl}/v1/controller/workspace`)
  assert.equal(unauthorized.status, 401)

  const workspace = await fetch(`${baseUrl}/v1/controller/workspace`, {
    headers: { authorization: `Bearer ${controllerToken}` },
  })
  assert.equal(workspace.status, 200)
  assert.equal((await workspace.json()).organization.reference, 'organization:demo-employer')
})

test('records and authoritatively reloads a proof-bound social Demo publication', async t => {
  const server = createGatewayDemoServer(environment, { wait: async () => undefined })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const baseUrl = `http://127.0.0.1:${address.port}`
  const content = {mediaId: 'synthetic-coastline-001', caption: 'Field notes from the open learning lab.'}
  const relyingParty = 'https://social-demo.antifraud.services'
  const purpose = 'synthetic-publication-manifest-signing'
  const proof = {
    proofId: 'urn:proof:publication:http', requestId: 'urn:request:publication:http',
    operationId: 'urn:operation:publication:http',
    manifest: {
      id: 'urn:manifest:publication:http', version: '1', digestAlgorithm: 'sha3-384',
      digest: buildSocialPublicationManifestDigest({...content, relyingParty, purpose}),
    },
    relyingParty, purpose, signerReference: 'urn:user:synthetic-social-demo',
    algorithm: ManagedSigningAlgorithm.MlDsa65,
    verificationMethod: 'did:key:synthetic#actor-signing',
    createdAt: new Date(Date.now() - 1000).toISOString(),
    signature: 'c3ludGhldGljLXNpZ25hdHVyZQ', status: ManagedSignatureProofStatus.Verified,
  }
  const recordedResponse = await fetch(`${baseUrl}/v1/social/publications`, {
    method: 'POST',
    headers: {authorization: `Bearer ${socialToken}`, 'content-type': 'application/json'},
    body: JSON.stringify({content, proof}),
  })
  assert.equal(recordedResponse.status, 201)
  const recorded = await recordedResponse.json()
  assert.equal(recorded.receipt.cryptographicProof, true)
  assert.equal(recorded.receipt.adapter, 'in-memory-fabric-demo')

  const reloadedResponse = await fetch(
    `${baseUrl}/v1/social/publications/${encodeURIComponent(proof.requestId)}`,
    {headers: {authorization: `Bearer ${socialToken}`}},
  )
  assert.equal(reloadedResponse.status, 200)
  assert.deepEqual(await reloadedResponse.json(), recorded)
})
