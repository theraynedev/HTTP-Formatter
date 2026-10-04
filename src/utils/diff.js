// Simple line-level diff for compare mode

export function diffLines(aLines, bLines) {
  // Returns array of { type: 'same'|'added'|'removed', value: string }
  const result = []
  const maxLen = Math.max(aLines.length, bLines.length)
  for (let i = 0; i < maxLen; i++) {
    const a = aLines[i]
    const b = bLines[i]
    if (a === b) {
      result.push({ type: 'same', left: a ?? '', right: b ?? '' })
    } else {
      result.push({ type: 'diff', left: a ?? '', right: b ?? '' })
    }
  }
  return result
}

export function diffObjects(a, b) {
  // JSON-aware diff: returns [{type, key, leftVal, rightVal}]
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])
  const result = []
  for (const k of allKeys) {
    const av = a[k]
    const bv = b[k]
    if (av === bv) result.push({ type: 'same', key: k, leftVal: av, rightVal: bv })
    else if (av === undefined) result.push({ type: 'added', key: k, leftVal: undefined, rightVal: bv })
    else if (bv === undefined) result.push({ type: 'removed', key: k, leftVal: av, rightVal: undefined })
    else result.push({ type: 'changed', key: k, leftVal: av, rightVal: bv })
  }
  return result
}

export function headersToObj(headers) {
  const obj = {}
  for (const h of headers) {
    const idx = h.indexOf(':')
    if (idx === -1) continue
    obj[h.slice(0, idx).trim().toLowerCase()] = h.slice(idx + 1).trim()
  }
  return obj
}
