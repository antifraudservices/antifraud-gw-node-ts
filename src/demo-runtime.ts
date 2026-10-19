import {
  EducationQualificationGateway,
  StaticIssuerDirectory,
  resolveGatewayNetworkProfile,
  type GatewayNetworkProfile,
  type WorkforceActor,
} from './index.js'
import {
  OrganizationControllerGateway,
} from './controller-administration.js'
import { IdentityAttestationCapability } from 'antifraud-data-utils-ts'
import { NodeManagedWallet } from 'antifraud-sdk-node-ts'
import {Firestore} from '@google-cloud/firestore'
import {
  ConfidentialArtifactStore,
  FirestoreGatewayDocumentBackend,
  InMemoryGatewayDocumentBackend,
  InMemoryGatewayObjectBackend,
  NamespacedGatewayDocumentStore,
  type GatewayDocumentBackend,
  resolveGatewayPersistenceProfile,
} from './demo-persistence.js'
import {
  GatewayDocumentAddressedReferenceIndex,
  GatewayDocumentConfidentialEvidenceVault,
  GatewayDocumentControllerAdministrationStore,
  GatewayDocumentIdentityEvidenceLedger,
  GatewayDocumentObjectBackend,
  GatewayDocumentQualificationLedger,
} from './durable-demo-adapters.js'
import {
  GatewayDocumentSocialPublicationStore,
  SocialPublicationDemoGateway,
} from './social-publication-demo.js'

type DemoTokenRole = 'controller' | 'professional' | 'personal' | 'social'
type DemoTokens = Readonly<Record<DemoTokenRole, string>>
type DemoEnvironment = Readonly<Record<string, string | undefined>>

export type GatewayDemoRuntime = Readonly<{
  profile: GatewayNetworkProfile
  gateway: EducationQualificationGateway
  controller: OrganizationControllerGateway
  artifacts: ConfidentialArtifactStore
  publications: SocialPublicationDemoGateway
  resolveActor(credential: string): Promise<WorkforceActor | undefined>
}>

const ACTORS: Readonly<Record<DemoTokenRole, WorkforceActor>> = Object.freeze({
  controller: Object.freeze({
    tenantId: 'tenant:demo-employer',
    organizationReference: 'organization:demo-employer',
    employeeReference: 'employee:demo-controller',
    assignmentReference: 'assignment:demo-controller',
    active: true,
    groupReferences: ['group:demo-controller-evidence'],
    capabilities: [
      'identity.evidence.record',
      'qualification-evidence:create',
      'controller.organization.read',
      'controller.structure.write',
      'controller.workforce.write',
      'qualification-inbox:list',
      'qualification-evidence:decide',
      'confidential-artifact:write',
      'confidential-artifact:read',
    ],
    groupAuthorization: Object.freeze({
      groupReference: 'group:demo-controller-evidence',
      authorizationReference: 'authorization:demo-controller-evidence',
      controllerReference: 'controller:demo-employer',
      status: 'active',
      capabilities: [IdentityAttestationCapability.RecordEvidence],
    }),
  }),
  professional: Object.freeze({
    tenantId: 'tenant:demo-issuer',
    organizationReference: 'organization:demo-issuer',
    employeeReference: 'employee:demo-professional',
    active: true,
    groupReferences: ['group:demo-qualification-reviewers'],
    capabilities: ['qualification-inbox:list', 'qualification-evidence:decide'],
  }),
  personal: Object.freeze({
    tenantId: 'tenant:demo-holder',
    organizationReference: 'organization:demo-holder',
    employeeReference: 'person:demo-holder',
    active: true,
    groupReferences: ['group:demo-personal'],
    capabilities: [],
  }),
  social: Object.freeze({
    tenantId: 'tenant:demo-social',
    organizationReference: 'organization:demo-social',
    employeeReference: 'service:demo-social',
    active: true,
    groupReferences: ['group:demo-social'],
    capabilities: ['social-publication:record'],
  }),
})

export function createGatewayDemoRuntime(
  environment: DemoEnvironment,
  options: Readonly<{
    wait?: (milliseconds: number) => Promise<void>
    documentBackend?: GatewayDocumentBackend
  }> = {},
): GatewayDemoRuntime {
  const profile = resolveGatewayNetworkProfile(environment as NodeJS.ProcessEnv)
  if (profile.networkKind !== 'demo' || profile.adapter !== 'memory') {
    throw new Error('The deployed Demo runtime requires the staging in-memory profile.')
  }
  const tokens = parseDemoTokens(environment.ANTIFRAUD_DEMO_BFF_TOKENS_JSON)
  const tokenRoles = new Map(Object.entries(tokens).map(([role, token]) => [token, role as DemoTokenRole]))
  const persistenceProfile = resolveGatewayPersistenceProfile(environment)
  const documentBackendName = environment.ANTIFRAUD_DOCUMENT_BACKEND ?? 'memory'
  const objectBackendName = environment.ANTIFRAUD_OBJECT_BACKEND ?? documentBackendName
  if (!['memory', 'firestore'].includes(documentBackendName)) {
    throw new Error(`Unsupported ANTIFRAUD_DOCUMENT_BACKEND: ${documentBackendName}`)
  }
  if (objectBackendName !== documentBackendName) {
    throw new Error('Demo documents and sealed objects must use the same durable backend.')
  }
  const walletSeed = environment.ANTIFRAUD_DEMO_WALLET_SEED?.trim()
  if (documentBackendName === 'firestore' && (!walletSeed || walletSeed.length < 32)) {
    throw new Error('A Demo managed-wallet seed with at least 32 characters is required for durable Firestore storage.')
  }
  const backend = options.documentBackend ?? (documentBackendName === 'firestore'
    ? new FirestoreGatewayDocumentBackend(new Firestore({
        ...(environment.GOOGLE_CLOUD_PROJECT ? {projectId: environment.GOOGLE_CLOUD_PROJECT} : {}),
      }))
    : new InMemoryGatewayDocumentBackend())
  const documents = new NamespacedGatewayDocumentStore(backend, persistenceProfile.collectionPrefix)
  const ledgerOptions = { operationDelayMs: profile.operationDelayMs, wait: options.wait }
  const gateway = new EducationQualificationGateway({
    ledger: new GatewayDocumentQualificationLedger(documents, ledgerOptions),
    identityLedger: new GatewayDocumentIdentityEvidenceLedger(documents, ledgerOptions),
    index: new GatewayDocumentAddressedReferenceIndex(documents),
    vault: new GatewayDocumentConfidentialEvidenceVault(documents),
    directory: new StaticIssuerDirectory([
      {
        legalIdentifier: 'DEMO-ISSUER',
        jurisdiction: 'CA',
        organizationReference: ACTORS.professional.organizationReference,
        tenantId: ACTORS.professional.tenantId,
        confirmationService: 'https://demo.invalid/qualification-confirmation',
      },
      {
        legalIdentifier: 'DEMO-EMPLOYER',
        jurisdiction: 'CA',
        organizationReference: ACTORS.controller.organizationReference,
        tenantId: ACTORS.controller.tenantId,
        confirmationService: 'https://demo.invalid/employer-confirmation',
      },
    ]),
    sourceHostReference: 'host:antifraud-demo',
  })
  const controller = new OrganizationControllerGateway({
    store: new GatewayDocumentControllerAdministrationStore(documents),
  })
  const managedWallet = new NodeManagedWallet()
  const artifacts = new ConfidentialArtifactStore({
    objects: documentBackendName === 'memory' && !options.documentBackend
      ? new InMemoryGatewayObjectBackend()
      : new GatewayDocumentObjectBackend(documents),
    objectPrefix: `${persistenceProfile.collectionPrefix}attachments/`,
    wallet: {
      async protectArtifact(owner, bytes) {
        await managedWallet.provision(owner, walletSeed ? {seedMaterial: walletSeed} : {})
        return managedWallet.protectArtifactBytes(owner, bytes)
      },
      async unprotectArtifact(owner, sealed) {
        await managedWallet.provision(owner, walletSeed ? {seedMaterial: walletSeed} : {})
        return managedWallet.unprotectArtifactBytes(owner, sealed)
      },
    },
  })
  const publications = new SocialPublicationDemoGateway({
    store: new GatewayDocumentSocialPublicationStore(documents),
    operationDelayMs: profile.operationDelayMs,
    ...(options.wait ? {wait: options.wait} : {}),
  })
  return Object.freeze({
    profile,
    gateway,
    controller,
    artifacts,
    publications,
    async resolveActor(credential: string) {
      const role = tokenRoles.get(credential)
      return role ? ACTORS[role] : undefined
    },
  })
}

function parseDemoTokens(serialized: string | undefined): DemoTokens {
  if (!serialized?.trim()) throw new Error('ANTIFRAUD_DEMO_BFF_TOKENS_JSON BFF token configuration is required.')
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new Error('ANTIFRAUD_DEMO_BFF_TOKENS_JSON must be valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('ANTIFRAUD_DEMO_BFF_TOKENS_JSON must contain the four Demo roles.')
  }
  const value = parsed as Record<string, unknown>
  const roles: DemoTokenRole[] = ['controller', 'professional', 'personal', 'social']
  const entries = roles.map(role => {
    const token = value[role]
    if (typeof token !== 'string' || token.trim().length < 16) {
      throw new Error(`The ${role} Demo BFF token must contain at least 16 characters.`)
    }
    return [role, token.trim()] as const
  })
  if (new Set(entries.map(([, token]) => token)).size !== entries.length) {
    throw new Error('Demo BFF tokens must be distinct.')
  }
  return Object.freeze(Object.fromEntries(entries) as Record<DemoTokenRole, string>)
}
