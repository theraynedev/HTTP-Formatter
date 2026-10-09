// ─── Multipart / form-data body parser ───────────────────────────────────────

// Returns { isMultipart, isFormEncoded, fields: [{key, value, filename, contentType}] }
export function parseBody(payload, contentType) {
  const ct = (contentType ?? '').toLowerCase()

  // ── application/x-www-form-urlencoded ────────────────────────────────────
  if (ct.includes('application/x-www-form-urlencoded') || isFormEncoded(payload)) {
    const fields = parseFormEncoded(payload)
    if (fields.length) return { isMultipart: false, isFormEncoded: true, fields }
  }

  // ── multipart/form-data ───────────────────────────────────────────────────
  const boundaryMatch = ct.match(/boundary=([^\s;]+)/i)
  if (boundaryMatch || payload.includes('Content-Disposition')) {
    const boundary = boundaryMatch?.[1] ?? guessBoundary(payload)
    if (boundary) {
      const fields = parseMultipart(payload, boundary)
      if (fields.length) return { isMultipart: true, isFormEncoded: false, fields }
    }
  }

  return null
}

function isFormEncoded(payload) {
  if (!payload) return false
  // Looks like key=value&key2=value2 and is NOT JSON
  try { JSON.parse(payload); return false } catch (_) {}
  return /^[\w%+.-]+=[\w%+.&=-]*(&[\w%+.-]+=[\w%+.&=-]*)*$/.test(payload.trim())
}

function parseFormEncoded(payload) {
  try {
    return payload.split('&').map(pair => {
      const eq = pair.indexOf('=')
      const key = decodeURIComponent(eq === -1 ? pair : pair.slice(0, eq))
      const value = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1))
      return { key, value, filename: null, contentType: null }
    }).filter(f => f.key)
  } catch (_) {
    return []
  }
}

function guessBoundary(payload) {
  // Try to find the boundary from the first line of the payload
  const firstLine = payload.split(/\r?\n/)[0] ?? ''
  const m = firstLine.match(/^--(.+)$/)
  return m ? m[1] : null
}

function parseMultipart(payload, boundary) {
  const delimiter = '--' + boundary
  const parts = payload.split(new RegExp('(?:\\r?\\n)?' + escapeRegex(delimiter) + '(?:\\r?\\n|--)', 'g'))
  const fields = []

  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue
    // Split headers from body at double newline
    const sep = part.match(/\r?\n\r?\n/)
    if (!sep) continue
    const sepIdx = part.indexOf(sep[0])
    const headerBlock = part.slice(0, sepIdx)
    const body = part.slice(sepIdx + sep[0].length).replace(/\r?\n$/, '')

    // Parse headers
    const headerLines = headerBlock.split(/\r?\n/).filter(Boolean)
    let key = ''
    let filename = null
    let contentType = null

    for (const hl of headerLines) {
      const lower = hl.toLowerCase()
      if (lower.startsWith('content-disposition:')) {
        const nameMatch = hl.match(/name="([^"]+)"/)
        const fileMatch = hl.match(/filename="([^"]+)"/)
        if (nameMatch) key = nameMatch[1]
        if (fileMatch) filename = fileMatch[1]
      } else if (lower.startsWith('content-type:')) {
        contentType = hl.split(':').slice(1).join(':').trim()
      }
    }

    if (key) fields.push({ key, value: body, filename, contentType })
  }

  return fields
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── Converters ───────────────────────────────────────────────────────────────

// Convert fields array → JSON string
export function fieldsToJson(fields) {
  const obj = {}
  for (const f of fields) {
    // Skip file fields — they can't be JSON-serialised meaningfully
    if (f.filename) continue
    obj[f.key] = f.value
  }
  return JSON.stringify(obj, null, 2)
}

// Convert fields array → application/x-www-form-urlencoded string
export function fieldsToFormEncoded(fields) {
  return fields
    .filter(f => !f.filename)
    .map(f => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
    .join('&')
}

// Convert fields array back to multipart string with a given boundary
export function fieldsToMultipart(fields, boundary = '----FormBoundary') {
  const parts = fields.map(f => {
    const disp = f.filename
      ? `Content-Disposition: form-data; name="${f.key}"; filename="${f.filename}"`
      : `Content-Disposition: form-data; name="${f.key}"`
    const ct = f.contentType ? `\nContent-Type: ${f.contentType}` : ''
    return `--${boundary}\r\n${disp}${ct}\r\n\r\n${f.value}`
  })
  return parts.join('\r\n') + `\r\n--${boundary}--`
}
