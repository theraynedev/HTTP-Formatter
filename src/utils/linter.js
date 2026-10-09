// ─── Header Linter ────────────────────────────────────────────────────────────
// Returns an array of lint issues: { level: 'warn'|'error'|'info', header: string|null, message: string }

const DEPRECATED = [
  'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version',
  'x-ua-compatible', 'pragma', 'expires',
]

const SECURITY_HEADERS = [
  'x-frame-options', 'x-content-type-options', 'strict-transport-security',
  'content-security-policy', 'referrer-policy',
]

export function lintHeaders(headers, method, url) {
  const issues = []
  const hMap = {}
  for (const h of headers) {
    const idx = h.indexOf(':')
    if (idx === -1) continue
    hMap[h.slice(0, idx).trim().toLowerCase()] = h.slice(idx + 1).trim()
  }

  const isHttps = /^https:/i.test(url)
  const isHttp = /^http:/i.test(url) && !/^https:/i.test(url)
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method?.toUpperCase())

  // ── HTTP instead of HTTPS
  if (isHttp) {
    issues.push({
      level: 'error',
      header: null,
      message: 'Request uses HTTP — credentials and tokens sent in plaintext.',
    })
  }

  // ── Authorization over HTTP
  if (isHttp && hMap['authorization']) {
    issues.push({
      level: 'error',
      header: 'authorization',
      message: 'Authorization header sent over HTTP — token is exposed.',
    })
  }

  // ── Missing Content-Type on body requests
  if (hasBody && !hMap['content-type']) {
    issues.push({
      level: 'warn',
      header: 'content-type',
      message: `Missing Content-Type header on ${method} request.`,
    })
  }

  // ── Deprecated headers
  for (const name of DEPRECATED) {
    if (hMap[name]) {
      issues.push({
        level: 'warn',
        header: name,
        message: `"${name}" is deprecated and should be removed.`,
      })
    }
  }

  // ── Wildcard CORS
  if (hMap['access-control-allow-origin'] === '*') {
    issues.push({
      level: 'warn',
      header: 'access-control-allow-origin',
      message: 'Wildcard CORS (Access-Control-Allow-Origin: *) allows any origin.',
    })
  }

  // ── Cookie size warning (> 4KB)
  if (hMap['cookie'] && hMap['cookie'].length > 4096) {
    issues.push({
      level: 'warn',
      header: 'cookie',
      message: `Cookie header is ${(hMap['cookie'].length / 1024).toFixed(1)} KB — browsers cap at 4 KB.`,
    })
  }

  // ── Accept header missing on GET
  if (method?.toUpperCase() === 'GET' && !hMap['accept']) {
    issues.push({
      level: 'info',
      header: 'accept',
      message: 'No Accept header — server may return any content type.',
    })
  }

  // ── Auth + no HTTPS note
  if (hMap['authorization'] && !isHttps && !isHttp) {
    issues.push({
      level: 'info',
      header: 'authorization',
      message: 'Verify this request uses HTTPS before sending.',
    })
  }

  // ── X-API-Key over non-HTTPS
  if (hMap['x-api-key'] && isHttp) {
    issues.push({
      level: 'error',
      header: 'x-api-key',
      message: 'API key sent over HTTP — key is exposed in plaintext.',
    })
  }

  // ── Duplicate host header
  const hostCount = headers.filter(h => h.toLowerCase().startsWith('host:')).length
  if (hostCount > 1) {
    issues.push({
      level: 'warn',
      header: 'host',
      message: 'Multiple Host headers detected — may cause routing issues.',
    })
  }

  // ── Content-Type mismatch: claims JSON but no valid JSON in body?
  // (surfaced from payload in OutputPanel — here just check if ct is set wrong)
  if (hMap['content-type']?.includes('application/json') && hMap['content-length'] === '0') {
    issues.push({
      level: 'warn',
      header: 'content-type',
      message: 'Content-Type is application/json but Content-Length is 0.',
    })
  }

  return issues
}

// Map a header name to its lint issues
export function lintIndex(issues) {
  const idx = {}
  for (const issue of issues) {
    if (!issue.header) continue
    if (!idx[issue.header]) idx[issue.header] = []
    idx[issue.header].push(issue)
  }
  return idx
}
