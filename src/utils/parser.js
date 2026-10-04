// ─── Constants ────────────────────────────────────────────────────────────────

export const SKIPPED_HEADERS = [
  'dnt', 'priority', 'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
  'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site',
  'authority', 'method', 'path', 'scheme',
]

export const SENSITIVE_HEADERS = [
  'authorization', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token',
  'x-access-token', 'x-secret', 'api-key', 'token', 'x-token',
  'proxy-authorization',
]

// ─── Normalizers ──────────────────────────────────────────────────────────────

function normalizeCmd(raw) {
  return raw
    .replace(/\^[ \t]*\r?\n[ \t]*/g, ' ')
    .replace(/\\\r?\n[ \t]*/g, ' ')
    .replace(/`/g, '')
    .replace(/\^\\\^/g, '\\')
    .replace(/\^"/g, '"')
    .replace(/\^([^\w\s])/g, '$1')
}

function tokenize(str) {
  const tokens = []
  let cur = ''
  let started = false
  let i = 0
  while (i < str.length) {
    const c = str[i]
    if (c === "'") {
      started = true; i++
      while (i < str.length && str[i] !== "'") { cur += str[i]; i++ }
      i++
    } else if (c === '"') {
      started = true; i++
      while (i < str.length && str[i] !== '"') {
        if (str[i] === '\\' && i + 1 < str.length) { cur += str[i + 1]; i += 2 }
        else { cur += str[i]; i++ }
      }
      i++
    } else if (c === '\\') {
      started = true; cur += str[i + 1] ?? ''; i += 2
    } else if (/\s/.test(c)) {
      if (started) { tokens.push(cur); cur = ''; started = false }
      i++
    } else {
      started = true; cur += c; i++
    }
  }
  if (started) tokens.push(cur)
  return tokens
}

function psUnescape(s) {
  return s.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

// ─── Method extraction ────────────────────────────────────────────────────────

function extractMethod(tokens, hasPayload) {
  for (let i = 0; i < tokens.length; i++) {
    if ((tokens[i] === '-X' || tokens[i] === '--request') && i + 1 < tokens.length) {
      return tokens[i + 1].toUpperCase()
    }
  }
  return hasPayload ? 'POST' : 'GET'
}

// ─── Individual parsers ───────────────────────────────────────────────────────

function parseCurl(raw, includeCookie) {
  const tokens = tokenize(normalizeCmd(raw))
  let url = ''
  const headers = []
  let payload = ''

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if ((t === '-H' || t === '--header') && i + 1 < tokens.length) {
      headers.push(tokens[++i])
    } else if ((t === '-b' || t === '--cookie') && i + 1 < tokens.length) {
      headers.push('cookie: ' + tokens[++i])
    } else if (
      (t === '--data-raw' || t === '--data-binary' || t === '--data-urlencode' ||
        t === '--data' || t === '-d') && i + 1 < tokens.length
    ) {
      payload = tokens[++i]
    } else if (!url && /^https?:\/\//i.test(t)) {
      url = t
    }
  }

  const method = extractMethod(tokens, !!payload)
  return finish(url, headers, payload, raw, method, includeCookie)
}

function parsePowerShell(raw, includeCookie) {
  const src = raw
    .replace(/"`(?=https?:)/g, '"')
    .replace(/`"[ \t]*`?[ \t]*$/gm, '"')
    .replace(/`"/g, '\\"')
    .replace(/`/g, '')

  const q = '"((?:\\\\.|[^"\\\\])*)"'
  const headers = []
  let payload = ''
  let method = 'GET'

  const urlMatch = src.match(new RegExp('-Uri\\s+' + q))
  const url = urlMatch ? psUnescape(urlMatch[1]) : ''

  const methodMatch = src.match(/-Method\s+["']?(\w+)["']?/i)
  if (methodMatch) method = methodMatch[1].toUpperCase()

  const blockMatch = src.match(/-Headers\s+@\{([\s\S]*?)\n\s*\}/)
  if (blockMatch) {
    const pairRegex = new RegExp(q + '\\s*=\\s*' + q, 'g')
    let m
    while ((m = pairRegex.exec(blockMatch[1])) !== null) {
      headers.push(psUnescape(m[1]) + ': ' + psUnescape(m[2]))
    }
  }

  const ctMatch = src.match(new RegExp('-ContentType\\s+' + q))
  if (ctMatch) headers.push('content-type: ' + psUnescape(ctMatch[1]))

  const bodyMatch = src.match(new RegExp('-Body\\s+' + q))
  if (bodyMatch) { payload = psUnescape(bodyMatch[1]); if (method === 'GET') method = 'POST' }

  const cookieMatch = src.match(/New-Object\s+System\.Net\.Cookie\(\s*"([^"]+)"\s*,\s*"([^"]+)"/)
  if (cookieMatch) headers.push('cookie: ' + cookieMatch[1] + '=' + cookieMatch[2])

  return finish(url, headers, payload, raw, method, includeCookie)
}

function parseFetch(raw, includeCookie) {
  const src = raw.replace(/`/g, '')
  const headers = []
  let payload = ''
  let method = 'GET'

  const urlMatch = src.match(/fetch\(\s*["'`]([^"'`]+)["'`]/)
  const url = urlMatch ? urlMatch[1] : ''

  const objMatch = src.match(/,\s*(\{[\s\S]*\})\s*\)\s*;?\s*$/)
  if (objMatch) {
    try {
      const opts = JSON.parse(objMatch[1])
      if (opts.method) method = opts.method.toUpperCase()
      if (opts.headers) {
        for (const [k, v] of Object.entries(opts.headers)) {
          headers.push(k + ': ' + v)
        }
      }
      if (typeof opts.body === 'string') {
        payload = opts.body
        if (method === 'GET') method = 'POST'
      }
    } catch (_) {
      // try regex fallback for method
      const mMatch = src.match(/method\s*:\s*["'](\w+)["']/)
      if (mMatch) method = mMatch[1].toUpperCase()
    }
  }

  return finish(url, headers, payload, raw, method, includeCookie)
}

// ─── Shared finish ────────────────────────────────────────────────────────────

function finish(url, headers, payload, raw, method = 'GET', includeCookie = true) {
  const cleaned = headers
    .map(h => h.replace(/^\s+/, '').replace(/\s+$/, ''))
    .filter(h => {
      if (!h) return false
      const name = h.split(':')[0].trim().toLowerCase()
      if (SKIPPED_HEADERS.includes(name)) return false
      if (!includeCookie && (name === 'cookie' || name === 'set-cookie')) return false
      return true
    })

  let body = payload
  let bodyIsJson = false
  try {
    const parsed = JSON.parse(body)
    body = JSON.stringify(parsed)
    bodyIsJson = true
  } catch (_) {}

  // Parse query params from URL
  let baseUrl = url
  let queryParams = []
  try {
    const u = new URL(url)
    baseUrl = u.origin + u.pathname
    queryParams = Array.from(u.searchParams.entries()).map(([k, v]) => ({
      key: k, value: v, enabled: true,
    }))
  } catch (_) {}

  return {
    url,
    baseUrl,
    queryParams,
    method,
    headers: cleaned,
    payload: body,
    bodyIsJson,
    raw,
  }
}

// ─── Main entry ───────────────────────────────────────────────────────────────

export function parseRequest(raw, includeCookie = true) {
  const errors = []
  if (!raw.trim()) {
    errors.push('Input is empty.')
    return { url: '', baseUrl: '', queryParams: [], method: 'GET', headers: [], payload: '', bodyIsJson: false, raw, errors }
  }

  let result
  try {
    if (/Invoke-WebRequest|Invoke-RestMethod/i.test(raw)) {
      result = parsePowerShell(raw, includeCookie)
    } else if (/fetch\s*\(/.test(raw)) {
      result = parseFetch(raw, includeCookie)
    } else {
      result = parseCurl(raw, includeCookie)
    }
  } catch (e) {
    errors.push('Parse error: ' + e.message)
    return { url: '', baseUrl: '', queryParams: [], method: 'GET', headers: [], payload: '', bodyIsJson: false, raw, errors }
  }

  if (!result.url) errors.push('No URL detected — make sure your command includes a valid http:// or https:// URL.')

  return { ...result, errors }
}

// ─── HAR import ───────────────────────────────────────────────────────────────

export function parseHar(harJson) {
  try {
    const har = typeof harJson === 'string' ? JSON.parse(harJson) : harJson
    const entries = har?.log?.entries ?? []
    return entries.map(entry => {
      const req = entry.request
      const url = req.url ?? ''
      const method = (req.method ?? 'GET').toUpperCase()
      const headers = (req.headers ?? [])
        .filter(h => {
          const n = h.name.toLowerCase()
          return !SKIPPED_HEADERS.includes(n) && !n.startsWith(':')
        })
        .map(h => `${h.name}: ${h.value}`)

      let payload = ''
      let bodyIsJson = false
      if (req.postData?.text) {
        payload = req.postData.text
        try { JSON.parse(payload); bodyIsJson = true } catch (_) {}
      }

      let baseUrl = url
      let queryParams = []
      try {
        const u = new URL(url)
        baseUrl = u.origin + u.pathname
        queryParams = Array.from(u.searchParams.entries()).map(([k, v]) => ({
          key: k, value: v, enabled: true,
        }))
      } catch (_) {}

      // Build synthetic curl as raw
      const hFlags = headers.map(h => `-H '${h}'`).join(' \\\n  ')
      const dataFlag = payload ? ` \\\n  --data-raw '${payload}'` : ''
      const raw = `curl -X ${method} '${url}' \\\n  ${hFlags}${dataFlag}`

      return { url, baseUrl, queryParams, method, headers, payload, bodyIsJson, raw, errors: [] }
    })
  } catch (e) {
    return []
  }
}

// ─── Reconstruct curl ─────────────────────────────────────────────────────────

export function reconstructCurl(parsed) {
  const { method, url, headers, payload } = parsed
  const parts = [`curl -X ${method} '${url}'`]
  for (const h of headers) parts.push(`  -H '${h}'`)
  if (payload) parts.push(`  --data-raw '${payload}'`)
  return parts.join(' \\\n')
}
