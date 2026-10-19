import type { QualificationAnchor, QualificationLedger } from './index.js'

export type FabricTransactionResult = Readonly<{transactionId: string; result: Uint8Array}>
export interface FabricTransactionContract {
  submit(transactionName: string, ...args: string[]): Promise<FabricTransactionResult>
  evaluate(transactionName: string, ...args: string[]): Promise<Uint8Array>
}
export type FabricChannelContractResolver = (channel: string) => Promise<FabricTransactionContract>

const QUALIFICATION_CHANNEL = /^qualification-education-(eu|na)$/u

export class FabricQualificationLedger implements QualificationLedger {
  readonly #resolveContract: FabricChannelContractResolver

  constructor(resolveContract: FabricChannelContractResolver) {
    this.#resolveContract = resolveContract
  }

  async create(channel: string, anchor: QualificationAnchor): Promise<{transactionId: string; anchor: QualificationAnchor}> {
    const contract = await this.#contract(channel)
    const submitted = await contract.submit('CreateQualificationAnchor', anchor.evidenceId, JSON.stringify(anchor))
    return {transactionId: submitted.transactionId, anchor: parseAnchor(submitted.result)}
  }

  async update(
    channel: string,
    evidenceId: string,
    update: Pick<QualificationAnchor, 'status' | 'updatedAt' | 'issuerProofReference'>,
  ): Promise<{transactionId: string; anchor: QualificationAnchor}> {
    const contract = await this.#contract(channel)
    const submitted = await contract.submit('UpdateQualificationAnchor', evidenceId, JSON.stringify(update))
    return {transactionId: submitted.transactionId, anchor: parseAnchor(submitted.result)}
  }

  async read(channel: string, evidenceId: string): Promise<QualificationAnchor | undefined> {
    const contract = await this.#contract(channel)
    try {
      return parseAnchor(await contract.evaluate('ReadQualificationAnchor', evidenceId))
    } catch (error) {
      if (error instanceof Error && /does not exist/u.test(error.message)) return undefined
      throw error
    }
  }

  async #contract(channel: string): Promise<FabricTransactionContract> {
    if (!QUALIFICATION_CHANNEL.test(channel)) {
      throw new TypeError('Fabric qualification evidence requires a server-derived qualification-education channel.')
    }
    return this.#resolveContract(channel)
  }
}

function parseAnchor(bytes: Uint8Array): QualificationAnchor {
  const value: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Fabric returned an invalid qualification anchor.')
  }
  return value as QualificationAnchor
}
