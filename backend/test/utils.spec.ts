import { strict as assert } from 'node:assert/strict'

import { parseHandle } from '../src/utils/parse'
import { urlToHandle } from '../src/utils/handle'

import { generateUserKey, unwrapPrivateKey, importPublicKey } from 'wildebeest/backend/src/utils/key-ops'
import { signRequest } from 'wildebeest/backend/src/utils/http-signing'
import { generateDigestHeader } from 'wildebeest/backend/src/utils/http-signing-cavage'
import { parseRequest } from 'wildebeest/backend/src/utils/httpsigjs/parser'
import { fetchKey, verifySignature } from 'wildebeest/backend/src/utils/httpsigjs/verifier'

describe('utils', () => {
	test('user key lifecycle', async () => {
		const userKEK = 'userkey'
		const userKeyPair = await generateUserKey(userKEK)
		await unwrapPrivateKey(userKEK, userKeyPair.wrappedPrivKey, userKeyPair.salt)
		await importPublicKey(userKeyPair.pubKey)
	})

	test('request signing', async () => {
		const body = '{"foo": "bar"}'
		const digest = await generateDigestHeader(body)
		const request = new Request('https://example.com', {
			method: 'POST',
			body: body,
			headers: { header1: 'value1', Digest: digest },
		})
		const userKEK = 'userkey'
		const userKeyPair = await generateUserKey(userKEK)
		const privateKey = await unwrapPrivateKey(userKEK, userKeyPair.wrappedPrivKey, userKeyPair.salt)
		const keyid = new URL('https://foo.com/key')
		await signRequest(request, privateKey, keyid)
		assert(request.headers.has('Signature'), 'no signature in signed request')

		const parsedSignature = parseRequest(request)
		const publicKey = await importPublicKey(userKeyPair.pubKey)
		assert(await verifySignature(parsedSignature, publicKey), 'verify signature failed')
	})

	test('handle parsing', async () => {
		let res

		res = parseHandle('')
		assert.equal(res.localPart, '')
		assert.equal(res.domain, null)

		res = parseHandle('@a')
		assert.equal(res.localPart, 'a')
		assert.equal(res.domain, null)

		res = parseHandle('a')
		assert.equal(res.localPart, 'a')
		assert.equal(res.domain, null)

		res = parseHandle('@a@remote.com')
		assert.equal(res.localPart, 'a')
		assert.equal(res.domain, 'remote.com')

		res = parseHandle('a@remote.com')
		assert.equal(res.localPart, 'a')
		assert.equal(res.domain, 'remote.com')

		res = parseHandle('a%40masto.ai')
		assert.equal(res.localPart, 'a')
		assert.equal(res.domain, 'masto.ai')
	})

	test('URL to handle', async () => {
		const res = urlToHandle(new URL('https://host.org/users/foobar'))
		assert.equal(res, 'foobar@host.org')
	})
})
