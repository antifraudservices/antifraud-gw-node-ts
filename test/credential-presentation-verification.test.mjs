// Flow contract: authenticate a registered holder presentation, verify its issuer credential with pinned keys, reread current workforce/credential/use-policy records and consume its exact request once. Neither client-selected trust nor a valid signature alone grants access; test-memory records never claim a Fabric check.
import assert from 'node:assert/strict'
import {createHash, generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import test from 'node:test'
import {
  IdentityAttestationCapability,
  SyntheticConfidentialDocumentFixture,
  SyntheticManagedSignatureRequestFixture,
} from 'antifraud-data-utils-ts'
import {canonicalRequestDigest} from 'antifraud-data-utils-ts/clearing-house'
import * as gatewayApi from '../dist/index.js'

const shared = SyntheticManagedSignatureRequestFixture
const actor = Object.freeze({
  tenantId: shared.trustedContext.relyingParty,
  organizationReference: shared.trustedContext.relyingParty,
  employeeReference: shared.trustedContext.signerReference,
  assignmentReference: shared.trustedContext.authenticatedUserId,
  active: true,
  groupReferences: [shared.draft.operationId],
  capabilities: [IdentityAttestationCapability.VerifyClaim],
  groupAuthorization: {
    groupReference: shared.draft.operationId,
    authorizationReference: shared.draft.requestId,
    controllerReference: shared.trustedContext.authenticatedUserId,
    status: 'active', capabilities: [IdentityAttestationCapability.VerifyClaim],
  },
})
function signingKey() {
  const pair = generateKeyPairSync('ec', {namedCurve: 'P-384'})
  const jwk = pair.publicKey.export({format: 'jwk'})
  jwk.kid = createHash('sha256').update(JSON.stringify({crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y})).digest('base64url')
  jwk.alg = 'ES384'; jwk.use = 'sig'
  return {...pair, jwk}
}
function jwt(payload, key, extensions = {}) {
  const header = Buffer.from(JSON.stringify({alg: 'ES384', kid: key.jwk.kid, ...extensions})).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = sign('sha384', Buffer.from(`${header}.${body}`), {key: key.privateKey, dsaEncoding: 'ieee-p1363'}).toString('base64url')
  return `${header}.${body}.${signature}`
}
function fixture() {
  assert.equal(typeof gatewayApi.CredentialPresentationVerifier, 'function', 'The neutral gateway must expose its real presentation verifier.')
  const now = Math.floor(Date.parse(shared.draft.createdAt) / 1000)
  const holderKey = signingKey(), issuerKey = signingKey()
  const request = {
    nonce: randomUUID(), resourceReference: SyntheticConfidentialDocumentFixture.document.id,
    jurisdiction: 'CA', capability: IdentityAttestationCapability.VerifyClaim,
  }
  const holder = {
    actor: structuredClone(actor), holderReference: shared.trustedContext.registeredDeviceId,
    status: 'active', expiresAt: now + 300, jwks: {keys: [holderKey.jwk]},
  }
  const issuer = {issuer: actor.tenantId, status: 'active', jwks: {keys: [issuerKey.jwk]}}
  const credentialStatus = {id: shared.draft.requestId, issuer: issuer.issuer, status: 'active', expiresAt: now + 300}
  const permission = {tenantId: actor.tenantId, employeeReference: actor.employeeReference,
    organizationReference: actor.organizationReference, ...request, status: 'active',
    requiredCredentialTypes: ['VerifiableCredential'], expiresAt: now + 300}
  const authority = {
    kind: 'memory',
    async readHolder() {return holder}, async readIssuer() {return issuer},
    async readCredentialStatus() {return credentialStatus}, async readPermission() {return permission},
  }
  const replay = new gatewayApi.MemoryPresentationReplayStore()
  const verifier = new gatewayApi.CredentialPresentationVerifier({networkKind: 'test', authority, replay, clock: () => now})
  const credentialPayload = {iss: issuer.issuer, sub: actor.employeeReference, iat: now, exp: now + 120, jti: shared.draft.requestId,
    vc: {id: shared.draft.requestId, type: ['VerifiableCredential'], credentialSubject: {id: actor.employeeReference}}}
  const presentationPayload = {iss: holder.holderReference, sub: actor.employeeReference, aud: actor.tenantId,
    iat: now, exp: now + 60, jti: randomUUID(), nonce: request.nonce,
    request_hash: canonicalRequestDigest(request), vp: {verifiableCredential: [jwt(credentialPayload, issuerKey)]}}
  const signPresentation = (payload = presentationPayload, key = holderKey) => jwt(payload, key)
  return {now, request, holder, issuer, permission, credentialStatus, authority, replay, verifier,
    holderKey, issuerKey, credentialPayload, presentationPayload, signPresentation,
    input: () => ({actor, request, presentation: signPresentation()})}
}

test('rejects an unconfigured authority instead of selecting a verification fallback', () => {
  assert.equal(typeof gatewayApi.CredentialPresentationVerifier, 'function', 'The neutral gateway must expose its real presentation verifier.')
  assert.throws(() => new gatewayApi.CredentialPresentationVerifier({networkKind: 'test'}), /authority|configured|replay/i)
})
test('verifies real holder and issuer signatures with current records in the memory test network', async () => {
  const f = fixture()
  assert.deepEqual(await f.verifier.verify(f.input()), {
    verified: true, tenantReference: actor.tenantId, actorReference: actor.employeeReference,
    credentialReferences: [shared.draft.requestId], requestHash: canonicalRequestDigest(f.request),
    checkedAt: new Date(f.now * 1000).toISOString(), stateProvider: 'memory',
  })
})
test('rejects replay, including a concurrent reuse of the same signed presentation', async () => {
  const f = fixture(), input = f.input()
  const results = await Promise.allSettled([f.verifier.verify(input), f.verifier.verify(input)])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
  await assert.rejects(f.verifier.verify(input), /replay|already|reused/i)
})
test('rejects an altered holder signature and another key even when that key is embedded in the token', async () => {
  const f = fixture(), other = signingKey()
  await assert.rejects(f.verifier.verify({...f.input(), presentation: jwt(f.presentationPayload, other, {kid: f.holderKey.jwk.kid, jwk: other.jwk})}))
  const parts = f.signPresentation().split('.')
  parts[1] = Buffer.from(JSON.stringify({...f.presentationPayload, sub: shared.trustedContext.authenticatedUserId})).toString('base64url')
  await assert.rejects(f.verifier.verify({...f.input(), presentation: parts.join('.')}))
})
test('rejects expired presentation, changed audience, nonce, resource and requested policy', async () => {
  for (const patch of [{exp: 0}, {aud: shared.draft.operationId}, {nonce: shared.draft.operationId}, {request_hash: '0'.repeat(64)}]) {
    const f = fixture()
    await assert.rejects(f.verifier.verify({...f.input(), presentation: f.signPresentation({...f.presentationPayload, ...patch})}))
  }
  const f = fixture()
  await assert.rejects(f.verifier.verify({...f.input(), request: {...f.request, resourceReference: shared.draft.operationId}}))
})
test('rereads workforce, device, issuer and credential state rather than relying on old signed proof', async () => {
  for (const change of [f => {f.holder.status = 'inactive'}, f => {f.holder.actor.active = false},
    f => {f.holder.actor.groupAuthorization.status = 'inactive'}, f => {f.holder.actor.capabilities = []},
    f => {f.holder.actor.assignmentReference = ''}, f => {f.holder.jwks.keys = []},
    f => {f.issuer.status = 'inactive'}, f => {f.credentialStatus.status = 'revoked'},
    f => {f.permission.status = 'inactive'}, f => {f.permission.expiresAt = f.now - 1},
    f => {f.permission.jurisdiction = 'US'}, f => {f.permission.capability = IdentityAttestationCapability.RecordEvidence}]) {
    const f = fixture(); change(f)
    await assert.rejects(f.verifier.verify(f.input()))
  }
})
test('rejects a credential for another employee and a tampered issuer signature', async () => {
  for (const modify of [(f, payload) => ({...payload, sub: shared.trustedContext.authenticatedUserId}),
    (f, payload) => ({...payload, vc: {...payload.vc, credentialSubject: {id: shared.trustedContext.authenticatedUserId}}}),
    (f, payload) => ({...payload, vc: {...payload.vc, issuer: shared.draft.operationId}}),
    (f, payload) => ({...payload, vc: {...payload.vc, validUntil: new Date((f.now - 1) * 1000).toISOString()}}),
    (f, payload) => ({...payload, vc: {...payload.vc, validFrom: new Date((f.now + 300) * 1000).toISOString()}})]) {
    const f = fixture(), changed = jwt(modify(f, f.credentialPayload), f.issuerKey)
    await assert.rejects(f.verifier.verify({...f.input(), presentation: f.signPresentation({...f.presentationPayload, vp: {verifiableCredential: [changed]}})}))
  }
  const f = fixture(), forged = jwt(f.credentialPayload, signingKey())
  await assert.rejects(f.verifier.verify({...f.input(), presentation: f.signPresentation({...f.presentationPayload, vp: {verifiableCredential: [forged]}})}))
})
test('requires durable current state and replay storage outside memory test mode', () => {
  const f = fixture()
  for (const networkKind of ['local-network', 'test-network', 'network']) {
    assert.throws(() => new gatewayApi.CredentialPresentationVerifier({networkKind, authority: f.authority, replay: f.replay}), /durable|Fabric|fabric/i)
  }
})

test('verifies post-quantum holder and issuer signatures using the neutral cryptography provider', async () => {
  const {CryptographyService} = await import('antifraud-data-utils-ts')
  const {randomBytes} = await import('node:crypto')
  const crypto = new CryptographyService({
    getRandomBytes: async length => randomBytes(length), randomUUID,
    digestString: async (data, algorithm) => createHash(algorithm.replace('-', '').toLowerCase()).update(data).digest('hex'),
  })
  const f = fixture(), holderKey = await crypto.generateKeyPairMlDsa(undefined, 'ML-DSA-65'), issuerKey = await crypto.generateKeyPairMlDsa(undefined, 'ML-DSA-65')
  async function signed(payload, key) {
    const header = Buffer.from(JSON.stringify({alg: key.publicJWKey.alg, kid: key.publicJWKey.kid})).toString('base64url')
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
    const signature = await crypto.signBytes(Buffer.from(`${header}.${body}`), key.secretKeyBytes, key.publicJWKey.alg)
    return `${header}.${body}.${Buffer.from(signature).toString('base64url')}`
  }
  f.holder.jwks = {keys: [holderKey.publicJWKey]}; f.issuer.jwks = {keys: [issuerKey.publicJWKey]}
  const credential = await signed(f.credentialPayload, issuerKey)
  const presentation = await signed({...f.presentationPayload, vp: {verifiableCredential: [credential]}}, holderKey)
  const verifier = new gatewayApi.CredentialPresentationVerifier({networkKind: 'test', authority: f.authority, replay: f.replay, clock: () => f.now, cryptography: crypto})
  assert.equal((await verifier.verify({actor, request: f.request, presentation})).verified, true)
  const noCrypto = new gatewayApi.CredentialPresentationVerifier({networkKind: 'test', authority: f.authority, replay: new gatewayApi.MemoryPresentationReplayStore(), clock: () => f.now})
  await assert.rejects(noCrypto.verify({actor, request: f.request, presentation}), /post-quantum|verifier/i)
})

// Journey: 1. A signed backend login resolves the actor. 2. The registered device
// submits its signed presentation. 3. Current records authorize the exact use.
// 4. Replayed, unauthenticated, forged and client-selected authority fail closed.
// Authorization and persistence invariants: HTTP bodies never supply the actor
// or keys; a consumed presentation stays consumed for the serving process.
test('completes real signed HTTP verification and denies replay, forged identity and client-selected authority', async t => {
  const {createServer} = await import('node:http')
  const {once} = await import('node:events')
  const {verifyPinnedJwt} = await import('antifraud-data-utils-ts/clearing-house')
  const f = fixture(), authKey = signingKey()
  const bearer = jwt({iss: actor.tenantId, sub: actor.employeeReference, aud: actor.tenantId,
    iat: f.now, exp: f.now + 60, jti: randomUUID()}, authKey)
  const handler = gatewayApi.createAntifraudGatewayHttpHandler({
    gateway: new gatewayApi.EducationQualificationGateway({
      ledger: new gatewayApi.InMemoryQualificationLedger(), index: new gatewayApi.InMemoryAddressedReferenceIndex(),
      directory: new gatewayApi.StaticIssuerDirectory([]),
    }),
    presentationVerifier: f.verifier,
    async resolveActor(token) {
      try {
        const verified = await verifyPinnedJwt(token, {keys: [authKey.jwk]}, actor.tenantId, f.now, {audience: actor.tenantId})
        return verified.sub === actor.employeeReference ? actor : undefined
      } catch {return undefined}
    },
  })
  const server = createServer(handler)
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => {server.closeAllConnections(); server.close()})
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const endpoint = `http://127.0.0.1:${address.port}/v1/clearing-house/presentations/verify`
  async function post(body, credential = bearer) {
    const response = await fetch(endpoint, {method: 'POST', headers: {'content-type': 'application/json', ...(credential ? {authorization: `Bearer ${credential}`} : {})}, body: JSON.stringify(body)})
    return {status: response.status, body: await response.json()}
  }
  const body = {request: f.request, presentation: f.signPresentation()}
  assert.equal((await post(body, '')).status, 401)
  assert.equal((await post(body, bearer.slice(0, -8))).status, 401)
  const accepted = await post(body)
  assert.equal(accepted.status, 200)
  assert.equal(accepted.body.verified, true)
  assert.equal(accepted.body.stateProvider, 'memory')
  const repeated = await post(body)
  assert.equal(repeated.status, 400)
  assert.match(repeated.body.error, /already|replay/i)
  const injected = await post({...body, actor})
  assert.equal(injected.status, 400)
  assert.match(injected.body.error, /server-owned/i)
  assert.equal((await post({...body, request: {...f.request, jwks: {keys: [authKey.jwk]}}})).status, 400)
  const forged = await post({...body, presentation: f.signPresentation(f.presentationPayload, signingKey())})
  assert.equal(forged.status, 400)
  f.holder.actor.groupAuthorization.status = 'inactive'
  const inactive = await post({...body, presentation: f.signPresentation({...f.presentationPayload, jti: randomUUID()})})
  assert.equal(inactive.status, 400)
  assert.match(inactive.body.error, /authorization|membership/i)
})
