import {randomUUID} from 'node:crypto'

import {
  SocialPublicationDemoAdapter,
  defineSocialPublicationDemoRecord,
  type ManagedSignatureProof,
  type SocialPublicationContent,
  type SocialPublicationDemoRecord,
} from 'antifraud-data-utils-ts'

import type {NamespacedGatewayDocumentStore} from './demo-persistence.js'
import type {WorkforceActor} from './index.js'

type StoredPublication = Readonly<{
  organizationReference: string
  record: SocialPublicationDemoRecord
}>

export interface SocialPublicationDemoStore {
  create(record: StoredPublication): Promise<void>
  read(publicationId: string): Promise<StoredPublication | undefined>
}

function key(publicationId: string): string {
  return Buffer.from(publicationId).toString('base64url')
}

export class GatewayDocumentSocialPublicationStore implements SocialPublicationDemoStore {
  constructor(private readonly documents: NamespacedGatewayDocumentStore) {}

  create(record: StoredPublication): Promise<void> {
    return this.documents.create('social_publications', key(record.record.id), record)
  }

  async read(publicationId: string): Promise<StoredPublication | undefined> {
    const value = await this.documents.read('social_publications', key(publicationId))
    return value ? structuredClone(value as StoredPublication) : undefined
  }
}

type SocialPublicationDemoGatewayOptions = Readonly<{
  store: SocialPublicationDemoStore
  operationDelayMs?: number
  wait?: (milliseconds: number) => Promise<void>
  clock?: () => string
  transactionId?: () => string
}>

export class SocialPublicationDemoGateway {
  readonly #store: SocialPublicationDemoStore
  readonly #operationDelayMs: number
  readonly #wait: (milliseconds: number) => Promise<void>
  readonly #clock: () => string
  readonly #transactionId: () => string

  constructor(options: SocialPublicationDemoGatewayOptions) {
    this.#store = options.store
    this.#operationDelayMs = options.operationDelayMs ?? 0
    if (!Number.isSafeInteger(this.#operationDelayMs) || this.#operationDelayMs < 0) {
      throw new Error('operationDelayMs must be a non-negative safe integer.')
    }
    this.#wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)))
    this.#clock = options.clock ?? (() => new Date().toISOString())
    this.#transactionId = options.transactionId ?? (() => `demo-memory-${randomUUID()}`)
  }

  async record(input: Readonly<{
    actor: WorkforceActor
    content: SocialPublicationContent
    proof: ManagedSignatureProof
  }>): Promise<SocialPublicationDemoRecord> {
    requireSocialActor(input.actor)
    if (this.#operationDelayMs) await this.#wait(this.#operationDelayMs)
    const record = defineSocialPublicationDemoRecord({
      content: input.content,
      proof: input.proof,
      receipt: {
        adapter: SocialPublicationDemoAdapter.InMemoryFabric,
        transactionId: this.#transactionId(),
        recordedAt: this.#clock(),
        cryptographicProof: true,
      },
    })
    await this.#store.create({
      organizationReference: input.actor.organizationReference,
      record,
    })
    return record
  }

  async read(input: Readonly<{
    actor: WorkforceActor
    publicationId: string
  }>): Promise<SocialPublicationDemoRecord> {
    requireSocialActor(input.actor)
    const stored = await this.#store.read(input.publicationId)
    if (!stored) throw new Error('Publication was not found.')
    if (stored.organizationReference !== input.actor.organizationReference) {
      throw new Error('Organization is not authorized to read this publication.')
    }
    return structuredClone(stored.record)
  }
}

function requireSocialActor(actor: WorkforceActor): void {
  if (!actor.active || !actor.organizationReference?.trim() || !actor.groupReferences.length) {
    throw new Error('An active social Demo assignment is required.')
  }
  if (!actor.capabilities.includes('social-publication:record')) {
    throw new Error('The social-publication:record capability is required.')
  }
}
