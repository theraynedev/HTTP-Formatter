// ─── JWT decoder ─────────────────────────────────────────────────────────────

function base64UrlDecode(str) {
  // Pad, convert URL-safe chars, then decode
  const padded = str + '==='.slice((str.length + 3) % 4)
  const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return JSON.parse(decodeURIComponent(escape(atob(b64))))
  } catch (_) {
    return null
  }
}

export function decodeJwt(token) {
  if (!token) return null
  // Strip "Bearer " prefix if present
  const raw = token.replace(/^Bearer\s+/i, '').trim()
  const parts = raw.split('.')
  if (parts.length !== 3) return null

  const header = base64UrlDecode(parts[0])
  const payload = base64UrlDecode(parts[1])
  if (!header || !payload) return null

  const now = Math.floor(Date.now() / 1000)
  const exp = payload.exp ?? null
  const iat = payload.iat ?? null
  const nbf = payload.nbf ?? null

  let expiryStatus = 'none' // 'valid' | 'expired' | 'none'
  let secondsLeft = null
  if (exp !== null) {
    secondsLeft = exp - now
    expiryStatus = secondsLeft > 0 ? 'valid' : 'expired'
  }

  return {
    raw,
    header,
    payload,
    exp,
    iat,
    nbf,
    expiryStatus,
    secondsLeft,
    expiresAt: exp ? new Date(exp * 1000).toLocaleString() : null,
    issuedAt: iat ? new Date(iat * 1000).toLocaleString() : null,
  }
}

export function formatDuration(seconds) {
  if (seconds <= 0) return 'Expired'
  const abs = Math.abs(seconds)
  if (abs < 60) return `${abs}s`
  if (abs < 3600) return `${Math.floor(abs / 60)}m ${abs % 60}s`
  if (abs < 86400) return `${Math.floor(abs / 3600)}h ${Math.floor((abs % 3600) / 60)}m`
  return `${Math.floor(abs / 86400)}d ${Math.floor((abs % 86400) / 3600)}h`
}

// Extract the Authorization header value from parsed headers array
export function extractAuthHeader(headers) {
  for (const h of headers) {
    const lower = h.toLowerCase()
    if (lower.startsWith('authorization:')) {
      return h.slice('authorization:'.length).trim()
    }
  }
  return null
}
