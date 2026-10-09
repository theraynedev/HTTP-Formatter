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

// curl's --data-urlencode: "name=value" encodes the value, "value" encodes all
// of it. File refs (@) can't be read here, so they're marked.
function encodeDataUrlencode(spec) {
  const eq = spec.indexOf('=')
  if (eq === -1) return encodeURIComponent(spec)
  const name = spec.slice(0, eq)
  const value = spec.slice(eq + 1)
  if (value.startsWith('@')) return `${name}=<file: ${value.slice(1)}>`
  return `${name}=${encodeURIComponent(value)}`
}

// Build a multipart/form-data body from repeated -F / --form fields
function buildMultipart(fields) {
  const boundary = `----HttpFormatterBoundary${Math.random().toString(36).slice(2)}`
  let body = ''
  for (const f of fields) {
    const eq = f.indexOf('=')
    const name = eq === -1 ? f : f.slice(0, eq)
    let value = eq === -1 ? '' : f.slice(eq + 1)
    if (value.startsWith('@')) value = `<file: ${value.slice(1)}>`
    body += `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
  }
  body += `--${boundary}--\r\n`
  return { body, boundary }
}

function parseCurl(raw, includeCookie) {
  const tokens = tokenize(normalizeCmd(raw))
  let url = ''
  const headers = []
  const dataParts = [] // repeated -d / --data join with & (matching curl)
  const formFields = [] // -F / --form -> multipart body
  let user = null
  let getFlag = false

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const next = () => (i + 1 < tokens.length ? tokens[++i] : '')

    if (t === '-H' || t === '--header') {
      headers.push(next())
    } else if (t === '-b' || t === '--cookie') {
      headers.push('cookie: ' + next())
    } else if (t === '-u' || t === '--user') {
      user = next()
    } else if (t === '-A' || t === '--user-agent') {
      headers.push('user-agent: ' + next())
    } else if (t === '-e' || t === '--referer') {
      headers.push('referer: ' + next())
    } else if (t === '--compressed') {
      headers.push('accept-encoding: gzip, deflate')
    } else if (t === '--url') {
      url = next()
    } else if (t === '-X' || t === '--request' || t === '--proxy') {
      next() // consumed; method comes from extractMethod
    } else if (
      t === '-k' || t === '--insecure' ||
      t === '-L' || t === '--location' ||
      t === '-i' || t === '--include' ||
      t === '-s' || t === '--silent' ||
      t === '-v' || t === '--verbose' ||
      t === '-I' || t === '--head'
    ) {
      // transport / output flags — no effect on the reconstructed request
    } else if (t === '-G' || t === '--get') {
      getFlag = true
    } else if (t === '-F' || t === '--form') {
      formFields.push(next())
    } else if (t === '--data-urlencode') {
      dataParts.push(encodeDataUrlencode(next()))
    } else if (
      t === '--data' || t === '-d' ||
      t === '--data-raw' || t === '--data-binary' || t === '--data-ascii'
    ) {
      let v = next()
      if (v.startsWith('@')) v = `<file: ${v.slice(1)}>`
      dataParts.push(v)
    } else if (!url && /^https?:\/\//i.test(t)) {
      url = t
    }
  }

  // -u user:pass -> Authorization: Basic, unless one was supplied explicitly
  const hasAuth = headers.some((h) => /^authorization:/i.test(h.trim()))
  if (user && !hasAuth) {
    try {
      headers.push(`authorization: Basic ${btoa(user)}`)
    } catch (_) {
      headers.push(`authorization: Basic ${user}`)
    }
  }

  let payload = ''
  if (formFields.length) {
    const { body, boundary } = buildMultipart(formFields)
    payload = body
    const hasCt = headers.some((h) => /^content-type:/i.test(h.trim()))
    if (!hasCt) headers.push(`content-type: multipart/form-data; boundary=${boundary}`)
  } else if (dataParts.length) {
    payload = dataParts.join('&')
  }

  // -G moves -d data into the query string and forces GET
  if (getFlag) {
    if (payload) {
      url += (url.includes('?') ? '&' : '?') + payload
      payload = ''
    }
    return finish(url, headers, payload, raw, 'GET', includeCookie)
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

// Return the balanced substring starting at `start` for the given delimiter
// pair, ignoring braces inside string literals. Returns null if unbalanced.
function readBalanced(src, start, open = '{', close = '}') {
  if (start < 0 || src[start] !== open) return null
  let depth = 0
  let inStr = null
  for (let i = start; i < src.length; i++) {
    const c = src[i]
    if (inStr) {
      if (c === '\\') { i++; continue }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'") { inStr = c; continue }
    if (c === open) depth++
    else if (c === close) {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return null
}

// Tolerantly read key/value string pairs from JS object source. Handles
// unquoted keys, single quotes and trailing commas — none of which JSON.parse
// accepts, and which caused headers/body to be dropped silently before.
function readObjectPairs(src) {
  const out = {}
  if (!src) return out
  const quoted = /(["'])([^"']*)\1\s*:\s*(["'])((?:(?!\3)[\s\S])*)\3/g
  const bare = /([A-Za-z_$][\w$-]*)\s*:\s*(["'])((?:(?!\2)[\s\S])*)\2/g
  for (const re of [quoted, bare]) {
    let m
    while ((m = re.exec(src)) !== null) {
      const key = re === quoted ? m[2] : m[1]
      const val = re === quoted ? m[4] : m[3]
      if (!(key in out)) out[key] = val
    }
  }
  return out
}

function parseFetch(raw, includeCookie) {
  const src = raw.replace(/`/g, '')
  const headers = []
  let payload = ''
  let method = 'GET'

  // URL: a literal, or a variable we can resolve from a nearby declaration
  const urlMatch = src.match(/fetch\(\s*["']([^"']+)["']/)
  let url = urlMatch ? urlMatch[1] : ''
  if (!url) {
    const varMatch = src.match(/fetch\(\s*([A-Za-z_$][\w$]*)/)
    if (varMatch) {
      const re = new RegExp(
        '(?:const|let|var)\\s+' + varMatch[1] + '\\s*=\\s*["\']([^"\']+)["\']',
      )
      const m = src.match(re)
      if (m) url = m[1]
    }
  }

  // Options object: the first balanced {...} after "fetch("
  const fetchIdx = src.indexOf('fetch(')
  const optsSrc = readBalanced(src, src.indexOf('{', fetchIdx))

  if (optsSrc) {
    const mMatch = optsSrc.match(/\bmethod\s*:\s*["']([A-Za-z]+)["']/)
    if (mMatch) method = mMatch[1].toUpperCase()

    // headers: an inline object or a variable holding one
    const hIdx = optsSrc.search(/\bheaders\s*:/)
    if (hIdx !== -1) {
      let hSrc = readBalanced(optsSrc, optsSrc.indexOf('{', hIdx))
      if (!hSrc) {
        const hVar = optsSrc.slice(hIdx).match(/\bheaders\s*:\s*([A-Za-z_$][\w$]*)/)
        if (hVar) {
          const def = src.match(
            new RegExp(
              '(?:const|let|var)\\s+' + hVar[1] + '\\s*=\\s*(\\{[\\s\\S]*?\\})',
            ),
          )
          if (def) hSrc = def[1]
        }
      }
      for (const [k, v] of Object.entries(readObjectPairs(hSrc))) {
        headers.push(k + ': ' + v)
      }
    }

    // body: JSON.stringify({...}) | 'literal' | "literal"
    const si = optsSrc.indexOf('JSON.stringify(')
    if (si !== -1) {
      const inner = readBalanced(optsSrc, optsSrc.indexOf('(', si), '(', ')')
      const candidate = (inner ?? '').replace(/^[(\s]+|[\s)]+$/g, '')
      const normalized = candidate.replace(
        /([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g,
        '$1"$2":',
      )
      try {
        payload = JSON.stringify(JSON.parse(candidate))
      } catch (_) {
        try {
          payload = JSON.stringify(JSON.parse(normalized))
        } catch (_2) {
          payload = candidate
        }
      }
    } else {
      const lit = optsSrc.match(/\bbody\s*:\s*(["'])((?:[\s\S](?!\1))*)\1/)
      if (lit) payload = lit[2]
    }

    if (payload && method === 'GET') method = 'POST'
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

      // Response metadata — only HAR carries this. Sizes are byte counts;
      // HAR uses -1 for "not available", so normalise those to null.
      const res = entry.response ?? {}
      const resContent = res.content ?? {}
      const bytes = v => {
        if (v === null || v === undefined || v === '') return null
        const n = Number(v)
        return Number.isFinite(n) && n >= 0 ? n : null
      }
      // Prefer the decoded payload size; fall back to the transfer size.
      const size = bytes(resContent.size) ?? bytes(res.bodySize)
      const headersSize = bytes(res.headersSize)

      return {
        url, baseUrl, queryParams, method, headers, payload, bodyIsJson, raw,
        size, headersSize, errors: [],
      }
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
