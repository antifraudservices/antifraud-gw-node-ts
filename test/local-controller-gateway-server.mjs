// Flow fixture: expose the real local HTTP handler with one synthetic server-resolved workforce actor so the neutral controller Playwright journey can prove UI -> BFF -> high-level SDK -> gateway writes. The browser never receives the bearer or authority tuple. This fixture is in-memory only and is not Fabric, Test Network or production evidence.
import { createServer } from 'node:http'
import {
  EducationQualificationGateway,
  InMemoryAddressedReferenceIndex,
  InMemoryControllerAdministrationStore,
  InMemoryIdentityEvidenceLedger,
  InMemoryQualificationLedger,
  OrganizationControllerGateway,
  StaticIssuerDirectory,
  createAntifraudGatewayHttpHandler,
} from '../dist/index.js'

const token = 'local-controller-bff-token'
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
  ],
  groupAuthorization: {
    groupReference: 'group:local-controller-evidence',
    authorizationReference: 'authorization:local-controller-evidence',
    controllerReference: 'controller:local-employer',
    status: 'active',
    capabilities: ['identity.evidence.record'],
  },
})

const gateway = new EducationQualificationGateway({
  ledger: new InMemoryQualificationLedger(),
  identityLedger: new InMemoryIdentityEvidenceLedger(),
  index: new InMemoryAddressedReferenceIndex(),
  directory: new StaticIssuerDirectory([{
    legalIdentifier: 'EXAMPLE-UNIVERSITY', jurisdiction: 'ES',
    organizationReference: 'organization:example-university',
    tenantId: 'tenant:example-university',
    confirmationService: 'https://example.invalid/qualification-confirmation',
  }]),
  sourceHostReference: 'host:local-controller-e2e',
})

const controller = new OrganizationControllerGateway({ store: new InMemoryControllerAdministrationStore() })
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
  resolveActor: async credential => credential === token ? actor : undefined,
}))
const port = Number.parseInt(process.env.PORT ?? '3700', 10)
server.listen(port, '127.0.0.1', () => process.stdout.write(`local antifraud gateway listening on ${port}\n`))
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
