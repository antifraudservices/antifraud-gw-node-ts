// Flow contract: deployed Demo state survives a gateway runtime restart inside its governed Firestore-style namespace; ledger anchors, addressed references, controller state, sealed attachments and vault ciphertext never cross environment prefixes.
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ConfidentialArtifactStore,
  GatewayDocumentAddressedReferenceIndex,
  GatewayDocumentConfidentialEvidenceVault,
  GatewayDocumentControllerAdministrationStore,
  GatewayDocumentIdentityEvidenceLedger,
  GatewayDocumentObjectBackend,
  GatewayDocumentQualificationLedger,
  InMemoryGatewayDocumentBackend,
  NamespacedGatewayDocumentStore,
  OrganizationControllerGateway,
} from '../dist/index.js'

const actor = Object.freeze({
  tenantId: 'tenant:demo',
  organizationReference: 'organization:demo',
  employeeReference: 'employee:controller',
  active: true,
  groupReferences: ['group:controller'],
  capabilities: ['controller.organization.read', 'controller.structure.write'],
})

test('reloads virtual-ledger anchors, routing, vault and controller state after adapter reconstruction', async () => {
  const backend = new InMemoryGatewayDocumentBackend()
  const documents = new NamespacedGatewayDocumentStore(backend, 'antifraud_demo_')
  const qualification = new GatewayDocumentQualificationLedger(documents)
  const identity = new GatewayDocumentIdentityEvidenceLedger(documents)
  const index = new GatewayDocumentAddressedReferenceIndex(documents)
  const wallet = {
    async protectArtifact(_owner, bytes) { return `sealed:${Buffer.from(bytes).toString('base64url')}` },
    async unprotectArtifact(_owner, sealed) { return Buffer.from(sealed.slice(7), 'base64url') },
  }
  const vault = new GatewayDocumentConfidentialEvidenceVault(documents, wallet, 'host:demo')
  const controller = new OrganizationControllerGateway({
    store: new GatewayDocumentControllerAdministrationStore(documents),
  })
  const qualificationAnchor = {
    evidenceId: 'evidence:one', subjectReference: 'subject:one',
    employerOrganizationReference: 'organization:demo',
    issuerOrganizationReference: 'organization:issuer',
    qualificationReference: 'qualification:one', documentCid: 'zOpaque',
    status: 'pending-issuer-confirmation', employerProofReference: 'proof:employer:one',
    recordedAt: '2026-10-18T00:00:00.000Z', updatedAt: '2026-10-18T00:00:00.000Z',
  }
  const identityAnchor = {
    evidenceId: 'identity:one', subjectReference: 'subject:one',
    employerOrganizationReference: 'organization:demo', employeeReference: 'employee:controller',
    groupAuthorizationReference: 'authorization:one', targetKinds: ['predicate'],
    status: 'recorded', employerProofReference: 'proof:employer:identity',
    recordedAt: '2026-10-18T00:00:00.000Z',
  }
  const addressed = {
    destinationOrganizationReference: 'organization:issuer', evidenceLocator: 'evidence:one',
    sourceHostReference: 'host:demo', channelFamily: 'qualification-education',
    lifecycleStatus: 'pending-issuer-confirmation', deliveryState: 'queued',
    attemptCount: 0, queuedAt: '2026-10-18T00:00:00.000Z',
  }

  await qualification.create('qualification-education-na', qualificationAnchor)
  await identity.create('identity-global', identityAnchor)
  await index.put(addressed, {channel: 'qualification-education-na'})
  const confidentialClaims = {qualification: {classification: {system: 'urn:example:qualification', code: 'SECRET-CODE'}}}
  await vault.put('evidence:one', confidentialClaims)
  await controller.createDepartment({actor, name: 'Evidence review'})

  const restartedDocuments = new NamespacedGatewayDocumentStore(backend, 'antifraud_demo_')
  assert.deepEqual(
    await new GatewayDocumentQualificationLedger(restartedDocuments)
      .read('qualification-education-na', 'evidence:one'),
    qualificationAnchor,
  )
  assert.deepEqual(
    await new GatewayDocumentIdentityEvidenceLedger(restartedDocuments)
      .read('identity-global', 'identity:one'),
    identityAnchor,
  )
  assert.deepEqual(
    await new GatewayDocumentAddressedReferenceIndex(restartedDocuments)
      .listForDestination('organization:issuer'),
    [addressed],
  )
  const evidenceKey = Buffer.from('evidence:one').toString('base64url')
  const storedEvidence = await restartedDocuments.read('confidential_evidence', evidenceKey)
  assert.equal(JSON.stringify(storedEvidence).includes('SECRET-CODE'), false)
  const restartedVault = new GatewayDocumentConfidentialEvidenceVault(restartedDocuments, wallet, 'host:demo')
  assert.equal(await restartedVault.has('evidence:one'), true)
  assert.deepEqual(await restartedVault.get('evidence:one'), confidentialClaims)
  const restartedController = new OrganizationControllerGateway({
    store: new GatewayDocumentControllerAdministrationStore(restartedDocuments),
  })
  assert.equal((await restartedController.readWorkspace({actor})).departments[0]?.name, 'Evidence review')
})

test('reloads only wallet-sealed attachment content through the durable object adapter', async () => {
  const backend = new InMemoryGatewayDocumentBackend()
  const documents = new NamespacedGatewayDocumentStore(backend, 'antifraud_demo_')
  const wallet = {
    async protectArtifact(_owner, bytes) { return `sealed:${Buffer.from(bytes).toString('base64url')}` },
    async unprotectArtifact(_owner, sealed) { return Buffer.from(sealed.slice(7), 'base64url') },
  }
  const first = new ConfidentialArtifactStore({
    objects: new GatewayDocumentObjectBackend(documents), wallet, objectPrefix: 'attachments/',
  })
  const bytes = Buffer.from('%PDF-1.4\nsynthetic\n%%EOF')
  await first.put({
    artifactId: 'artifact:one', organizationReference: 'organization:demo',
    mediaType: 'application/pdf', fileName: 'synthetic.pdf', bytes,
  })

  const restarted = new ConfidentialArtifactStore({
    objects: new GatewayDocumentObjectBackend(documents), wallet, objectPrefix: 'attachments/',
  })
  assert.deepEqual(
    await restarted.get('artifact:one', 'organization:demo'),
    {mediaType: 'application/pdf', fileName: 'synthetic.pdf', bytes},
  )
})
