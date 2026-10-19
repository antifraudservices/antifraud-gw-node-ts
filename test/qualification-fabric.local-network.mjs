// Journey: 1) connect to the one-peer local Fabric Gateway with the enrolled Host1 identity; 2) submit a privacy-minimized qualification anchor to the server-derived NA channel; 3) evaluate authoritative world state; 4) submit the issuer decision; 5) evaluate the final state. Authorization and persistence invariants: channel and chaincode are trusted process configuration, Fabric supplies both transaction IDs, encrypted claims and attachment bytes never enter the proposal, and readback comes from committed Fabric state rather than an in-memory substitute.
import assert from 'node:assert/strict'
import test from 'node:test'

import { connectFabricGateway, FabricIdentityEvidenceLedger, FabricQualificationLedger } from '../dist/index.js'

const required = name => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for the unskipped local-network gate.`)
  return value
}

test('commits and reads the qualification lifecycle on the real local Fabric network', async () => {
  const connection = await connectFabricGateway({
    peerEndpoint: required('ANTIFRAUD_FABRIC_PEER_ENDPOINT'),
    peerHostAlias: required('ANTIFRAUD_FABRIC_PEER_HOST_ALIAS'),
    tlsRootCertificatePath: required('ANTIFRAUD_FABRIC_TLS_ROOT_CERT'),
    mspId: required('ANTIFRAUD_FABRIC_MSP_ID'),
    certificatePath: required('ANTIFRAUD_FABRIC_CERTIFICATE'),
    privateKeyPath: required('ANTIFRAUD_FABRIC_PRIVATE_KEY'),
    chaincodeName: 'qualification-evidence-sc',
  })
  const identityConnection = await connectFabricGateway({
    peerEndpoint: required('ANTIFRAUD_FABRIC_PEER_ENDPOINT'),
    peerHostAlias: required('ANTIFRAUD_FABRIC_PEER_HOST_ALIAS'),
    tlsRootCertificatePath: required('ANTIFRAUD_FABRIC_TLS_ROOT_CERT'),
    mspId: required('ANTIFRAUD_FABRIC_MSP_ID'),
    certificatePath: required('ANTIFRAUD_FABRIC_CERTIFICATE'),
    privateKeyPath: required('ANTIFRAUD_FABRIC_PRIVATE_KEY'),
    chaincodeName: 'identity-evidence-sc',
  })
  try {
    const ledger = new FabricQualificationLedger(connection.resolveContract)
    const evidenceId = `evidence:qualification:local-network:${Date.now()}`
    const anchor = {
      evidenceId,
      subjectReference: 'person:opaque:local-network',
      employerOrganizationReference: 'organization:local-employer',
      issuerOrganizationReference: 'organization:local-issuer',
      qualificationReference: 'qualification:opaque:local-network',
      documentCid: 'z5Wzs7vSyntheticallyOpaqueCid',
      status: 'pending-issuer-confirmation',
      employerProofReference: `proof:employer:${evidenceId}`,
      recordedAt: '2027-01-15T08:00:00.000Z',
      updatedAt: '2027-01-15T08:00:00.000Z',
    }
    const created = await ledger.create('qualification-education-na', anchor)
    assert.match(created.transactionId, /^[a-f0-9]{64}$/u)
    assert.deepEqual(await ledger.read('qualification-education-na', evidenceId), anchor)

    const updated = await ledger.update('qualification-education-na', evidenceId, {
      status: 'confirmed',
      issuerProofReference: `proof:issuer:${evidenceId}`,
      updatedAt: '2027-01-15T09:00:00.000Z',
    })
    assert.match(updated.transactionId, /^[a-f0-9]{64}$/u)
    assert.equal((await ledger.read('qualification-education-na', evidenceId))?.status, 'confirmed')

    const identityLedger = new FabricIdentityEvidenceLedger(identityConnection.resolveContract)
    const identityEvidenceId = `identity-evidence:local-network:${Date.now()}`
    const identityAnchor = {
      evidenceId: identityEvidenceId,
      subjectReference: 'person:opaque:local-network',
      employerOrganizationReference: 'organization:local-employer',
      employeeReference: 'employee:local-controller',
      groupAuthorizationReference: 'authorization:local-controller-evidence',
      targetKinds: ['predicate'], status: 'recorded',
      employerProofReference: `proof:employer:${identityEvidenceId}`,
      recordedAt: '2027-01-15T08:00:00.000Z',
    }
    const identityCreated = await identityLedger.create('identity-global', identityAnchor)
    assert.match(identityCreated.transactionId, /^[a-f0-9]{64}$/u)
    assert.deepEqual(await identityLedger.read('identity-global', identityEvidenceId), identityAnchor)
  } finally {
    identityConnection.close()
    connection.close()
  }
})
