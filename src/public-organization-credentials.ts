import { isDeepStrictEqual } from 'node:util'

const vcContext = 'https://www.w3.org/ns/credentials/v2'
const tokenPrefix = 'data:application/vc+jwt,'
const publicScope = /^\/(?:host\/cds-[A-Z0-9-]+\/v1\/(?:test|local-network|test-network|network)|[A-Za-z0-9][A-Za-z0-9._-]*\/cds-[A-Z0-9-]+\/v1\/[a-z0-9-]+)$/u

type JsonObject = Record<string, unknown>

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object')
  return value as JsonObject
}

function matchesSubject(credential: JsonObject, did: string, type: string): boolean {
  const subject = object(credential.credentialSubject)
  return (subject.id ?? subject['@id']) === did && (subject.type ?? subject['@type']) === type
}

function isPublicRoute(path: string): boolean {
  const match = path.match(/^(.*)\/\.well-known\/(?:organization|vc|legal-participant\.vc)\.json$/u)
  return Boolean(match && publicScope.test(match[1]))
}

export type PublicOrganizationCredentials = {
  read(path: string): JsonObject | undefined
}

export const isPublicOrganizationCredentialRoute = isPublicRoute

/**
 * Loads reviewed, already-signed public artifacts from trusted operator configuration.
 * This catalog does not create tenants, issue credentials or grant any authority.
 */
export function parsePublicOrganizationCredentials(serialized?: string): PublicOrganizationCredentials | undefined {
  if (!serialized?.trim()) return undefined
  const credentials = new Map<string, JsonObject>()
  try {
    const records: unknown = JSON.parse(serialized)
    if (!Array.isArray(records) || records.length === 0) throw new Error('Expected entries')
    for (const record of records) {
      const { basePath, did, organization: sourceOrganization, participantJson: sourceParticipantJson, participant: sourceParticipant } = object(record)
      if (typeof basePath !== 'string' || !publicScope.test(basePath) || typeof did !== 'string' || !did.startsWith('did:')) {
        throw new Error('Invalid scope')
      }
      const organization = object(sourceOrganization)
      const context = organization['@context']
      if (!Array.isArray(context) || !context.includes(vcContext) || !context.includes('https://schema.org')
        || !Array.isArray(organization.type) || !organization.type.includes('OrganizationCredential')
        || !organization.proof || typeof organization.issuer !== 'string' || organization.issuer === did
        || !matchesSubject(organization, did, 'Organization')) {
        throw new Error('Invalid organization credential')
      }
      const participant = object(sourceParticipant)
      const id = participant.id
      if (participant.type !== 'EnvelopedVerifiableCredential' || participant['@context'] !== vcContext
        || typeof id !== 'string' || !id.startsWith(tokenPrefix)) {
        throw new Error('Invalid participant container')
      }
      const token = id.slice(tokenPrefix.length)
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(token)) throw new Error('Invalid compact JWS')
      const [header, payload] = token.split('.')
      const protectedHeader = object(JSON.parse(Buffer.from(header, 'base64url').toString('utf8')))
      const signedCredential = object(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')))
      if (typeof protectedHeader.alg !== 'string' || protectedHeader.alg === 'none'
        || signedCredential.issuer !== did || !matchesSubject(signedCredential, did, 'gx:LegalPerson')) {
        throw new Error('Invalid signed participant')
      }
      const participantJson = object(sourceParticipantJson)
      const { proof: participantProof, ...claims } = participantJson
      if (!participantProof || !isDeepStrictEqual(claims, signedCredential)) {
        throw new Error('Participant representations do not match')
      }
      const prefix = basePath + '/.well-known/'
      if (credentials.has(prefix + 'vc.json')) throw new Error('Duplicate scope')
      credentials.set(prefix + 'organization.json', organization)
      credentials.set(prefix + 'vc.json', participantJson)
      credentials.set(prefix + 'legal-participant.vc.json', { '@context': vcContext, type: participant.type, id })
    }
  } catch {
    throw new Error('Invalid public organization credential configuration.')
  }
  return { read: path => credentials.get(path) }
}
