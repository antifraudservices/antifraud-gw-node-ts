export type GatewayPersistenceEnvironment = 'demo' | 'test-network' | 'production'

export type GatewayPersistenceProfile = Readonly<{
  environment: GatewayPersistenceEnvironment
  collectionPrefix: string
  enabled: boolean
  disposable: boolean
  retentionDays: number | null
}>

function demoRetentionDays(value: string | undefined): number {
  const retentionDays = Number.parseInt(value ?? '7', 10)
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 90) {
    throw new Error('ANTIFRAUD_DEMO_RETENTION_DAYS must be an integer from 1 through 90.')
  }
  return retentionDays
}

export function resolveGatewayPersistenceProfile(
  environment: Readonly<Record<string, string | undefined>>,
): GatewayPersistenceProfile {
  const networkKind = environment.ANTIFRAUD_NETWORK_KIND ?? 'demo'
  if (networkKind === 'demo' || networkKind === 'test') {
    return {
      environment: 'demo', collectionPrefix: 'antifraud_demo_', enabled: true,
      disposable: true, retentionDays: demoRetentionDays(environment.ANTIFRAUD_DEMO_RETENTION_DAYS),
    }
  }
  if (networkKind === 'test-network' || networkKind === 'local-network') {
    return {
      environment: 'test-network',
      collectionPrefix: 'antifraud_test_network_',
      enabled: environment.ANTIFRAUD_TEST_NETWORK_ENABLED === 'true',
      disposable: false,
      retentionDays: null,
    }
  }
  if (networkKind === 'network' || networkKind === 'production') {
    return {
      environment: 'production',
      collectionPrefix: 'antifraud_production_',
      enabled: environment.ANTIFRAUD_PRODUCTION_ENABLED === 'true',
      disposable: false,
      retentionDays: null,
    }
  }
  throw new Error(`Unsupported server-owned persistence environment: ${networkKind}`)
}

export interface GatewayDocumentBackend {
  create(collection: string, id: string, value: object): Promise<void>
  read(collection: string, id: string): Promise<object | undefined>
  list(collection: string): Promise<readonly Readonly<{id: string; value: object}>[]>
  write(collection: string, id: string, value: object): Promise<void>
  purgePrefix(prefix: string): Promise<number>
}

export class InMemoryGatewayDocumentBackend implements GatewayDocumentBackend {
  readonly #collections = new Map<string, Map<string, object>>()

  async create(collection: string, id: string, value: object): Promise<void> {
    const target = this.#collection(collection)
    if (target.has(id)) throw new Error('Document already exists.')
    target.set(id, structuredClone(value))
  }

  async read(collection: string, id: string): Promise<object | undefined> {
    const value = this.#collections.get(collection)?.get(id)
    return value ? structuredClone(value) : undefined
  }

  async write(collection: string, id: string, value: object): Promise<void> {
    this.#collection(collection).set(id, structuredClone(value))
  }

  async list(collection: string): Promise<readonly Readonly<{id: string; value: object}>[]> {
    return [...(this.#collections.get(collection)?.entries() ?? [])]
      .map(([id, value]) => ({id, value: structuredClone(value)}))
  }

  async purgePrefix(prefix: string): Promise<number> {
    let deleted = 0
    for (const collection of [...this.#collections.keys()]) {
      if (!collection.startsWith(prefix)) continue
      deleted += this.#collections.get(collection)?.size ?? 0
      this.#collections.delete(collection)
    }
    return deleted
  }

  collectionNames(): string[] {
    return [...this.#collections.keys()].sort()
  }

  #collection(name: string): Map<string, object> {
    const existing = this.#collections.get(name)
    if (existing) return existing
    const created = new Map<string, object>()
    this.#collections.set(name, created)
    return created
  }
}

type FirestoreDocumentSnapshotLike = Readonly<{
  exists: boolean
  data(): object | undefined
}>

type FirestoreDocumentReferenceLike = Readonly<{
  create(value: object): Promise<unknown>
  get(): Promise<FirestoreDocumentSnapshotLike>
  set(value: object): Promise<unknown>
  delete(): Promise<unknown>
}>

type FirestoreQueryDocumentSnapshotLike = Readonly<{
  id: string
  data(): object
  ref: FirestoreDocumentReferenceLike
}>

type FirestoreCollectionReferenceLike = Readonly<{
  id: string
  doc(id: string): FirestoreDocumentReferenceLike
  get(): Promise<Readonly<{docs: readonly FirestoreQueryDocumentSnapshotLike[]}>>
}>

export type FirestoreGatewayClient = Readonly<{
  collection(name: string): FirestoreCollectionReferenceLike
  listCollections(): Promise<readonly FirestoreCollectionReferenceLike[]>
}>

export class FirestoreGatewayDocumentBackend implements GatewayDocumentBackend {
  constructor(private readonly firestore: FirestoreGatewayClient) {}

  async create(collection: string, id: string, value: object): Promise<void> {
    try {
      await this.firestore.collection(collection).doc(id).create(structuredClone(value))
    } catch (error) {
      if ((error as {code?: number | string})?.code === 6
        || (error as {code?: number | string})?.code === 'already-exists') {
        throw new Error('Document already exists.')
      }
      throw error
    }
  }

  async read(collection: string, id: string): Promise<object | undefined> {
    const snapshot = await this.firestore.collection(collection).doc(id).get()
    const value = snapshot.data()
    return snapshot.exists && value ? structuredClone(value) : undefined
  }

  async list(collection: string): Promise<readonly Readonly<{id: string; value: object}>[]> {
    const snapshot = await this.firestore.collection(collection).get()
    return snapshot.docs.map(document => ({id: document.id, value: structuredClone(document.data())}))
  }

  async write(collection: string, id: string, value: object): Promise<void> {
    await this.firestore.collection(collection).doc(id).set(structuredClone(value))
  }

  async purgePrefix(prefix: string): Promise<number> {
    let deleted = 0
    const collections = await this.firestore.listCollections()
    for (const collection of collections) {
      if (!collection.id.startsWith(prefix)) continue
      const snapshot = await collection.get()
      for (const document of snapshot.docs) {
        await document.ref.delete()
        deleted += 1
      }
    }
    return deleted
  }
}

export class NamespacedGatewayDocumentStore {
  constructor(
    readonly backend: GatewayDocumentBackend,
    readonly collectionPrefix: string,
  ) {
    if (!/^antifraud_(?:demo|test_network|production)_$/u.test(collectionPrefix)) {
      throw new Error('A governed Antifraud collection prefix is required.')
    }
  }

  create(collection: string, id: string, value: object): Promise<void> {
    return this.backend.create(this.#collection(collection), id, value)
  }

  read(collection: string, id: string): Promise<object | undefined> {
    return this.backend.read(this.#collection(collection), id)
  }

  write(collection: string, id: string, value: object): Promise<void> {
    return this.backend.write(this.#collection(collection), id, value)
  }

  list(collection: string): Promise<readonly Readonly<{id: string; value: object}>[]> {
    return this.backend.list(this.#collection(collection))
  }

  purgeEnvironment(): Promise<number> {
    if (this.collectionPrefix !== 'antifraud_demo_') {
      throw new Error('Only the disposable Demo namespace may be purged through this operation.')
    }
    return this.backend.purgePrefix(this.collectionPrefix)
  }

  #collection(name: string): string {
    if (!/^[a-z][a-z0-9_]*$/u.test(name)) throw new Error('Invalid collection name.')
    return `${this.collectionPrefix}${name}`
  }
}

export interface GatewayObjectBackend {
  put(name: string, value: string): Promise<void>
  get(name: string): Promise<string | undefined>
}

export class InMemoryGatewayObjectBackend implements GatewayObjectBackend {
  readonly #objects = new Map<string, string>()

  async put(name: string, value: string): Promise<void> {
    if (this.#objects.has(name)) throw new Error('Object already exists.')
    this.#objects.set(name, value)
  }

  async get(name: string): Promise<string | undefined> {
    return this.#objects.get(name)
  }

  async raw(name: string): Promise<string> {
    const value = this.#objects.get(name)
    if (value === undefined) throw new Error('Object was not found.')
    return value
  }
}

export interface ConfidentialArtifactWallet {
  protectArtifact(owner: string, bytes: Uint8Array): Promise<string>
  unprotectArtifact(owner: string, sealed: string): Promise<Uint8Array>
}

type StoredArtifact = Readonly<{
  artifactId: string
  organizationReference: string
  mediaType: string
  fileName: string
  byteCount: number
  sealed: string
}>

export class ConfidentialArtifactStore {
  readonly #objects: GatewayObjectBackend
  readonly #wallet: ConfidentialArtifactWallet
  readonly #objectPrefix: string

  constructor(input: Readonly<{
    objects: GatewayObjectBackend
    wallet: ConfidentialArtifactWallet
    objectPrefix: string
  }>) {
    this.#objects = input.objects
    this.#wallet = input.wallet
    this.#objectPrefix = input.objectPrefix
  }

  async put(input: Readonly<{
    artifactId: string
    organizationReference: string
    mediaType: string
    fileName: string
    bytes: Uint8Array
  }>): Promise<Readonly<{artifactId: string; objectName: string; byteCount: number}>> {
    if (!input.bytes.byteLength) throw new Error('Artifact bytes are required.')
    const objectName = `${this.#objectPrefix}${Buffer.from(input.artifactId).toString('base64url')}.jwe.json`
    const sealed = await this.#wallet.protectArtifact(input.organizationReference, input.bytes)
    const stored: StoredArtifact = {
      artifactId: input.artifactId,
      organizationReference: input.organizationReference,
      mediaType: input.mediaType,
      fileName: input.fileName,
      byteCount: input.bytes.byteLength,
      sealed,
    }
    await this.#objects.put(objectName, JSON.stringify(stored))
    return Object.freeze({artifactId: input.artifactId, objectName, byteCount: input.bytes.byteLength})
  }

  async get(
    artifactId: string,
    authorizedOrganizationReference: string,
  ): Promise<Readonly<{mediaType: string; fileName: string; bytes: Uint8Array}>> {
    const objectName = `${this.#objectPrefix}${Buffer.from(artifactId).toString('base64url')}.jwe.json`
    const serialized = await this.#objects.get(objectName)
    if (!serialized) throw new Error('Artifact was not found.')
    const stored = JSON.parse(serialized) as StoredArtifact
    if (stored.organizationReference !== authorizedOrganizationReference) {
      throw new Error('Organization is not authorized to retrieve this artifact.')
    }
    const bytes = await this.#wallet.unprotectArtifact(stored.organizationReference, stored.sealed)
    if (bytes.byteLength !== stored.byteCount) throw new Error('Unsealed artifact byte count does not match.')
    return Object.freeze({mediaType: stored.mediaType, fileName: stored.fileName, bytes})
  }
}
