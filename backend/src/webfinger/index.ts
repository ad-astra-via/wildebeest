import { MastodonAccount } from '../types/account'
import * as config from 'wildebeest/backend/src/config'
import * as actors from '../activitypub/actors'
import type { Actor } from '../activitypub/actors'

export type WebFingerResponse = {
	subject: string
	aliases: Array<string>
	links: Array<any>
}

const headers = {
	accept: 'application/jrd+json',
}

export async function queryAcct(domain: string, acct: string): Promise<Actor | null> {
	const url = await queryAcctLink(domain, acct)
	if (url === null) {
		return null
	}
	return actors.get(url)
}

export async function queryAcctLink(domain: string, acct: string): Promise<URL | null> {
	const params = new URLSearchParams({ resource: `acct:${acct}` })
	let res
	try {
		const url = new URL('/.well-known/webfinger?' + params, 'https://' + domain)
		console.log('query', url.href)
		res = await fetch(url, { headers })
		if (!res.ok) {
			throw new Error(`WebFinger API returned: ${res.status}`)
		}
	} catch (err) {
		console.warn('failed to query WebFinger:', err)
		return null
	}

	const data = await res.json<WebFingerResponse>()
	for (let i = 0, len = data.links.length; i < len; i++) {
		const link = data.links[i]
		if (link.rel === 'self' && link.type === 'application/activity+json') {
			return new URL(link.href)
		}
	}

	return null
}
