// Flow contract: authenticate the organization caller, submit its tenant-signed presentation to the configured GXDCH endpoint, and accept only the pinned engine's signed SC credential with the configured rules and exact submitted credential IDs and hashes. The adapter is not a compliance engine, and the standard SC credential has no invented nonce requirement.
import assert from 'node:assert/strict'
import {createHash, generateKeyPairSync, randomUUID, sign} from 'node:crypto'
import {createServer} from 'node:http'
import {once} from 'node:events'
import test from 'node:test'
import {IdentityAttestationCapability, SyntheticManagedSignatureRequestFixture, SyntheticConfidentialDocumentFixture} from 'antifraud-data-utils-ts'
import {canonicalRequestDigest} from 'antifraud-data-utils-ts/clearing-house'
import * as gatewayApi from '../dist/index.js'

const shared = SyntheticManagedSignatureRequestFixture
function signingKey() {
  const key = generateKeyPairSync('ec', {namedCurve: 'P-384'})
  const jwk = key.publicKey.export({format: 'jwk'})
  jwk.kid = createHash('sha256').update(JSON.stringify({crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y})).digest('base64url')
  jwk.alg = 'ES384'; jwk.use = 'sig'
  return {...key, jwk}
}
function jwt(payload, key, typ) {
  const header = Buffer.from(JSON.stringify({alg: 'ES384', kid: key.jwk.kid, typ})).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.${sign('sha384', Buffer.from(`${header}.${body}`), {key: key.privateKey, dsaEncoding: 'ieee-p1363'}).toString('base64url')}`
}
async function fixture(t) {
  assert.equal(typeof gatewayApi.GaiaXComplianceVerifier, 'function', 'The neutral gateway must expose its pinned GXDCH result adapter.')
  const now = Math.floor(Date.parse(shared.draft.createdAt) / 1000), tenantKey = signingKey(), engineKey = signingKey()
  const actor = {tenantId: shared.trustedContext.relyingParty, organizationReference: shared.trustedContext.relyingParty,
    employeeReference: shared.trustedContext.signerReference, assignmentReference: shared.trustedContext.authenticatedUserId,
    active: true, groupReferences: [shared.draft.operationId], capabilities: [IdentityAttestationCapability.VerifyClaim],
    groupAuthorization: {groupReference: shared.draft.operationId, authorizationReference: shared.draft.requestId,
      controllerReference: shared.trustedContext.authenticatedUserId, status: 'active', capabilities: [IdentityAttestationCapability.VerifyClaim]}}
  const credential = {id: SyntheticConfidentialDocumentFixture.manifest.id, type: ['VerifiableCredential'],
    issuer: actor.tenantId, credentialSubject: {id: actor.organizationReference}}
  const rulesVersion = 'CD25.03' // Exact externally defined compliance profile selected for these tests.
  let enginePayload = {issuer: {id: shared.trustedContext.signerReference}, id: shared.draft.requestId,
    type: ['VerifiableCredential', 'gx:LabelCredential'],
    validFrom: new Date((now - 1) * 1000).toISOString(), validUntil: new Date((now + 60) * 1000).toISOString(),
    credentialSubject: {'gx:labelLevel': 'SC', 'gx:rulesVersion': rulesVersion,
      'gx:compliantCredentials': [{id: credential.id, digestSRI: `sha256-${canonicalRequestDigest(credential)}`}]}}
  const received = [], state = {active: true, forged: false, json: false, revokeOnResponse: false}
  const engine = createServer(async (request, response) => {
    let body = ''; for await (const chunk of request) body += chunk
    received.push({method: request.method, media: request.headers['content-type'], accept: request.headers.accept, body})
    if (state.revokeOnResponse) state.active = false
    response.writeHead(201, {'content-type': state.json ? 'application/json' : 'application/vc+jwt'})
    response.end(state.json ? '{}' : jwt(enginePayload, state.forged ? signingKey() : engineKey, 'vc+jwt'))
  })
  engine.listen(0, '127.0.0.1'); await once(engine, 'listening')
  t.after(() => {engine.closeAllConnections(); engine.close()})
  const previousEnvironment = process.env.NODE_ENV
  process.env.NODE_ENV = 'test'
  t.after(() => {if (previousEnvironment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnvironment})
  const address = engine.address(); assert.ok(address && typeof address === 'object')
  const authority = {async readSubmissionContext() {return state.active ? {
    actor, tenantIssuer: actor.tenantId, tenantKeys: {keys: [tenantKey.jwk]},
    trust: {endpoint: `http://127.0.0.1:${address.port}`, issuer: shared.trustedContext.signerReference,
      jwks: {keys: [engineKey.jwk]}, rulesVersion},
  } : undefined}}
  const verifier = new gatewayApi.GaiaXComplianceVerifier({authority, clock: () => now, allowLocalTestEndpoint: true})
  const presentation = jwt({iss: actor.tenantId, iat: now, exp: now + 60, jti: randomUUID(),
    vp: {type: ['VerifiablePresentation'], verifiableCredential: [credential]}}, tenantKey, 'vp+jwt')
  return {actor, presentation, verifier, received, state, enginePayload, credential, authority,
    replacePayload: value => {enginePayload = value}, tenantKey, now}
}

test('requires explicit current tenant authority for a GXDCH submission', () => {
  assert.equal(typeof gatewayApi.GaiaXComplianceVerifier, 'function', 'The neutral gateway must expose its pinned GXDCH result adapter.')
  assert.throws(() => new gatewayApi.GaiaXComplianceVerifier({}), /authority|configured/i)
})
test('verifies a signed SC credential from a real HTTP engine boundary without requiring a nonce', async t => {
  const f = await fixture(t), result = await f.verifier.verify({actor: f.actor, presentation: f.presentation})
  assert.equal(result.credential.id, shared.draft.requestId)
  assert.equal(typeof result.credentialJwt, 'string')
  assert.equal(Object.hasOwn(result.credential, 'nonce'), false)
  assert.equal(f.received.length, 1)
  assert.equal(f.received[0].media, 'application/vp+jwt')
  assert.equal(f.received[0].accept, 'application/vc+jwt')
  assert.equal(f.received[0].body, f.presentation)
})
test('rejects altered rules, label, expiry and missing, duplicate or substituted credential coverage', async t => {
  const f = await fixture(t)
  for (const patch of [
    {'gx:rulesVersion': 'unapproved-rules'}, {'gx:labelLevel': 'unapproved-label'},
    {'gx:compliantCredentials': []},
    {'gx:compliantCredentials': [{id: SyntheticConfidentialDocumentFixture.document.id, digestSRI: `sha256-${canonicalRequestDigest(f.credential)}`}]},
    {'gx:compliantCredentials': [{id: f.credential.id, digestSRI: 'sha256-' + '0'.repeat(64)}]},
    {'gx:compliantCredentials': [f.enginePayload.credentialSubject['gx:compliantCredentials'][0], f.enginePayload.credentialSubject['gx:compliantCredentials'][0]]},
  ]) {
    f.replacePayload({...f.enginePayload, credentialSubject: {...f.enginePayload.credentialSubject, ...patch}})
    await assert.rejects(f.verifier.verify({actor: f.actor, presentation: f.presentation}))
  }
  f.replacePayload({...f.enginePayload, validUntil: new Date((f.now - 1) * 1000).toISOString()})
  await assert.rejects(f.verifier.verify({actor: f.actor, presentation: f.presentation}), /valid|expir/i)
})
test('rejects forged engine signatures, unsigned JSON and another tenant before submission', async t => {
  const f = await fixture(t)
  f.state.forged = true
  await assert.rejects(f.verifier.verify({actor: f.actor, presentation: f.presentation}))
  f.state.forged = false; f.state.json = true
  await assert.rejects(f.verifier.verify({actor: f.actor, presentation: f.presentation}), /signed|media|credential/i)
  f.state.json = false
  const before = f.received.length
  await assert.rejects(f.verifier.verify({actor: {...f.actor, tenantId: shared.draft.operationId}, presentation: f.presentation}))
  f.state.active = false
  await assert.rejects(f.verifier.verify({actor: f.actor, presentation: f.presentation}))
  assert.equal(f.received.length, before)
})


test('rechecks current authority when it is withdrawn during engine validation', async t => {
  const f = await fixture(t)
  f.state.revokeOnResponse = true
  await assert.rejects(f.verifier.verify({actor: f.actor, presentation: f.presentation}), /authority|unavailable/i)
  assert.equal(f.received.length, 1)
})

test('exposes authenticated GXDCH submission through the gateway and rejects client-selected trust', async t => {
  const {verifyPinnedJwt} = await import('antifraud-data-utils-ts/clearing-house')
  const f = await fixture(t), authKey = signingKey()
  const bearer = jwt({iss: f.actor.tenantId, sub: f.actor.employeeReference, aud: f.actor.tenantId,
    iat: f.now, exp: f.now + 60, jti: randomUUID()}, authKey, 'JWT')
  const server = createServer(gatewayApi.createAntifraudGatewayHttpHandler({
    gateway: new gatewayApi.EducationQualificationGateway({ledger: new gatewayApi.InMemoryQualificationLedger(),
      index: new gatewayApi.InMemoryAddressedReferenceIndex(), directory: new gatewayApi.StaticIssuerDirectory([])}),
    gaiaXVerifier: f.verifier,
    async resolveActor(token) {
      try {
        const verified = await verifyPinnedJwt(token, {keys: [authKey.jwk]}, f.actor.tenantId, f.now, {audience: f.actor.tenantId})
        return verified.sub === f.actor.employeeReference ? f.actor : undefined
      } catch {return undefined}
    },
  }))
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  t.after(() => {server.closeAllConnections(); server.close()})
  const address = server.address(); assert.ok(address && typeof address === 'object')
  const endpoint = `http://127.0.0.1:${address.port}/v1/clearing-house/gaia-x/verify`
  async function post(body, credential = bearer) {
    const response = await fetch(endpoint, {method: 'POST', headers: {'content-type': 'application/json', ...(credential ? {authorization: `Bearer ${credential}`} : {})}, body: JSON.stringify(body)})
    return {status: response.status, body: await response.json()}
  }
  assert.equal((await post({presentation: f.presentation}, '')).status, 401)
  const result = await post({presentation: f.presentation})
  assert.equal(result.status, 200)
  assert.equal(result.body.credential.id, shared.draft.requestId)
  assert.equal((await post({presentation: f.presentation, trust: {keys: [authKey.jwk]}})).status, 400)
})
