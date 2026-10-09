// ─── Shareable link ───────────────────────────────────────────────────────────
// Encodes/decodes a minimal request snapshot into a URL ?q= param (base64url)
// NOTE: base64 is encoding, not encryption — anything in the link is readable.
// `redact` is the default for that reason.

import { SENSITIVE_HEADERS } from './parser.js'

const PARAM = 'q'
export const REDACTED = 'REDACTED'

// Query-string keys whose value should never travel in a share link
const SECRET_QUERY_KEYS = [
  'token', 'access_token', 'refresh_token', 'id_token', 'api_key', 'apikey',
  'key', 'secret', 'client_secret', 'password', 'passwd', 'pwd', 'sig',
  'signature', 'auth', 'session', 'sessionid', 'session_id', 'code', 'otp',
]

// JSON body keys whose value should never travel in a share link
const SECRET_BODY_KEYS = [
  'password', 'passwd', 'pwd', 'secret', 'token', 'access_token',
  'refresh_token', 'api_key', 'apikey', 'client_secret', 'private_key',
  'credit_card', 'cardnumber', 'card_number', 'cvv', 'ssn', 'otp', 'pin',
]

function toBase64Url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(str) {
  const padded = str + '==='.slice((str.length + 3) % 4)
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  return decodeURIComponent(escape(atob(b64)))
}

// "Authorization: Bearer abc" -> "Authorization: REDACTED"
// Keeps the scheme visible so the recipient still knows what kind of auth it is.
function redactHeaderValue(value) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return trimmed
  const match = trimmed.match(/^([A-Za-z][A-Za-z0-9._-]*)\s+(.+)$/)
  if (match && /^(Bearer|Basic|Token|Digest|Negotiate|Bearer\s*)$/i.test(match[1])) {
    return `${match[1]} ${REDACTED}`
  }
  return REDACTED
}

function isSecretKey(key) {
  const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '')
  return SECRET_QUERY_KEYS.some(
    (k) => normalized === k || normalized.endsWith(k) || normalized.startsWith(k),
  )
}

// Replace sensitive values in a URL's query string, leaving the shape intact
function redactUrl(url) {
  if (!url) return url
  const qIndex = url.indexOf('?')
  if (qIndex === -1) return url
  const base = url.slice(0, qIndex)
  const query = url.slice(qIndex + 1)
  const hashIndex = query.indexOf('#')
  const hash = hashIndex === -1 ? '' : query.slice(hashIndex)
  const pairs = (hashIndex === -1 ? query : query.slice(0, hashIndex)).split('&')
  const out = pairs.map((pair) => {
    if (!pair) return pair
    const eq = pair.indexOf('=')
    if (eq === -1) return isSecretKey(pair) ? `${pair}=${REDACTED}` : pair
    const key = pair.slice(0, eq)
    return isSecretKey(key) ? `${key}=${REDACTED}` : pair
  })
  return `${base}?${out.join('&')}${hash}`
}

// Deep-walk a parsed JSON body and mask secret-looking keys
function redactJsonValue(node, key) {
  if (node === null || node === undefined) return node
  if (Array.isArray(node)) return node.map((item) => redactJsonValue(item, key))
  if (typeof node === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(node)) {
      const lower = String(k).toLowerCase()
      const secret = SECRET_BODY_KEYS.some((s) => lower.includes(s))
      out[k] = secret ? REDACTED : redactJsonValue(v, k)
    }
    return out
  }
  if (key && isSecretKey(key)) return REDACTED
  return node
}

function redactPayload(payload, contentType = '') {
  if (!payload) return payload
  const ct = String(contentType).toLowerCase()

  if (ct.includes('json')) {
    try {
      const parsedJson = JSON.parse(payload)
      return JSON.stringify(redactJsonValue(parsedJson, null), null, 2)
    } catch (_) {
      // fall through to form handling
    }
  }

  if (ct.includes('form-urlencoded') || (!ct && /^[^\s=]+=[^\s=]*(&[^\s=]+=[^\s=]*)*$/.test(payload))) {
    return payload
      .split('&')
      .map((pair) => {
        const eq = pair.indexOf('=')
        if (eq === -1) return pair
        const key = pair.slice(0, eq)
        return isSecretKey(key) ? `${key}=${REDACTED}` : pair
      })
      .join('&')
  }

  // Unknown shape: last resort, mask bearer/basic-looking tokens inline
  return payload
    .replace(/(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{6,}/gi, `$1 ${REDACTED}`)
    .replace(/((?:password|passwd|pwd|token|secret|api[_-]?key)["']?\s*[:=]\s*["']?)([^"'\s&,}]{4,})/gi, `$1${REDACTED}`)
}

// Returns a copy of `parsed` safe to put in a URL
export function redactRequest(parsed) {
  if (!parsed) return parsed
  const headers = (parsed.headers ?? []).map((h) => {
    const idx = h.indexOf(':')
    if (idx === -1) return h
    const name = h.slice(0, idx)
    const value = h.slice(idx + 1)
    if (!SENSITIVE_HEADERS.includes(name.trim().toLowerCase())) return h
    return `${name}: ${redactHeaderValue(value)}`
  })

  const contentType = (parsed.headers ?? []).find(
    (h) => h.split(':')[0]?.trim().toLowerCase() === 'content-type',
  )

  return {
    ...parsed,
    url: redactUrl(parsed.url),
    headers,
    payload: redactPayload(parsed.payload ?? '', contentType ? contentType.slice(contentType.indexOf(':') + 1) : ''),
  }
}

// True when redaction actually changed something — used to warn the user
export function hasRedactableContent(parsed) {
  if (!parsed) return false
  const sensitiveHeader = (parsed.headers ?? []).some((h) =>
    SENSITIVE_HEADERS.includes(h.split(':')[0]?.trim().toLowerCase()),
  )
  if (sensitiveHeader) return true
  const redacted = redactRequest(parsed)
  return (
    redacted.url !== parsed.url ||
    (redacted.payload ?? '') !== (parsed.payload ?? '') ||
    redacted.headers.join('\n') !== (parsed.headers ?? []).join('\n')
  )
}

// Encode a parsed request into a shareable URL
export function buildShareUrl(parsed, { redact = true } = {}) {
  const source = redact ? redactRequest(parsed) : parsed
  const snapshot = {
    method: source.method,
    url: source.url,
    headers: source.headers,
    payload: source.payload ?? '',
  }
  const encoded = toBase64Url(JSON.stringify(snapshot))
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set(PARAM, encoded)
  return url.toString()
}

// Decode the ?q= param from the current URL into a synthetic curl command
// Returns null if no param present or decode fails
export function readShareParam() {
  try {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get(PARAM)
    if (!encoded) return null
    const snapshot = JSON.parse(fromBase64Url(encoded))
    if (!snapshot.url) return null

    // Reconstruct as a curl command so the existing parser handles it
    // Values are wrapped in single quotes with embedded quotes escaped so
    // payloads containing quotes or newlines survive the round trip.
    const quote = (v) => `'${String(v ?? '').replace(/'/g, `'\\''`)}'`
    const hFlags = (snapshot.headers ?? []).map(h => `-H ${quote(h)}`).join(' \\\n  ')
    const dataFlag = snapshot.payload ? ` \\\n  --data-raw ${quote(snapshot.payload)}` : ''
    const hPart = hFlags ? ` \\\n  ${hFlags}` : ''
    return `curl -X ${snapshot.method ?? 'GET'} ${quote(snapshot.url)}${hPart}${dataFlag}`
  } catch (_) {
    return null
  }
}

// Strip the ?q= param from the address bar without a page reload
export function clearShareParam() {
  const url = new URL(window.location.href)
  url.searchParams.delete(PARAM)
  window.history.replaceState({}, '', url.toString())
}
