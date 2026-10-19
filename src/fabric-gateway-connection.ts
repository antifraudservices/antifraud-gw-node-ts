import { createPrivateKey } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import * as grpc from '@grpc/grpc-js'
import { connect, signers, type Gateway } from '@hyperledger/fabric-gateway'
import type { FabricChannelContractResolver, FabricTransactionContract } from './fabric-qualification-ledger.js'

export type FabricGatewayConnectionOptions = Readonly<{
  peerEndpoint: string
  peerHostAlias: string
  tlsRootCertificatePath: string
  mspId: string
  certificatePath: string
  privateKeyPath: string
  chaincodeName: string
}>

export type FabricGatewayConnection = Readonly<{
  resolveContract: FabricChannelContractResolver
  close(): void
}>

export async function connectFabricGateway(options: FabricGatewayConnectionOptions): Promise<FabricGatewayConnection> {
  const [tlsRootCertificate, credentials, privateKeyPem] = await Promise.all([
    readFile(options.tlsRootCertificatePath),
    readFile(options.certificatePath),
    readFile(options.privateKeyPath),
  ])
  const client = new grpc.Client(
    options.peerEndpoint,
    grpc.credentials.createSsl(tlsRootCertificate),
    {'grpc.ssl_target_name_override': options.peerHostAlias},
  )
  const gateway = connect({
    client,
    identity: {mspId: options.mspId, credentials},
    signer: signers.newPrivateKeySigner(createPrivateKey(privateKeyPem)),
    evaluateOptions: deadlineAfter(5_000),
    endorseOptions: deadlineAfter(15_000),
    submitOptions: deadlineAfter(5_000),
    commitStatusOptions: deadlineAfter(30_000),
  })
  const contracts = new Map<string, FabricTransactionContract>()
  return {
    async resolveContract(channel: string) {
      const existing = contracts.get(channel)
      if (existing) return existing
      const contract = wrapContract(gateway, channel, options.chaincodeName)
      contracts.set(channel, contract)
      return contract
    },
    close() {
      gateway.close()
      client.close()
    },
  }
}

function wrapContract(gateway: Gateway, channel: string, chaincodeName: string): FabricTransactionContract {
  const contract = gateway.getNetwork(channel).getContract(chaincodeName)
  return {
    async submit(transactionName: string, ...args: string[]) {
      const proposal = contract.newProposal(transactionName, {arguments: args})
      const transaction = await proposal.endorse()
      const commit = await transaction.submit()
      const status = await commit.getStatus()
      if (!status.successful) {
        throw new Error(`Fabric transaction ${status.transactionId} committed with status ${status.code}.`)
      }
      return {transactionId: transaction.getTransactionId(), result: transaction.getResult()}
    },
    evaluate(transactionName: string, ...args: string[]) {
      return contract.evaluate(transactionName, {arguments: args})
    },
  }
}

function deadlineAfter(milliseconds: number): () => grpc.CallOptions {
  return () => ({deadline: Date.now() + milliseconds})
}
