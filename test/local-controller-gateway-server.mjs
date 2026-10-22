// Flow fixture: expose the real local HTTP handler with synthetic server-resolved actors so Playwright can prove UI -> BFF -> high-level SDK -> Gateway, including JWE-sealed attachments; test uses memory ledgers while local-network uses the real local Fabric adapter. Neither is Test Network or production evidence.
import { createServer } from 'node:http'
import { SyntheticConfidentialDocumentFixture } from 'antifraud-data-utils-ts'
import { NodeManagedWallet } from 'antifraud-sdk-node-ts'
import {
  ConfidentialArtifactStore,
  EducationQualificationGateway,
  FabricIdentityEvidenceLedger,
  FabricQualificationLedger,
  InMemoryAddressedReferenceIndex,
  InMemoryControllerAdministrationStore,
  InMemoryGatewayObjectBackend,
  InMemoryIdentityEvidenceLedger,
  InMemoryQualificationLedger,
  OrganizationControllerGateway,
  StaticIssuerDirectory,
  connectFabricGateway,
  createAntifraudGatewayHttpHandler,
  resolveGatewayNetworkProfile,
} from '../dist/index.js'

const networkProfile = resolveGatewayNetworkProfile(process.env)
const ledgerOptions = { operationDelayMs: networkProfile.operationDelayMs }
const fabricConnections = []
let qualificationLedger = new InMemoryQualificationLedger(ledgerOptions)
let identityEvidenceLedger = new InMemoryIdentityEvidenceLedger(ledgerOptions)
if (networkProfile.adapter === 'fabric') {
  const common = {
    peerEndpoint: requiredEnvironment('ANTIFRAUD_FABRIC_PEER_ENDPOINT'),
    peerHostAlias: requiredEnvironment('ANTIFRAUD_FABRIC_PEER_HOST_ALIAS'),
    tlsRootCertificatePath: requiredEnvironment('ANTIFRAUD_FABRIC_TLS_ROOT_CERT'),
    mspId: requiredEnvironment('ANTIFRAUD_FABRIC_MSP_ID'),
    certificatePath: requiredEnvironment('ANTIFRAUD_FABRIC_CERTIFICATE'),
    privateKeyPath: requiredEnvironment('ANTIFRAUD_FABRIC_PRIVATE_KEY'),
  }
  const qualificationConnection = await connectFabricGateway({...common, chaincodeName: 'qualification-evidence-sc'})
  const identityConnection = await connectFabricGateway({...common, chaincodeName: 'identity-evidence-sc'})
  fabricConnections.push(qualificationConnection, identityConnection)
  qualificationLedger = new FabricQualificationLedger(qualificationConnection.resolveContract)
  identityEvidenceLedger = new FabricIdentityEvidenceLedger(identityConnection.resolveContract)
}

const token = 'local-controller-bff-token'
const professionalToken = 'local-professional-bff-token'
const actor = Object.freeze({
  tenantId: 'tenant:local-employer',
  organizationReference: 'organization:local-employer',
  employeeReference: 'employee:local-controller',
  assignmentReference: 'assignment:local-controller',
  active: true,
  groupReferences: ['group:local-controller-evidence'],
  capabilities: [
    'identity.evidence.record', 'qualification-evidence:create',
    'controller.organization.read', 'controller.structure.write', 'controller.workforce.write',
    'controller.catalog.publish',
    'qualification-inbox:list', 'qualification-evidence:decide',
    'confidential-artifact:write', 'confidential-artifact:read',
  ],
  groupAuthorization: {
    groupReference: 'group:local-controller-evidence',
    authorizationReference: 'authorization:local-controller-evidence',
    controllerReference: 'controller:local-employer',
    status: 'active',
    capabilities: ['identity.evidence.record'],
  },
})
const professionalActor = Object.freeze({
  tenantId: 'tenant:example-university',
  organizationReference: 'organization:example-university',
  employeeReference: 'employee:example-university-reviewer',
  assignmentReference: 'assignment:example-university-reviewer',
  active: true,
  groupReferences: ['group:example-university-reviewers'],
  capabilities: ['qualification-inbox:list', 'qualification-evidence:decide'],
})

const addressedIndex = new InMemoryAddressedReferenceIndex()
const gateway = new EducationQualificationGateway({
  ledger: qualificationLedger,
  identityLedger: identityEvidenceLedger,
  index: addressedIndex,
  directory: new StaticIssuerDirectory([{
    legalIdentifier: 'EXAMPLE-UNIVERSITY', jurisdiction: 'ES',
    organizationReference: 'organization:example-university',
    tenantId: 'tenant:example-university',
    confirmationService: 'https://example.invalid/qualification-confirmation',
  }, {
    legalIdentifier: 'LOCAL-EMPLOYER', jurisdiction: 'ES',
    organizationReference: 'organization:local-employer', tenantId: 'tenant:local-employer',
    confirmationService: 'https://local.invalid/qualification-confirmation',
  }]),
  sourceHostReference: 'host:local-controller-e2e',
})

const seededEvidenceId = 'evidence:controller-inbox:001'
const seededAnchor = await qualificationLedger.read('qualification-education-eu', seededEvidenceId)
if (seededAnchor) {
  await addressedIndex.put({
    destinationOrganizationReference: seededAnchor.issuerOrganizationReference,
    evidenceLocator: seededEvidenceId,
    sourceHostReference: 'host:local-controller-e2e',
    channelFamily: 'qualification-education',
    lifecycleStatus: seededAnchor.status,
    deliveryState: seededAnchor.status === 'pending-issuer-confirmation' ? 'queued' : 'delivered',
    attemptCount: seededAnchor.status === 'pending-issuer-confirmation' ? 0 : 1,
    queuedAt: seededAnchor.recordedAt,
    ...(seededAnchor.status === 'pending-issuer-confirmation' ? {} : {receiptReference: `receipt:${seededEvidenceId}`}),
  }, {channel: 'qualification-education-eu'})
} else {
  await gateway.recordEmployerEvidence({
    actor: {
      tenantId: 'tenant:source', organizationReference: 'organization:source', employeeReference: 'employee:source-reviewer',
      active: true, groupReferences: ['group:source-reviewers'], capabilities: ['qualification-evidence:create'],
    },
    evidenceId: seededEvidenceId, subjectReference: 'person:opaque:inbox',
    issuer: { legalIdentifier: 'LOCAL-EMPLOYER', jurisdiction: 'ES' },
    qualificationReference: 'qualification:controller-inbox:001',
    documentCid: SyntheticConfidentialDocumentFixture.attachment.contentId,
    encryptedClaims: 'jwe.local.inbox.fixture',
  })
}

const controller = new OrganizationControllerGateway({
  store: new InMemoryControllerAdministrationStore(),
  catalog: {
    jurisdiction: 'CA-BC',
    sector: 'education',
    accessUrl: 'https://catalog.example.invalid/organization/services',
  },
})
const managedWallet = new NodeManagedWallet()
const artifacts = new ConfidentialArtifactStore({
  objects: new InMemoryGatewayObjectBackend(),
  objectPrefix: `${networkProfile.networkKind === 'local-network' ? 'antifraud_test_network_' : 'antifraud_demo_'}attachments/`,
  wallet: {
    async protectArtifact(owner, bytes) {
      await managedWallet.provision(owner)
      return managedWallet.protectArtifactBytes(owner, bytes)
    },
    async unprotectArtifact(owner, sealed) {
      await managedWallet.provision(owner)
      return managedWallet.unprotectArtifactBytes(owner, sealed)
    },
  },
})
const operations = await controller.createDepartment({ actor, name: 'Operations' })
const fieldServices = await controller.createDepartment({ actor, name: 'Field Services' })
const clientManagers = await controller.createGroup({ actor, name: 'Client group managers', capabilities: [] })
const evidenceAssistants = await controller.createGroup({
  actor,
  name: 'Identity evidence assistants',
  capabilities: ['identity.subject.create', 'identity.subject.update', 'identity.evidence.record', 'identity.claim.verify', 'identity.subject.attest', 'identity.relationship.attest'],
})
const serviceInvitation = await controller.createInvitation({
  actor, email: 'service.manager@example.invalid', role: 'Organization manager',
  departmentReferences: [operations.department.reference], groupReferences: [evidenceAssistants.reference],
})
await controller.acceptInvitation({ actor, invitationReference: serviceInvitation.invitation.reference, deviceReference: 'device:service-manager' })
const memberInvitation = await controller.createInvitation({
  actor, email: 'member.manager@example.invalid', role: 'Evidence reviewer',
  departmentReferences: [], groupReferences: [clientManagers.reference],
})
const member = await controller.acceptInvitation({ actor, invitationReference: memberInvitation.invitation.reference, deviceReference: 'device:member-manager' })
await controller.setEmployeeStatus({ actor, employeeReference: member.employee.reference, status: 'inactive' })
await controller.createInvitation({ actor, email: 'new.member@example.invalid', role: 'Audit viewer', departmentReferences: [fieldServices.department.reference], groupReferences: [] })

const server = createServer(createAntifraudGatewayHttpHandler({
  gateway,
  controller,
  artifacts,
  resolveActor: async credential => {
    if (credential === token) return actor
    if (credential === professionalToken) return professionalActor
    return undefined
  },
}))
const port = Number.parseInt(process.env.PORT ?? '3700', 10)
server.listen(port, '127.0.0.1', () => process.stdout.write(
  `antifraud ${networkProfile.networkKind} gateway listening on ${port}; ledger delay ${networkProfile.operationDelayMs}ms\n`,
))
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => {
    for (const connection of fabricConnections) connection.close()
    process.exit(0)
  }))
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for the real Fabric runtime.`)
  return value
}
