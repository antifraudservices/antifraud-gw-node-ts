import {randomUUID} from 'node:crypto'

import type {
  ControllerAdministrationStore,
  ControllerWorkspacePersistenceState,
} from './controller-administration.js'
import type {
  AddressedReference,
  AddressedReferenceIndex,
  ConfidentialEvidenceVault,
  IdentityEvidenceAnchor,
  IdentityEvidenceLedger,
  QualificationAnchor,
  QualificationLedger,
} from './index.js'
import type {GatewayObjectBackend, NamespacedGatewayDocumentStore} from './demo-persistence.js'

function key(...parts: string[]): string {
  return Buffer.from(parts.join('\u0000')).toString('base64url')
}

function transactionId(kind: string): string {
  return `tx:${kind}:${randomUUID()}`
}

type AdapterDelayOptions = Readonly<{
  operationDelayMs?: number
  wait?: (milliseconds: number) => Promise<void>
}>

function adapterDelay(options: AdapterDelayOptions): () => Promise<void> {
  const milliseconds = options.operationDelayMs ?? 0
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    throw new Error('operationDelayMs must be a non-negative safe integer.')
  }
  const wait = options.wait ?? (value => new Promise(resolve => setTimeout(resolve, value)))
  return milliseconds ? () => wait(milliseconds) : async () => undefined
}

export class GatewayDocumentQualificationLedger implements QualificationLedger {
  readonly #delay: () => Promise<void>

  constructor(
    private readonly documents: NamespacedGatewayDocumentStore,
    options: AdapterDelayOptions = {},
  ) {
    this.#delay = adapterDelay(options)
  }

  async create(channel: string, anchor: QualificationAnchor) {
    await this.#delay()
    await this.documents.create('qualification_anchors', key(channel, anchor.evidenceId), {channel, anchor})
    return {transactionId: transactionId('demo'), anchor: structuredClone(anchor)}
  }

  async update(
    channel: string,
    evidenceId: string,
    update: Pick<QualificationAnchor, 'status' | 'updatedAt' | 'issuerProofReference'>,
  ) {
    await this.#delay()
    const id = key(channel, evidenceId)
    const stored = await this.documents.read('qualification_anchors', id) as {channel: string; anchor: QualificationAnchor} | undefined
    if (!stored) throw new Error('Evidence was not found on the derived channel.')
    const anchor = {...stored.anchor, ...update}
    await this.documents.write('qualification_anchors', id, {channel, anchor})
    return {transactionId: transactionId('demo'), anchor: structuredClone(anchor)}
  }

  async read(channel: string, evidenceId: string): Promise<QualificationAnchor | undefined> {
    await this.#delay()
    const stored = await this.documents.read('qualification_anchors', key(channel, evidenceId)) as {anchor: QualificationAnchor} | undefined
    return stored ? structuredClone(stored.anchor) : undefined
  }
}

export class GatewayDocumentIdentityEvidenceLedger implements IdentityEvidenceLedger {
  readonly #delay: () => Promise<void>

  constructor(
    private readonly documents: NamespacedGatewayDocumentStore,
    options: AdapterDelayOptions = {},
  ) {
    this.#delay = adapterDelay(options)
  }

  async create(channel: 'identity-global', anchor: IdentityEvidenceAnchor) {
    await this.#delay()
    await this.documents.create('identity_anchors', key(channel, anchor.evidenceId), {channel, anchor})
    return {transactionId: transactionId('identity-demo'), anchor: structuredClone(anchor)}
  }

  async read(channel: 'identity-global', evidenceId: string): Promise<IdentityEvidenceAnchor | undefined> {
    await this.#delay()
    const stored = await this.documents.read('identity_anchors', key(channel, evidenceId)) as {anchor: IdentityEvidenceAnchor} | undefined
    return stored ? structuredClone(stored.anchor) : undefined
  }
}

type StoredAddressedReference = Readonly<{
  reference: AddressedReference
  routing: Readonly<{channel: string}>
}>

export class GatewayDocumentAddressedReferenceIndex implements AddressedReferenceIndex {
  constructor(private readonly documents: NamespacedGatewayDocumentStore) {}

  async put(reference: AddressedReference, routing: {channel: string}): Promise<void> {
    await this.documents.create('addressed_references', key(reference.evidenceLocator), {reference, routing})
  }

  async update(reference: AddressedReference): Promise<void> {
    const id = key(reference.evidenceLocator)
    const stored = await this.documents.read('addressed_references', id) as StoredAddressedReference | undefined
    if (!stored) throw new Error('Addressed reference was not found.')
    await this.documents.write('addressed_references', id, {reference, routing: stored.routing})
  }

  async listForDestination(destinationOrganizationReference: string): Promise<readonly AddressedReference[]> {
    const entries = await this.documents.list('addressed_references')
    return entries
      .map(entry => entry.value as StoredAddressedReference)
      .filter(entry => entry.reference.destinationOrganizationReference === destinationOrganizationReference)
      .map(entry => structuredClone(entry.reference))
  }

  async findByEvidenceLocator(evidenceLocator: string): Promise<AddressedReference | undefined> {
    const stored = await this.documents.read('addressed_references', key(evidenceLocator)) as StoredAddressedReference | undefined
    return stored ? structuredClone(stored.reference) : undefined
  }

  async routingFor(evidenceLocator: string): Promise<{channel: string} | undefined> {
    const stored = await this.documents.read('addressed_references', key(evidenceLocator)) as StoredAddressedReference | undefined
    return stored ? structuredClone(stored.routing) : undefined
  }
}

export class GatewayDocumentConfidentialEvidenceVault implements ConfidentialEvidenceVault {
  constructor(private readonly documents: NamespacedGatewayDocumentStore) {}

  put(evidenceId: string, encryptedClaims: string): Promise<void> {
    return this.documents.create('confidential_evidence', key(evidenceId), {encryptedClaims})
  }

  async has(evidenceId: string): Promise<boolean> {
    return Boolean(await this.documents.read('confidential_evidence', key(evidenceId)))
  }
}

export class GatewayDocumentControllerAdministrationStore implements ControllerAdministrationStore {
  constructor(private readonly documents: NamespacedGatewayDocumentStore) {}

  async read(organizationReference: string): Promise<ControllerWorkspacePersistenceState | undefined> {
    const value = await this.documents.read('controller_workspaces', key(organizationReference))
    return value ? structuredClone(value as ControllerWorkspacePersistenceState) : undefined
  }

  write(organizationReference: string, state: ControllerWorkspacePersistenceState): Promise<void> {
    return this.documents.write('controller_workspaces', key(organizationReference), state)
  }
}

export class GatewayDocumentObjectBackend implements GatewayObjectBackend {
  constructor(private readonly documents: NamespacedGatewayDocumentStore) {}

  put(name: string, value: string): Promise<void> {
    return this.documents.create('sealed_objects', key(name), {value})
  }

  async get(name: string): Promise<string | undefined> {
    const stored = await this.documents.read('sealed_objects', key(name)) as {value: string} | undefined
    return stored?.value
  }
}
