// Cloudflare Worker: OpenCode Go and Zen proxy with a shared access key.
const UPSTREAMS = {
  go: 'https://opencode.ai/inference/go',
  zen: 'https://opencode.ai/inference',
}
const SCHEMA_URL = 'https://opencode.ai/config.json'
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

// Only these upstream path prefixes are reachable through the proxy.
const ALLOWED_PATH = /^\/(?:zen\/)?(?:v1|openai\/v1|anthropic\/v1|google\/v1beta)\//

const MAX_BODY_BYTES = 32 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 5 * 60 * 1000

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

// Constant-time comparison for equal-length strings.
function safeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

function isAuthorized(request, env) {
  const provided = request.headers.get('x-proxy-key') ?? ''
  const expected = env.PROXY_KEY ?? ''
  if (!expected) return false
  return safeEqual(provided, expected)
}

// Reject separators that survive URL parsing, including double encoding.
function hasEncodedSeparator(pathname) {
  let value = pathname
  for (let depth = 0; depth < 4; depth += 1) {
    if (/%2f|%5c|%00/i.test(value)) return true
    const decoded = value.replace(/%25/gi, '%')
    if (decoded === value) return false
    value = decoded
  }
  return true
}

async function proxySchema() {
  try {
    const upstream = await fetch(SCHEMA_URL, {
      headers: { 'user-agent': BROWSER_UA },
      cf: { cacheTtl: 3600, cacheEverything: true },
    })

    const headers = new Headers(upstream.headers)
    headers.set('content-type', 'application/json; charset=utf-8')
    headers.set('cache-control', 'public, max-age=3600')
    headers.set('access-control-allow-origin', '*')
    headers.delete('set-cookie')

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    })
  } catch (error) {
    console.error('schema upstream failed', error)
    return json(502, { error: 'Schema upstream failed' })
  }
}

function forwardHeaders(request) {
  const headers = new Headers(request.headers)

  // Never forward the proxy key or client-identity headers upstream.
  for (const name of [
    'host',
    'x-proxy-key',
    'x-opencode-client',
    'x-client-version',
    'cookie',
    'origin',
    'referer',
    'cf-connecting-ip',
    'cf-worker',
    'cf-ray',
    'cf-ipcountry',
    'cf-visitor',
    'cdn-loop',
    'forwarded',
    'x-forwarded-for',
    'x-forwarded-host',
    'x-forwarded-proto',
    'x-real-ip',
    'x-api-key',
    'proxy-authorization',
    'true-client-ip',
    'connection',
    'keep-alive',
    'proxy-connection',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
  ]) {
    headers.delete(name)
  }

  headers.set('user-agent', BROWSER_UA)
  return headers
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/config.json') {
      if (request.method !== 'GET') {
        return json(405, { error: 'Method not allowed' })
      }
      return proxySchema()
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 })
    }

    if (!isAuthorized(request, env)) {
      return json(401, { error: 'Unauthorized' })
    }

    if (hasEncodedSeparator(url.pathname)) {
      return json(404, { error: 'Not found' })
    }

    if (!ALLOWED_PATH.test(url.pathname)) {
      return json(404, { error: 'Not found' })
    }

    const isCatalog = request.method === 'GET' && url.pathname.endsWith('/models')
    if (request.method !== 'POST' && !isCatalog) {
      return json(405, { error: 'Method not allowed' })
    }

    const length = Number(request.headers.get('content-length') ?? 0)
    if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
      return json(413, { error: 'Payload too large' })
    }

    const isZen = url.pathname === '/zen' || url.pathname.startsWith('/zen/')
    const upstreamPath = isZen ? url.pathname.slice('/zen'.length) : url.pathname
    const upstreamBase = isZen ? UPSTREAMS.zen : UPSTREAMS.go
    const destination = new URL(upstreamBase + upstreamPath + url.search)
    const expectedPrefix = isZen ? '/inference/' : '/inference/go/'
    if (!destination.pathname.startsWith(expectedPrefix)) {
      return json(404, { error: 'Not found' })
    }

    try {
      const upstream = await fetch(destination.toString(), {
        method: request.method,
        headers: forwardHeaders(request),
        body: request.method === 'GET' ? undefined : request.body,
        redirect: 'manual',
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      })

      const headers = new Headers(upstream.headers)
      headers.delete('set-cookie')

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      })
    } catch (error) {
      console.error('proxy upstream failed', error)
      return json(502, { error: 'Upstream request failed' })
    }
  },
}
