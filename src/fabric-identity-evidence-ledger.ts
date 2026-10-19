import type {IdentityEvidenceAnchor, IdentityEvidenceLedger} from './index.js'
import type {FabricChannelContractResolver} from './fabric-qualification-ledger.js'

export class FabricIdentityEvidenceLedger implements IdentityEvidenceLedger {
  readonly #resolveContract: FabricChannelContractResolver
  constructor(resolveContract: FabricChannelContractResolver) { this.#resolveContract = resolveContract }

  async create(channel: 'identity-global', anchor: IdentityEvidenceAnchor): Promise<{transactionId: string; anchor: IdentityEvidenceAnchor}> {
    requireChannel(channel)
    const contract = await this.#resolveContract(channel)
    const submitted = await contract.submit('CreateIdentityEvidenceAnchor', anchor.evidenceId, JSON.stringify(anchor))
    return {transactionId: submitted.transactionId, anchor: parseAnchor(submitted.result)}
  }

  async read(channel: 'identity-global', evidenceId: string): Promise<IdentityEvidenceAnchor | undefined> {
    requireChannel(channel)
    const contract = await this.#resolveContract(channel)
    try {
      return parseAnchor(await contract.evaluate('ReadIdentityEvidenceAnchor', evidenceId))
    } catch (error) {
      if (error instanceof Error && /does not exist/u.test(error.message)) return undefined
      throw error
    }
  }
}
function requireChannel(channel: string): void {
  if (channel !== 'identity-global') throw new TypeError('Fabric identity evidence requires the identity-global channel.')
}
function parseAnchor(bytes: Uint8Array): IdentityEvidenceAnchor {
  const value: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'))
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Fabric returned an invalid identity evidence anchor.')
  return value as IdentityEvidenceAnchor
}
