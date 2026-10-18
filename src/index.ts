import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http'
import type { OrganizationControllerGateway } from './controller-administration.js'
import {
  IdentityAttestationCapability,
  defineAuthorizedWorkforceIdentityEvidenceStatement,
  type IdentityAttestationCapabilityValue,
  type IdentityEvidenceInput,
  type IdentityEvidenceTarget,
} from 'antifraud-data-utils-ts'
export * from './controller-administration.js'

export type EvidenceStatus =
  | 'pending-issuer-confirmation'
  | 'awaiting-issuer-onboarding'
  | 'confirmed'
  | 'rejected'
  | 'revoked'

export type WorkforceActor = Readonly<{
  tenantId: string
  organizationReference: string
  employeeReference: string
  active: boolean
  groupReferences: readonly string[]
  capabilities: readonly string[]
  assignmentReference?: string
  groupAuthorization?: Readonly<{
    groupReference: string
    authorizationReference: string
    controllerReference: string
    status: 'active' | 'inactive'
    capabilities: readonly IdentityAttestationCapabilityValue[]
  }>
}>

export type IdentityEvidenceAnchor = Readonly<{
  evidenceId: string
  subjectReference: string
  employerOrganizationReference: string
  employeeReference: string
  groupAuthorizationReference: string
  targetKinds: readonly IdentityEvidenceTarget['kind'][]
  status: 'recorded'
  employerProofReference: string
  recordedAt: string
}>

export type ResolvedIssuer = Readonly<{
  organizationReference: string
  tenantId?: string
  confirmationService?: string
}>

export type QualificationAnchor = Readonly<{
  evidenceId: string
  subjectReference: string
  employerOrganizationReference: string
  issuerOrganizationReference: string
  qualificationReference: string
  documentCid: string
  status: EvidenceStatus
  employerProofReference: string
  issuerProofReference?: string
  recordedAt: string
  updatedAt: string
}>

export type AddressedReference = Readonly<{
  destinationOrganizationReference: string
  evidenceLocator: string
  sourceHostReference: string
  channelFamily: 'qualification-education'
  lifecycleStatus: EvidenceStatus
  deliveryState: 'queued' | 'awaiting-onboarding' | 'delivered'
  attemptCount: number
  queuedAt: string
  receiptReference?: string
}>

type IssuerDirectoryEntry = Readonly<{
  legalIdentifier: string
  jurisdiction: string
  organizationReference: string
  tenantId?: string
  confirmationService?: string
}>

export interface IssuerDirectory {
  resolve(input: { legalIdentifier: string; jurisdiction: string }): Promise<ResolvedIssuer | undefined>
}

export interface QualificationLedger {
  create(channel: string, anchor: QualificationAnchor): Promise<{ transactionId: string; anchor: QualificationAnchor }>
  update(channel: string, evidenceId: string, update: Pick<QualificationAnchor, 'status' | 'updatedAt' | 'issuerProofReference'>): Promise<{ transactionId: string; anchor: QualificationAnchor }>
  read(channel: string, evidenceId: string): Promise<QualificationAnchor | undefined>
}

export interface IdentityEvidenceLedger {
  create(channel: 'identity-global', anchor: IdentityEvidenceAnchor): Promise<{ transactionId: string; anchor: IdentityEvidenceAnchor }>
  read(channel: 'identity-global', evidenceId: string): Promise<IdentityEvidenceAnchor | undefined>
}

export interface AddressedReferenceIndex {
  put(reference: AddressedReference, routing: { channel: string }): Promise<void>
  listForDestination(destinationOrganizationReference: string): Promise<readonly AddressedReference[]>
  findByEvidenceLocator(evidenceLocator: string): Promise<AddressedReference | undefined>
  routingFor(evidenceLocator: string): Promise<{ channel: string } | undefined>
  update(reference: AddressedReference): Promise<void>
}

export interface ConfidentialEvidenceVault {
  put(evidenceId: string, encryptedClaims: string): Promise<void>
  has(evidenceId: string): Promise<boolean>
}

export class StaticIssuerDirectory implements IssuerDirectory {
  readonly #entries: readonly IssuerDirectoryEntry[]

  constructor(entries: readonly IssuerDirectoryEntry[]) {
    this.#entries = entries.map(entry => ({
      ...entry,
      legalIdentifier: normalize(entry.legalIdentifier),
      jurisdiction: normalizeJurisdiction(entry.jurisdiction),
    }))
  }

  async resolve(input: { legalIdentifier: string; jurisdiction: string }): Promise<ResolvedIssuer | undefined> {
    const legalIdentifier = normalize(input.legalIdentifier)
    const jurisdiction = normalizeJurisdiction(input.jurisdiction)
    const entry = this.#entries.find(candidate =>
      candidate.legalIdentifier === legalIdentifier && candidate.jurisdiction === jurisdiction)
    if (!entry) return undefined
    return {
      organizationReference: entry.organizationReference,
      ...(entry.tenantId ? { tenantId: entry.tenantId } : {}),
      ...(entry.confirmationService ? { confirmationService: entry.confirmationService } : {}),
    }
  }
}

export class InMemoryQualificationLedger implements QualificationLedger {
  readonly #records = new Map<string, QualificationAnchor>()
  #sequence = 0

  async create(channel: string, anchor: QualificationAnchor): Promise<{ transactionId: string; anchor: QualificationAnchor }> {
    const key = ledgerKey(channel, anchor.evidenceId)
    if (this.#records.has(key)) throw new Error('Evidence already exists on the derived channel.')
    this.#records.set(key, structuredClone(anchor))
    return { transactionId: this.#nextTransactionId(), anchor: structuredClone(anchor) }
  }

  async update(channel: string, evidenceId: string, update: Pick<QualificationAnchor, 'status' | 'updatedAt' | 'issuerProofReference'>): Promise<{ transactionId: string; anchor: QualificationAnchor }> {
    const key = ledgerKey(channel, evidenceId)
    const current = this.#records.get(key)
    if (!current) throw new Error('Evidence was not found on the derived channel.')
    const anchor = { ...current, ...update }
    this.#records.set(key, anchor)
    return { transactionId: this.#nextTransactionId(), anchor: structuredClone(anchor) }
  }

  async read(channel: string, evidenceId: string): Promise<QualificationAnchor | undefined> {
    const anchor = this.#records.get(ledgerKey(channel, evidenceId))
    return anchor ? structuredClone(anchor) : undefined
  }

  #nextTransactionId(): string {
    this.#sequence += 1
    return `tx:${this.#sequence.toString(16).padStart(16, '0')}`
  }
}

export class InMemoryIdentityEvidenceLedger implements IdentityEvidenceLedger {
  readonly #records = new Map<string, IdentityEvidenceAnchor>()
  #sequence = 0

  async create(channel: 'identity-global', anchor: IdentityEvidenceAnchor): Promise<{ transactionId: string; anchor: IdentityEvidenceAnchor }> {
    const key = ledgerKey(channel, anchor.evidenceId)
    if (this.#records.has(key)) throw new Error('Identity evidence already exists.')
    this.#records.set(key, structuredClone(anchor))
    this.#sequence += 1
    return {
      transactionId: `tx:identity:${this.#sequence.toString(16).padStart(16, '0')}`,
      anchor: structuredClone(anchor),
    }
  }

  async read(channel: 'identity-global', evidenceId: string): Promise<IdentityEvidenceAnchor | undefined> {
    const anchor = this.#records.get(ledgerKey(channel, evidenceId))
    return anchor ? structuredClone(anchor) : undefined
  }
}

export class InMemoryAddressedReferenceIndex implements AddressedReferenceIndex {
  readonly #references = new Map<string, AddressedReference>()
  readonly #routing = new Map<string, { channel: string }>()

  async put(reference: AddressedReference, routing: { channel: string }): Promise<void> {
    if (this.#references.has(reference.evidenceLocator)) throw new Error('Addressed reference already exists.')
    this.#references.set(reference.evidenceLocator, structuredClone(reference))
    this.#routing.set(reference.evidenceLocator, structuredClone(routing))
  }

  async update(reference: AddressedReference): Promise<void> {
    if (!this.#references.has(reference.evidenceLocator)) throw new Error('Addressed reference was not found.')
    this.#references.set(reference.evidenceLocator, structuredClone(reference))
  }

  async listForDestination(destinationOrganizationReference: string): Promise<readonly AddressedReference[]> {
    return [...this.#references.values()]
      .filter(reference => reference.destinationOrganizationReference === destinationOrganizationReference)
      .map(reference => structuredClone(reference))
  }

  async findByEvidenceLocator(evidenceLocator: string): Promise<AddressedReference | undefined> {
    const reference = this.#references.get(evidenceLocator)
    return reference ? structuredClone(reference) : undefined
  }

  async routingFor(evidenceLocator: string): Promise<{ channel: string } | undefined> {
    const routing = this.#routing.get(evidenceLocator)
    return routing ? structuredClone(routing) : undefined
  }
}

export class InMemoryConfidentialEvidenceVault implements ConfidentialEvidenceVault {
  readonly #ciphertexts = new Map<string, string>()

  async put(evidenceId: string, encryptedClaims: string): Promise<void> {
    if (this.#ciphertexts.has(evidenceId)) throw new Error('Confidential evidence already exists.')
    this.#ciphertexts.set(evidenceId, encryptedClaims)
  }

  async has(evidenceId: string): Promise<boolean> {
    return this.#ciphertexts.has(evidenceId)
  }
}

type RecordEmployerEvidenceInput = Readonly<{
  actor: WorkforceActor
  evidenceId: string
  subjectReference: string
  issuer: { legalIdentifier: string; jurisdiction: string }
  qualificationReference: string
  documentCid: string
  encryptedClaims: string
  channel?: unknown
  zone?: unknown
  smartContract?: unknown
}>

type RecordIssuerDecisionInput = Readonly<{
  actor: WorkforceActor
  evidenceLocator: string
  decision: 'confirmed' | 'rejected' | 'revoked'
  issuerProofReference: string
}>

type RecordIdentityEvidenceInput = Readonly<{
  actor: WorkforceActor
  operationId: string
  subjectReference: string
  targets: readonly [IdentityEvidenceTarget, ...IdentityEvidenceTarget[]]
  evidence: readonly [IdentityEvidenceInput, ...IdentityEvidenceInput[]]
  encryptedClaims: string
  channel?: unknown
  zone?: unknown
  smartContract?: unknown
}>

export class EducationQualificationGateway {
  readonly #ledger: QualificationLedger
  readonly #identityLedger: IdentityEvidenceLedger
  readonly #index: AddressedReferenceIndex
  readonly #directory: IssuerDirectory
  readonly #vault: ConfidentialEvidenceVault
  readonly #clock: () => string
  readonly #sourceHostReference: string

  constructor(input: {
    ledger: QualificationLedger
    identityLedger?: IdentityEvidenceLedger
    index: AddressedReferenceIndex
    directory: IssuerDirectory
    vault?: ConfidentialEvidenceVault
    clock?: () => string
    sourceHostReference?: string
  }) {
    this.#ledger = input.ledger
    this.#identityLedger = input.identityLedger ?? new InMemoryIdentityEvidenceLedger()
    this.#index = input.index
    this.#directory = input.directory
    this.#vault = input.vault ?? new InMemoryConfidentialEvidenceVault()
    this.#clock = input.clock ?? (() => new Date().toISOString())
    this.#sourceHostReference = input.sourceHostReference ?? 'host:local'
  }

  async recordEmployerEvidence(input: RecordEmployerEvidenceInput): Promise<{
    channel: string
    transactionId: string
    status: EvidenceStatus
    anchor: QualificationAnchor
  }> {
    rejectInfrastructureSelection(input)
    requireActor(input.actor, 'qualification-evidence:create')
    requireOpaqueReference(input.evidenceId, 'evidenceId')
    requireOpaqueReference(input.subjectReference, 'subjectReference')
    requireOpaqueReference(input.qualificationReference, 'qualificationReference')
    requireOpaqueReference(input.documentCid, 'documentCid')
    if (!input.encryptedClaims.trim()) throw new Error('Encrypted claims are required.')

    const jurisdiction = normalizeJurisdiction(input.issuer.jurisdiction)
    const channel = `qualification-education-${zoneForJurisdiction(jurisdiction)}`
    const issuer = await this.#directory.resolve({
      legalIdentifier: input.issuer.legalIdentifier,
      jurisdiction,
    })
    if (!issuer) throw new Error('Issuer could not be resolved under the governed directory policy.')

    const now = this.#clock()
    const status: EvidenceStatus = issuer.tenantId && issuer.confirmationService
      ? 'pending-issuer-confirmation'
      : 'awaiting-issuer-onboarding'
    const anchor: QualificationAnchor = {
      evidenceId: input.evidenceId,
      subjectReference: input.subjectReference,
      employerOrganizationReference: input.actor.organizationReference,
      issuerOrganizationReference: issuer.organizationReference,
      qualificationReference: input.qualificationReference,
      documentCid: input.documentCid,
      status,
      employerProofReference: `proof:employer:${input.evidenceId}`,
      recordedAt: now,
      updatedAt: now,
    }

    await this.#vault.put(input.evidenceId, input.encryptedClaims)
    const recorded = await this.#ledger.create(channel, anchor)
    await this.#index.put({
      destinationOrganizationReference: issuer.organizationReference,
      evidenceLocator: input.evidenceId,
      sourceHostReference: this.#sourceHostReference,
      channelFamily: 'qualification-education',
      lifecycleStatus: status,
      deliveryState: status === 'pending-issuer-confirmation' ? 'queued' : 'awaiting-onboarding',
      attemptCount: 0,
      queuedAt: now,
    }, { channel })
    return { channel, transactionId: recorded.transactionId, status, anchor: recorded.anchor }
  }

  async recordIdentityEvidence(input: RecordIdentityEvidenceInput): Promise<{
    channel: 'identity-global'
    transactionId: string
    anchor: IdentityEvidenceAnchor
  }> {
    rejectInfrastructureSelection(input)
    requireActor(input.actor, IdentityAttestationCapability.RecordEvidence)
    requireOpaqueReference(input.operationId, 'operationId')
    requireOpaqueReference(input.subjectReference, 'subjectReference')
    if (!input.encryptedClaims.trim()) throw new Error('Encrypted claims are required.')
    const groupAuthorization = input.actor.groupAuthorization
    if (!groupAuthorization) throw new Error('A trusted group authorization is required.')
    if (!input.actor.assignmentReference) throw new Error('A trusted workforce assignment is required.')

    const statement = defineAuthorizedWorkforceIdentityEvidenceStatement({
      context: {
        actorReference: input.actor.employeeReference,
        assignmentReference: input.actor.assignmentReference,
        organizationReference: input.actor.organizationReference,
        groupMembership: {
          groupReference: groupAuthorization.groupReference,
          status: input.actor.active && input.actor.groupReferences.includes(groupAuthorization.groupReference) ? 'active' : 'inactive',
        },
        groupAuthorization,
      },
      request: {
        operationId: input.operationId,
        subjectReference: input.subjectReference,
        targets: input.targets,
        evidence: input.evidence,
      },
    })
    const recordedAt = this.#clock()
    const anchor: IdentityEvidenceAnchor = {
      evidenceId: statement.operationId,
      subjectReference: statement.subjectReference,
      employerOrganizationReference: statement.createdBy.organizationReference,
      employeeReference: statement.createdBy.actorReference,
      groupAuthorizationReference: statement.authorization.groupAuthorizationReference,
      targetKinds: statement.targets.map(target => target.kind),
      status: 'recorded',
      employerProofReference: `proof:employer:${statement.operationId}`,
      recordedAt,
    }
    await this.#vault.put(statement.operationId, input.encryptedClaims)
    const recorded = await this.#identityLedger.create('identity-global', anchor)
    return { channel: 'identity-global', transactionId: recorded.transactionId, anchor: recorded.anchor }
  }

  async listIssuerInbox(input: { actor: WorkforceActor }): Promise<readonly AddressedReference[]> {
    requireActor(input.actor, 'qualification-inbox:list')
    return this.#index.listForDestination(input.actor.organizationReference)
  }

  async recordIssuerDecision(input: RecordIssuerDecisionInput): Promise<{
    channel: string
    transactionId: string
    status: EvidenceStatus
    anchor: QualificationAnchor
  }> {
    requireActor(input.actor, 'qualification-evidence:decide')
    requireOpaqueReference(input.issuerProofReference, 'issuerProofReference')
    const addressed = await this.#index.findByEvidenceLocator(input.evidenceLocator)
    if (!addressed || addressed.destinationOrganizationReference !== input.actor.organizationReference) {
      throw new Error('Only the addressed issuer may decide this evidence.')
    }
    const routing = await this.#index.routingFor(input.evidenceLocator)
    if (!routing) throw new Error('Trusted routing metadata was not found for this evidence.')
    const channel = routing.channel
    const now = this.#clock()
    const updated = await this.#ledger.update(channel, input.evidenceLocator, {
      status: input.decision,
      updatedAt: now,
      issuerProofReference: input.issuerProofReference,
    })
    await this.#index.update({
      ...addressed,
      lifecycleStatus: input.decision,
      deliveryState: 'delivered',
      receiptReference: `receipt:${input.evidenceLocator}:${input.decision}`,
    })
    return { channel, transactionId: updated.transactionId, status: input.decision, anchor: updated.anchor }
  }
}

export function createAntifraudGatewayHttpHandler(input: {
  gateway: EducationQualificationGateway
  controller?: OrganizationControllerGateway
  resolveActor: (bearerCredential: string) => Promise<WorkforceActor | undefined>
}): RequestListener {
  return (request, response) => {
    void handleGatewayRequest(input, request, response)
  }
}

async function handleGatewayRequest(
  input: {
    gateway: EducationQualificationGateway
    controller?: OrganizationControllerGateway
    resolveActor: (bearerCredential: string) => Promise<WorkforceActor | undefined>
  },
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const url = new URL(request.url ?? '/', 'http://gateway.invalid')
    if (request.method === 'GET' && url.pathname === '/healthz') {
      writeJson(response, 200, { status: 'ok' })
      return
    }
    const bearerCredential = readBearerCredential(request)
    const actor = bearerCredential ? await input.resolveActor(bearerCredential) : undefined
    if (!actor) {
      writeJson(response, 401, { error: 'Authentication is required.' })
      return
    }

    if (request.method === 'GET' && url.pathname === '/v1/controller/workspace') {
      if (!input.controller) throw new Error('Controller administration is not configured.')
      writeJson(response, 200, await input.controller.readWorkspace({ actor }))
      return
    }

    if (request.method === 'POST' && url.pathname === '/v1/controller/departments') {
      if (!input.controller) throw new Error('Controller administration is not configured.')
      const body = await readJsonObject(request)
      rejectServerOwnedAuthority(body)
      writeJson(response, 201, await input.controller.createDepartment({
        actor, name: body.name as string, organizationReference: body.organizationReference,
      }))
      return
    }

    if (request.method === 'POST' && url.pathname === '/v1/controller/groups') {
      if (!input.controller) throw new Error('Controller administration is not configured.')
      const body = await readJsonObject(request)
      rejectServerOwnedAuthority(body)
      writeJson(response, 201, await input.controller.createGroup({
        actor, name: body.name as string, capabilities: body.capabilities as string[], organizationReference: body.organizationReference,
      }))
      return
    }

    if (request.method === 'POST' && url.pathname === '/v1/controller/invitations') {
      if (!input.controller) throw new Error('Controller administration is not configured.')
      const body = await readJsonObject(request)
      rejectServerOwnedAuthority(body)
      writeJson(response, 201, await input.controller.createInvitation({
        actor, email: body.email as string, role: body.role as string,
        groupReferences: body.groupReferences as string[], departmentReferences: body.departmentReferences as string[],
        organizationReference: body.organizationReference,
      }))
      return
    }

    const invitationAcceptMatch = request.method === 'POST'
      ? url.pathname.match(/^\/v1\/controller\/invitations\/([^/]+)\/accept$/u)
      : undefined
    if (invitationAcceptMatch) {
      if (!input.controller) throw new Error('Controller administration is not configured.')
      const body = await readJsonObject(request)
      rejectServerOwnedAuthority(body)
      writeJson(response, 200, await input.controller.acceptInvitation({
        actor, invitationReference: decodeURIComponent(invitationAcceptMatch[1]),
        deviceReference: body.deviceReference as string, organizationReference: body.organizationReference,
      }))
      return
    }

    const employeeMembershipMatch = request.method === 'PUT'
      ? url.pathname.match(/^\/v1\/controller\/employees\/([^/]+)\/memberships$/u)
      : undefined
    if (employeeMembershipMatch) {
      if (!input.controller) throw new Error('Controller administration is not configured.')
      const body = await readJsonObject(request)
      rejectServerOwnedAuthority(body)
      writeJson(response, 200, await input.controller.setEmployeeMemberships({
        actor, employeeReference: decodeURIComponent(employeeMembershipMatch[1]),
        groupReferences: body.groupReferences as string[], departmentReferences: body.departmentReferences as string[],
        organizationReference: body.organizationReference,
      }))
      return
    }

    const employeeStatusMatch = request.method === 'PUT'
      ? url.pathname.match(/^\/v1\/controller\/employees\/([^/]+)\/status$/u)
      : undefined
    if (employeeStatusMatch) {
      if (!input.controller) throw new Error('Controller administration is not configured.')
      const body = await readJsonObject(request)
      rejectServerOwnedAuthority(body)
      writeJson(response, 200, await input.controller.setEmployeeStatus({
        actor, employeeReference: decodeURIComponent(employeeStatusMatch[1]),
        status: body.status as 'active' | 'inactive', organizationReference: body.organizationReference,
      }))
      return
    }

    const employeeDeleteMatch = request.method === 'DELETE'
      ? url.pathname.match(/^\/v1\/controller\/employees\/([^/]+)$/u)
      : undefined
    if (employeeDeleteMatch) {
      if (!input.controller) throw new Error('Controller administration is not configured.')
      const body = await readOptionalJsonObject(request)
      rejectServerOwnedAuthority(body)
      writeJson(response, 200, await input.controller.purgeEmployee({
        actor, employeeReference: decodeURIComponent(employeeDeleteMatch[1]), organizationReference: body.organizationReference,
      }))
      return
    }

    if (request.method === 'POST' && url.pathname === '/v1/identity/evidence') {
      const body = await readJsonObject(request)
      rejectServerOwnedAuthority(body)
      const result = await input.gateway.recordIdentityEvidence({
        ...(body as Omit<RecordIdentityEvidenceInput, 'actor'>),
        actor,
      })
      writeJson(response, 201, result)
      return
    }

    if (request.method === 'POST' && url.pathname === '/v1/education/qualification-evidence') {
      const body = await readJsonObject(request)
      rejectServerOwnedAuthority(body)
      const result = await input.gateway.recordEmployerEvidence({
        ...(body as Omit<RecordEmployerEvidenceInput, 'actor'>),
        actor,
      })
      writeJson(response, 201, result)
      return
    }

    if (request.method === 'GET' && url.pathname === '/v1/clearing-house/inbox') {
      const items = await input.gateway.listIssuerInbox({ actor })
      writeJson(response, 200, { items })
      return
    }

    const decisionMatch = request.method === 'POST'
      ? url.pathname.match(/^\/v1\/clearing-house\/evidence\/([^/]+)\/decision$/)
      : undefined
    if (decisionMatch) {
      const body = await readJsonObject(request)
      rejectServerOwnedAuthority(body)
      const result = await input.gateway.recordIssuerDecision({
        actor,
        evidenceLocator: decodeURIComponent(decisionMatch[1]),
        decision: body.decision as RecordIssuerDecisionInput['decision'],
        issuerProofReference: body.issuerProofReference as string,
      })
      writeJson(response, 200, result)
      return
    }

    writeJson(response, 404, { error: 'Route not found.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid request.'
    writeJson(response, 400, { error: message })
  }
}

function readBearerCredential(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization
  const match = authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || undefined
}

async function readJsonObject(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += buffer.length
    if (length > 1024 * 1024) throw new Error('JSON request body exceeds the one-megabyte limit.')
    chunks.push(buffer)
  }
  if (chunks.length === 0) throw new Error('A JSON request body is required.')
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('A JSON object is required.')
  return parsed as Record<string, unknown>
}

async function readOptionalJsonObject(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  if (!chunks.length) return {}
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('A JSON object is required.')
  return parsed as Record<string, unknown>
}

function rejectServerOwnedAuthority(body: Record<string, unknown>): void {
  if (body.actor !== undefined) throw new Error('The authenticated actor is resolved by the server.')
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  if (response.headersSent) return
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function rejectInfrastructureSelection(input: { channel?: unknown; zone?: unknown; smartContract?: unknown }): void {
  if (input.channel !== undefined || input.zone !== undefined || input.smartContract !== undefined) {
    throw new Error('Clients must not select a zone, channel or smart contract.')
  }
}

function requireActor(actor: WorkforceActor, capability: string): void {
  if (!actor.active) throw new Error('An active assignment is required.')
  if (actor.groupReferences.length === 0) throw new Error('An active group membership is required.')
  if (!actor.capabilities.includes(capability)) throw new Error(`The ${capability} capability is required.`)
  requireOpaqueReference(actor.tenantId, 'tenantId')
  requireOpaqueReference(actor.organizationReference, 'organizationReference')
  requireOpaqueReference(actor.employeeReference, 'employeeReference')
}

function zoneForJurisdiction(jurisdiction: string): 'eu' | 'na' {
  if (['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'IE'].includes(jurisdiction)) return 'eu'
  if (['US', 'CA', 'MX'].includes(jurisdiction)) return 'na'
  throw new Error(`Unsupported governed jurisdiction: ${jurisdiction}`)
}

function normalize(value: string): string {
  return value.trim().toUpperCase()
}

function normalizeJurisdiction(value: string): string {
  const jurisdiction = normalize(value)
  if (!/^[A-Z]{2}$/.test(jurisdiction)) throw new Error('Jurisdiction must be an ISO 3166-1 alpha-2 code.')
  return jurisdiction
}

function requireOpaqueReference(value: string, field: string): void {
  if (!value || !value.trim() || /\s/.test(value)) throw new Error(`${field} must be a non-empty opaque reference.`)
}

function ledgerKey(channel: string, evidenceId: string): string {
  return `${channel}\u0000${evidenceId}`
}
