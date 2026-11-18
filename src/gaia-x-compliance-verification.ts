import type {ICryptography} from 'antifraud-data-utils-ts'
import {canonicalRequestDigest, verifyPinnedJwt} from 'antifraud-data-utils-ts/clearing-house'
import {decodeUnverifiedJsonOrJwtObject} from 'antifraud-data-utils-ts/credential-decoding'
import {assertSameActor, assertWorkforceVerifier} from './credential-presentation-verification.js'
import type {WorkforceActor} from './index.js'

type PublicKeys = Parameters<typeof verifyPinnedJwt>[1]
type JsonObject = Record<string, unknown>
export type GaiaXComplianceTrust = Readonly<{
  endpoint: string
  issuer: string
  jwks: PublicKeys
  rulesVersion: string
}>
export type GaiaXSubmissionContext = Readonly<{
  actor: WorkforceActor
  tenantIssuer: string
  /** Current, authoritative tenant signing keys, not caller-selected keys. */
  tenantKeys: PublicKeys
  trust: GaiaXComplianceTrust
}>
export interface GaiaXSubmissionAuthority {
  readSubmissionContext(actor: WorkforceActor): Promise<GaiaXSubmissionContext | undefined>
}

/**
 * The configured external engine validates Gaia-X rules. This adapter verifies
 * its signed SC credential and exact submitted coverage; it is not that engine.
 */
export class GaiaXComplianceVerifier {
  readonly #authority: GaiaXSubmissionAuthority
  readonly #clock: () => number
  readonly #cryptography?: ICryptography
  readonly #allowLocalTestEndpoint: boolean
  constructor(input: Readonly<{
    authority: GaiaXSubmissionAuthority
    clock?: () => number
    cryptography?: ICryptography
    allowLocalTestEndpoint?: boolean
  }>) {
    if (!input?.authority || typeof input.authority.readSubmissionContext !== 'function') {
      throw new Error('Current tenant submission authority must be configured.')
    }
    this.#authority = input.authority
    this.#clock = input.clock ?? (() => Math.floor(Date.now() / 1000))
    this.#cryptography = input.cryptography
    this.#allowLocalTestEndpoint = input.allowLocalTestEndpoint === true
  }
  async verify(input: Readonly<{actor: WorkforceActor; presentation: string}>): Promise<Readonly<{
    credentialJwt: string; credential: JsonObject
  }>> {
    assertWorkforceVerifier(input.actor)
    const context = await this.#readContext(input.actor)
    const now = this.#clock()
    if (typeof input.presentation !== 'string' || input.presentation.length > 1_048_576 || joseType(input.presentation) !== 'vp+jwt') {
      throw new Error('One bounded tenant-signed VP-JWT is required for GXDCH.')
    }
    const payload = await verifyPinnedJwt(input.presentation, context.tenantKeys, context.tenantIssuer, now, {
      requireJwtTimes: false, cryptography: this.#cryptography,
    })
    const presentation = asObject(payload.vp ?? payload)
    if (!typeIncludes(presentation.type ?? presentation['@type'], 'VerifiablePresentation')
      || !Array.isArray(presentation.verifiableCredential) || !presentation.verifiableCredential.length
      || presentation.verifiableCredential.length > 100) throw new Error('A bounded nonempty credential presentation is required.')
    if (payload.exp === undefined) assertValidity(presentation, now)
    const expected = new Map<string, string>()
    for (const value of presentation.verifiableCredential) {
      let credential: JsonObject
      if (typeof value === 'string') credential = asObject(decodeUnverifiedJsonOrJwtObject(value))
      else {
        credential = asObject(value)
        if (typeIncludes(credential.type, 'EnvelopedVerifiableCredential')) {
          if (typeof credential.id !== 'string' || !credential.id.startsWith('data:application/vc+jwt,')) {
            throw new Error('Unsupported enveloped credential media type.')
          }
          credential = asObject(decodeUnverifiedJsonOrJwtObject(credential.id.slice('data:application/vc+jwt,'.length)))
        }
      }
      if (credential.vc) credential = asObject(credential.vc)
      const id = credential.id ?? credential['@id']
      if (typeof id !== 'string' || !id || expected.has(id)) throw new Error('Input credential identifiers must be present and unique.')
      expected.set(id, `sha256-${canonicalRequestDigest(credential)}`)
    }
    const endpoint = this.#endpoint(context.trust)
    const response = await fetch(endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20_000),
      headers: {'content-type': 'application/vp+jwt', accept: 'application/vc+jwt'}, body: input.presentation,
    })
    if (!response.ok) throw new Error(`GXDCH rejected the presentation (${response.status}).`)
    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/vc+jwt') {
      throw new Error('GXDCH must return a signed VC-JWT credential media type.')
    }
    const compact = (await readBoundedText(response, 1_048_576)).trim()
    if (!['vc+jwt', 'vc+ld+json+jwt'].includes(joseType(compact))) throw new Error('Unexpected GXDCH signed credential type.')
    // An actor or trust entry may have changed while the external request was in flight.
    const current = await this.#readContext(input.actor)
    if (current.tenantIssuer !== context.tenantIssuer || this.#endpoint(current.trust).href !== endpoint.href
      || current.trust.issuer !== context.trust.issuer || current.trust.rulesVersion !== context.trust.rulesVersion) {
      throw new Error('Current GXDCH trust no longer matches the submitted request.')
    }
    const checkedAt = this.#clock()
    await verifyPinnedJwt(input.presentation, current.tenantKeys, current.tenantIssuer, checkedAt, {
      requireJwtTimes: false, cryptography: this.#cryptography,
    })
    const verified = await verifyPinnedJwt(compact, current.trust.jwks, current.trust.issuer, checkedAt, {
      requireJwtTimes: false, cryptography: this.#cryptography,
    })
    const credential = asObject(verified.vc ?? verified)
    const issuer = typeof credential.issuer === 'string' ? credential.issuer : asObject(credential.issuer).id
    if (issuer !== current.trust.issuer || !typeIncludes(credential.type, 'gx:LabelCredential')
      || typeof credential.id !== 'string' || !credential.id) throw new Error('Unexpected GXDCH credential issuer or type.')
    assertValidity(credential, checkedAt)
    const subject = asObject(credential.credentialSubject)
    if (subject['gx:labelLevel'] !== 'SC' || subject['gx:rulesVersion'] !== current.trust.rulesVersion) {
      throw new Error('GXDCH label or rules version does not match the configured profile.')
    }
    const coverage = subject['gx:compliantCredentials']
    if (!Array.isArray(coverage) || coverage.length !== expected.size) throw new Error('GXDCH result does not cover the submitted credentials.')
    const covered = new Set<string>()
    for (const value of coverage) {
      const item = asObject(value), id = item.id ?? item['@id']
      if (typeof id !== 'string' || covered.has(id) || !expected.has(id)
        || expected.get(id) !== (item.digestSRI ?? item['gx:digestSRI'])) throw new Error('GXDCH credential digest or identifier mismatch.')
      covered.add(id)
    }
    return Object.freeze({credentialJwt: compact, credential})
  }
  async #readContext(actor: WorkforceActor): Promise<GaiaXSubmissionContext> {
    const context = await this.#authority.readSubmissionContext(actor)
    if (!context || !context.tenantIssuer || !context.trust) throw new Error('Current tenant submission authority is unavailable.')
    assertSameActor(context.actor, actor)
    assertWorkforceVerifier(context.actor)
    return context
  }
  #endpoint(trust: GaiaXComplianceTrust): URL {
    const endpoint = new URL(trust.endpoint)
    const localTest = this.#allowLocalTestEndpoint && process.env.NODE_ENV === 'test'
      && endpoint.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(endpoint.hostname)
    if ((!localTest && endpoint.protocol !== 'https:') || endpoint.username || endpoint.password || endpoint.hash
      || !trust.issuer || !trust.rulesVersion || !trust.jwks?.keys?.length) {
      throw new Error('GXDCH requires a pinned HTTPS engine and explicit rules version.')
    }
    return endpoint
  }
}
function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('A credential object is required.')
  return value as JsonObject
}
function typeIncludes(value: unknown, expected: string): boolean {
  return (Array.isArray(value) ? value : [value]).includes(expected)
}
function joseType(compact: string): string {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(compact) || compact.split('.')[0].length > 16_384) {
    throw new Error('A signed JWT credential is required.')
  }
  const header = asObject(JSON.parse(Buffer.from(compact.split('.')[0], 'base64url').toString('utf8')))
  return typeof header.typ === 'string' ? header.typ : ''
}
function assertValidity(document: JsonObject, now: number): void {
  const from = typeof document.validFrom === 'string' ? Date.parse(document.validFrom) : NaN
  const until = typeof document.validUntil === 'string' ? Date.parse(document.validUntil) : NaN
  if (!Number.isFinite(from) || !Number.isFinite(until) || from > now * 1000 || until <= now * 1000 || until <= from) {
    throw new Error('GXDCH credential is outside its validity period.')
  }
}
async function readBoundedText(response: Response, maximum: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('GXDCH signed credential body is missing.')
  const chunks: Uint8Array[] = []; let total = 0
  try {
    for (;;) {
      const item = await reader.read()
      if (item.done) break
      total += item.value.byteLength
      if (total > maximum) {await reader.cancel(); throw new Error('GXDCH credential exceeds the accepted size.')}
      chunks.push(item.value)
    }
  } finally {reader.releaseLock()}
  return new TextDecoder('utf-8', {fatal: true}).decode(Buffer.concat(chunks))
}
