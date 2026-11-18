import {IdentityAttestationCapability, type ICryptography} from 'antifraud-data-utils-ts'
import {decodeUnverifiedJsonOrJwtObject} from 'antifraud-data-utils-ts/credential-decoding'
import {canonicalRequestDigest, verifyPinnedJwt} from 'antifraud-data-utils-ts/clearing-house'
import type {WorkforceActor} from './index.js'

type PublicKeys = Parameters<typeof verifyPinnedJwt>[1]
export type CredentialPresentationRequest = Readonly<{
  nonce: string
  resourceReference: string
  jurisdiction: string
  capability: typeof IdentityAttestationCapability.VerifyClaim
}>
export type RegisteredPresentationHolder = Readonly<{
  actor: WorkforceActor
  holderReference: string
  status: 'active' | 'inactive'
  expiresAt: number
  /** Current registered public signing keys only, never keys supplied by a request. */
  jwks: PublicKeys
}>
export type ApprovedCredentialIssuer = Readonly<{
  issuer: string
  status: 'active' | 'inactive'
  /** Authoritative current active signing keys; rotated or disabled keys are excluded. */
  jwks: PublicKeys
}>
export type CredentialUsePermission = Omit<CredentialPresentationRequest, 'nonce'> & Readonly<{
  tenantId: string
  organizationReference: string
  employeeReference: string
  status: 'active' | 'inactive'
  expiresAt: number
  requiredCredentialTypes: readonly string[]
}>
/** Each read must consult the current protected registration or authoritative ledger. */
export interface CredentialPresentationAuthority {
  readonly kind: 'memory' | 'fabric'
  readHolder(input: Readonly<{actor: WorkforceActor; holderReference: string}>): Promise<RegisteredPresentationHolder | undefined>
  readIssuer(input: Readonly<{tenantId: string; issuer: string}>): Promise<ApprovedCredentialIssuer | undefined>
  readCredentialStatus(input: Readonly<{tenantId: string; issuer: string; credentialId: string}>): Promise<Readonly<{
    id: string; issuer: string; status: 'active' | 'revoked' | 'unknown'; expiresAt?: number
  }> | undefined>
  readPermission(input: Readonly<{actor: WorkforceActor; request: CredentialPresentationRequest}>): Promise<CredentialUsePermission | undefined>
}
/** consume must atomically reject a previously consumed key across all serving replicas. */
export interface PresentationReplayStore {
  readonly kind: 'memory' | 'durable'
  consume(key: string, expiresAt: number, now: number): Promise<boolean>
}
/** Process-local replay state is restricted by the verifier to the memory test network. */
export class MemoryPresentationReplayStore implements PresentationReplayStore {
  readonly kind = 'memory' as const
  readonly #entries = new Map<string, number>()
  async consume(key: string, expiresAt: number, now: number): Promise<boolean> {
    if (!key || !Number.isFinite(expiresAt) || expiresAt <= now) return false
    for (const [existing, expiry] of this.#entries) if (expiry <= now) this.#entries.delete(existing)
    if (this.#entries.has(key) || this.#entries.size >= 10_000) return false
    this.#entries.set(key, expiresAt)
    return true
  }
}

/** Verifies a presentation without converting a login or a signature into data authority. */
export class CredentialPresentationVerifier {
  readonly #authority: CredentialPresentationAuthority
  readonly #replay: PresentationReplayStore
  readonly #clock: () => number
  readonly #cryptography?: ICryptography
  constructor(input: Readonly<{
    networkKind: 'test' | 'local-network' | 'test-network' | 'network'
    authority: CredentialPresentationAuthority
    replay: PresentationReplayStore
    clock?: () => number
    cryptography?: ICryptography
  }>) {
    if (!input?.authority || !['readHolder', 'readIssuer', 'readCredentialStatus', 'readPermission']
      .every(method => typeof (input.authority as unknown as Record<string, unknown>)[method] === 'function')
      || !input.replay || typeof input.replay.consume !== 'function') {
      throw new Error('Current authority and replay storage must be configured.')
    }
    if (!['test', 'local-network', 'test-network', 'network'].includes(input.networkKind)) {
      throw new Error('A governed network profile is required.')
    }
    if (input.networkKind !== 'test' && (input.authority.kind !== 'fabric' || input.replay.kind !== 'durable')) {
      throw new Error('Fabric networks require current Fabric authority and durable replay storage.')
    }
    if (!['memory', 'fabric'].includes(input.authority.kind) || !['memory', 'durable'].includes(input.replay.kind)) {
      throw new Error('An explicit authority and replay provider are required.')
    }
    this.#cryptography = input.cryptography
    this.#authority = input.authority
    this.#replay = input.replay
    this.#clock = input.clock ?? (() => Math.floor(Date.now() / 1000))
  }

  async verify(input: Readonly<{actor: WorkforceActor; request: CredentialPresentationRequest; presentation: string}>): Promise<Readonly<{
    verified: true; tenantReference: string; actorReference: string; credentialReferences: readonly string[]
    requestHash: string; checkedAt: string; stateProvider: 'memory' | 'fabric'
  }>> {
    assertWorkforceVerifier(input.actor)
    const request = validateRequest(input.request)
    const now = this.#clock()
    if (!Number.isFinite(now) || now < 0) throw new Error('A finite current verification time is required.')
    if (typeof input.presentation !== 'string' || input.presentation.length > 262_144) {
      throw new Error('One bounded signed presentation is required.')
    }
    // This unverified field selects a registration lookup only. It cannot supply keys or authority.
    const unverified = decodeUnverifiedJsonOrJwtObject(input.presentation)
    const holderReference = typeof unverified?.iss === 'string' ? unverified.iss : ''
    if (!holderReference) throw new Error('Presentation holder is missing.')
    const holder = await this.#authority.readHolder({actor: input.actor, holderReference})
    if (!holder || holder.status !== 'active' || holder.holderReference !== holderReference
      || !Number.isFinite(holder.expiresAt) || holder.expiresAt <= now) {
      throw new Error('Current registered holder is unavailable or inactive.')
    }
    assertSameActor(holder.actor, input.actor)
    assertWorkforceVerifier(holder.actor)
    const presentation = await verifyPinnedJwt(input.presentation, holder.jwks, holderReference, now, {audience: holder.actor.tenantId, cryptography: this.#cryptography})
    const requestHash = canonicalRequestDigest(request)
    if (presentation.sub !== holder.actor.employeeReference || presentation.nonce !== request.nonce
      || presentation.request_hash !== requestHash || Number(presentation.exp) - Number(presentation.iat) > 120) {
      throw new Error('Presentation does not bind this actor and exact current request.')
    }
    const permission = await this.#authority.readPermission({actor: holder.actor, request})
    if (!permission || permission.status !== 'active' || !Number.isFinite(permission.expiresAt) || permission.expiresAt <= now
      || permission.tenantId !== holder.actor.tenantId || permission.organizationReference !== holder.actor.organizationReference
      || permission.employeeReference !== holder.actor.employeeReference
      || permission.resourceReference !== request.resourceReference || permission.jurisdiction !== request.jurisdiction
      || permission.capability !== request.capability || !Array.isArray(permission.requiredCredentialTypes)
      || !permission.requiredCredentialTypes.length || !permission.requiredCredentialTypes.every(type => typeof type === 'string' && type)) {
      throw new Error('Current permission does not authorize this resource, jurisdiction and capability.')
    }
    const credentials = (presentation.vp as {verifiableCredential?: unknown} | undefined)?.verifiableCredential
    if (!Array.isArray(credentials) || !credentials.length || credentials.length > 8 || !credentials.every(value => typeof value === 'string')) {
      throw new Error('Signed issuer credentials are required in the presentation.')
    }
    const credentialReferences: string[] = []
    for (const compact of credentials as string[]) {
      const unverifiedCredential = decodeUnverifiedJsonOrJwtObject(compact)
      const issuer = typeof unverifiedCredential?.iss === 'string' ? unverifiedCredential.iss : ''
      const trusted = issuer ? await this.#authority.readIssuer({tenantId: holder.actor.tenantId, issuer}) : undefined
      if (!trusted || trusted.status !== 'active' || trusted.issuer !== issuer) throw new Error('Credential issuer is not currently trusted.')
      const payload = await verifyPinnedJwt(compact, trusted.jwks, issuer, now, {requireJwtTimes: false, cryptography: this.#cryptography})
      const credential = payload.vc && typeof payload.vc === 'object' ? payload.vc as Record<string, unknown> : payload
      if (credential.issuer !== undefined) {
        const documentIssuer = typeof credential.issuer === 'string' ? credential.issuer
          : credential.issuer && typeof credential.issuer === 'object' ? (credential.issuer as {id?: unknown}).id : undefined
        if (documentIssuer !== issuer) throw new Error('Credential document issuer contradicts its signed JWT issuer.')
      }
      const subject = credential.credentialSubject as {id?: unknown} | undefined
      if (subject?.id !== holder.actor.employeeReference || (payload.sub !== undefined && payload.sub !== subject.id)) {
        throw new Error('Credential subject does not match the authenticated employee.')
      }
      const types = Array.isArray(credential.type) ? credential.type : []
      if (!permission.requiredCredentialTypes.every(type => types.includes(type))) throw new Error('Credential type does not satisfy the current use policy.')
      for (const field of ['validFrom', 'issuanceDate']) {
        if (credential[field] !== undefined && (typeof credential[field] !== 'string' || !Number.isFinite(Date.parse(credential[field]))
          || Date.parse(credential[field]) > now * 1000)) throw new Error('Credential is not valid yet.')
      }
      for (const field of ['validUntil', 'expirationDate']) {
        if (credential[field] !== undefined && (typeof credential[field] !== 'string' || !Number.isFinite(Date.parse(credential[field]))
          || Date.parse(credential[field]) <= now * 1000)) throw new Error('Credential has expired.')
      }
      const credentialId = typeof credential.id === 'string' ? credential.id : typeof payload.jti === 'string' ? payload.jti : ''
      if (!credentialId) throw new Error('Credential identity is missing.')
      const state = await this.#authority.readCredentialStatus({tenantId: holder.actor.tenantId, issuer, credentialId})
      if (!state || state.id !== credentialId || state.issuer !== issuer || state.status !== 'active'
        || (state.expiresAt !== undefined && (!Number.isFinite(state.expiresAt) || state.expiresAt <= now))) {
        throw new Error('Credential is not currently active.')
      }
      credentialReferences.push(credentialId)
    }
    const replayKey = canonicalRequestDigest({tenant: holder.actor.tenantId, holder: holderReference, jti: presentation.jti})
    if (!await this.#replay.consume(replayKey, Number(presentation.exp), now)) throw new Error('Presentation was already consumed or replay storage is unavailable.')
    return Object.freeze({verified: true, tenantReference: holder.actor.tenantId, actorReference: holder.actor.employeeReference,
      credentialReferences: Object.freeze(credentialReferences), requestHash, checkedAt: new Date(now * 1000).toISOString(), stateProvider: this.#authority.kind})
  }
}

export function assertWorkforceVerifier(actor: WorkforceActor): void {
  if (!actor?.active || !actor.assignmentReference || !actor.tenantId || !actor.organizationReference || !actor.employeeReference
    || !Array.isArray(actor.capabilities) || !actor.capabilities.includes(IdentityAttestationCapability.VerifyClaim)) {
    throw new Error('An active workforce assignment with verification capability is required.')
  }
  const authorization = actor.groupAuthorization
  if (!authorization || authorization.status !== 'active' || !authorization.authorizationReference || !authorization.controllerReference
    || !actor.groupReferences.includes(authorization.groupReference)
    || !authorization.capabilities.includes(IdentityAttestationCapability.VerifyClaim)) {
    throw new Error('Current exact group membership and controller authorization are required.')
  }
}
export function assertSameActor(current: WorkforceActor, authenticated: WorkforceActor): void {
  for (const key of ['tenantId', 'organizationReference', 'employeeReference', 'assignmentReference'] as const) {
    if (current[key] !== authenticated[key]) throw new Error('Current holder registration belongs to a different actor or assignment.')
  }
}
function validateRequest(input: CredentialPresentationRequest): CredentialPresentationRequest {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !['nonce', 'resourceReference', 'jurisdiction', 'capability'].includes(key))
    || typeof input.nonce !== 'string' || !input.nonce.trim() || input.nonce.length > 256
    || typeof input.resourceReference !== 'string' || !input.resourceReference.trim() || input.resourceReference.length > 1024
    || typeof input.jurisdiction !== 'string' || !/^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/u.test(input.jurisdiction)
    || input.capability !== IdentityAttestationCapability.VerifyClaim) {
    throw new Error('Exact resource, jurisdiction, nonce and governed verification capability are required.')
  }
  return Object.freeze({nonce: input.nonce, resourceReference: input.resourceReference, jurisdiction: input.jurisdiction, capability: input.capability})
}
