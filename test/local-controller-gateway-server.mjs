// Flow fixture: expose the real local HTTP handler with one synthetic server-resolved workforce actor so the neutral controller Playwright journey can prove UI -> BFF -> high-level SDK -> gateway writes. The browser never receives the bearer or authority tuple. This fixture is in-memory only and is not Fabric, Test Network or production evidence.
import { createServer } from 'node:http'
import {
  EducationQualificationGateway,
  InMemoryAddressedReferenceIndex,
  InMemoryIdentityEvidenceLedger,
  InMemoryQualificationLedger,
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
  capabilities: ['identity.evidence.record', 'qualification-evidence:create'],
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

const server = createServer(createAntifraudGatewayHttpHandler({
  gateway,
  resolveActor: async credential => credential === token ? actor : undefined,
}))
const port = Number.parseInt(process.env.PORT ?? '3700', 10)
server.listen(port, '127.0.0.1', () => process.stdout.write(`local antifraud gateway listening on ${port}\n`))
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}
