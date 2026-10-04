// Syntax highlighting utilities — returns HTML strings for dangerouslySetInnerHTML

import { SENSITIVE_HEADERS } from './parser.js'

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

export function highlightJson(json) {
  try {
    const pretty = JSON.stringify(JSON.parse(json), null, 2)
    return pretty.replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|(\btrue\b|\bfalse\b)|\bnull\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (match, str, colon, bool, num) => {
        if (str && colon) return `<span class="json-key">${esc(str)}</span>${esc(colon)}`
        if (str) return `<span class="json-string">${esc(str)}</span>`
        if (bool) return `<span class="json-bool">${esc(bool)}</span>`
        if (match === 'null') return `<span class="json-null">null</span>`
        if (num != null) return `<span class="json-number">${esc(num)}</span>`
        return esc(match)
      }
    )
  } catch (_) {
    return esc(json)
  }
}

// ─── URL ──────────────────────────────────────────────────────────────────────

export function highlightUrl(url) {
  try {
    const u = new URL(url)
    const scheme = esc(u.protocol + '//')
    const host = esc(u.hostname + (u.port ? ':' + u.port : ''))
    const path = esc(u.pathname)

    let query = ''
    const params = Array.from(u.searchParams.entries())
    if (params.length) {
      const parts = params.map(([k, v], i) => {
        const sep = i === 0 ? '?' : '&'
        return `<span class="url-query-sep">${esc(sep)}</span>` +
          `<span class="url-query-key">${esc(k)}</span>` +
          `<span class="url-query-sep">=</span>` +
          `<span class="url-query-val">${esc(v)}</span>`
      })
      query = parts.join('')
    }

    return `<span class="url-scheme">${scheme}</span>` +
      `<span class="url-host">${host}</span>` +
      `<span class="url-path">${path}</span>` +
      query
  } catch (_) {
    return esc(url)
  }
}

// ─── Headers ──────────────────────────────────────────────────────────────────

export function highlightHeaders(headers, maskSensitive = false) {
  return headers.map(h => {
    const idx = h.indexOf(':')
    if (idx === -1) return `<span class="hdr-value">${esc(h)}</span>`
    const name = h.slice(0, idx)
    const value = h.slice(idx + 1)
    const isSensitive = SENSITIVE_HEADERS.includes(name.trim().toLowerCase())
    const nameClass = isSensitive ? 'hdr-sensitive' : 'hdr-name'
    const displayValue = isSensitive && maskSensitive
      ? ' ' + '•'.repeat(Math.min(value.trim().length, 24))
      : esc(value)
    return `<span class="${nameClass}">${esc(name)}</span>` +
      `<span class="hdr-sep">:</span>` +
      `<span class="hdr-value">${displayValue}</span>`
  }).join('\n')
}
