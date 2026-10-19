// Flow contract: a deployed Demo gateway accepts only server-held BFF credentials, derives fixed actors and keeps the virtual ledger profile explicit; browser input cannot select authority, Fabric or Production.
import assert from 'node:assert/strict'
import test from 'node:test'

import { createGatewayDemoRuntime } from '../dist/demo-runtime.js'
import {InMemoryGatewayDocumentBackend} from '../dist/demo-persistence.js'

const tokens = Object.freeze({
  controller: 'controller-secret-token',
  professional: 'professional-secret-token',
  personal: 'personal-secret-token',
  social: 'social-secret-token',
})

function environment(overrides = {}) {
  return {
    ANTIFRAUD_DEPLOYMENT_STAGE: 'staging',
    ANTIFRAUD_DEMO_MODE: 'true',
    ANTIFRAUD_NETWORK_KIND: 'demo',
    ANTIFRAUD_DEMO_BFF_TOKENS_JSON: JSON.stringify(tokens),
    ...overrides,
  }
}

test('creates a staging-only virtual-ledger runtime with exact BFF actor bindings', async () => {
  const runtime = createGatewayDemoRuntime(environment(), { wait: async () => undefined })

  assert.deepEqual(runtime.profile, {
    networkKind: 'demo',
    adapter: 'memory',
    operationDelayMs: 6000,
  })
  assert.equal((await runtime.resolveActor(tokens.controller))?.organizationReference, 'organization:demo-employer')
  assert.equal((await runtime.resolveActor(tokens.professional))?.organizationReference, 'organization:demo-issuer')
  assert.equal((await runtime.resolveActor(tokens.personal))?.employeeReference, 'person:demo-holder')
  assert.equal((await runtime.resolveActor(tokens.social))?.employeeReference, 'service:demo-social')
  assert.equal(await runtime.resolveActor('unknown-token'), undefined)
})

test('fails closed in Production and for missing, duplicated or malformed BFF tokens', () => {
  assert.throws(
    () => createGatewayDemoRuntime(environment({ ANTIFRAUD_DEPLOYMENT_STAGE: 'production' })),
    /local, beta or staging only/i,
  )
  assert.throws(
    () => createGatewayDemoRuntime(environment({ ANTIFRAUD_DEMO_BFF_TOKENS_JSON: undefined })),
    /BFF token configuration is required/i,
  )
  assert.throws(
    () => createGatewayDemoRuntime(environment({
      ANTIFRAUD_DEMO_BFF_TOKENS_JSON: JSON.stringify({ ...tokens, social: tokens.personal }),
    })),
    /must be distinct/i,
  )
  assert.throws(
    () => createGatewayDemoRuntime(environment({ ANTIFRAUD_DEMO_BFF_TOKENS_JSON: '{' })),
    /must be valid JSON/i,
  )
  assert.throws(
    () => createGatewayDemoRuntime(environment({
      ANTIFRAUD_DOCUMENT_BACKEND: 'firestore',
      ANTIFRAUD_OBJECT_BACKEND: 'firestore',
    })),
    /wallet seed/i,
  )
  assert.throws(
    () => createGatewayDemoRuntime(environment({
      ANTIFRAUD_DOCUMENT_BACKEND: 'firestore',
      ANTIFRAUD_OBJECT_BACKEND: 'memory',
      ANTIFRAUD_DEMO_WALLET_SEED: 'seed-material-with-at-least-thirty-two-characters',
    })),
    /same durable backend/i,
  )
})

test('reconstructs the seeded managed wallet and durable Demo state after a process restart', async () => {
  const documentBackend = new InMemoryGatewayDocumentBackend()
  const durableEnvironment = environment({
    ANTIFRAUD_DOCUMENT_BACKEND: 'firestore',
    ANTIFRAUD_OBJECT_BACKEND: 'firestore',
    ANTIFRAUD_DEMO_WALLET_SEED: 'seed-material-with-at-least-thirty-two-characters',
  })
  const first = createGatewayDemoRuntime(durableEnvironment, {
    documentBackend, wait: async () => undefined,
  })
  const bytes = Buffer.from('%PDF-1.4\nrestart proof\n%%EOF')
  await first.artifacts.put({
    artifactId: 'artifact:restart',
    organizationReference: 'organization:demo-employer',
    mediaType: 'application/pdf',
    fileName: 'restart.pdf',
    bytes,
  })

  const restarted = createGatewayDemoRuntime(durableEnvironment, {
    documentBackend, wait: async () => undefined,
  })
  const restored = await restarted.artifacts.get('artifact:restart', 'organization:demo-employer')
  assert.equal(restored.mediaType, 'application/pdf')
  assert.equal(restored.fileName, 'restart.pdf')
  assert.deepEqual(Buffer.from(restored.bytes), bytes)
})
