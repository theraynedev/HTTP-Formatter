// ─── Response schema inference ────────────────────────────────────────────────
// Generates TypeScript interfaces and JSON Schema from a JSON value

function inferType(value, name = 'Root', depth = 0) {
  if (value === null) return { ts: 'null', json: { type: 'null' } }
  if (Array.isArray(value)) {
    if (value.length === 0) return { ts: 'unknown[]', json: { type: 'array', items: {} } }
    // Merge all element types
    const itemResults = value.map(v => inferType(v, name + 'Item', depth + 1))
    const tsTypes = [...new Set(itemResults.map(r => r.ts))]
    const tsType = tsTypes.length === 1 ? tsTypes[0] : `(${tsTypes.join(' | ')})`
    return { ts: `${tsType}[]`, json: { type: 'array', items: itemResults[0].json } }
  }
  if (typeof value === 'object') {
    const props = {}
    const required = []
    const jsonProps = {}
    for (const [k, v] of Object.entries(value)) {
      const child = inferType(v, k.charAt(0).toUpperCase() + k.slice(1), depth + 1)
      props[k] = child.ts
      jsonProps[k] = child.json
      required.push(k)
    }
    return {
      ts: props,
      json: { type: 'object', properties: jsonProps, required },
    }
  }
  if (typeof value === 'string') return { ts: 'string', json: { type: 'string' } }
  if (typeof value === 'number') return { ts: Number.isInteger(value) ? 'number' : 'number', json: { type: 'number' } }
  if (typeof value === 'boolean') return { ts: 'boolean', json: { type: 'boolean' } }
  return { ts: 'unknown', json: {} }
}

function renderTsInterface(name, props, interfaces = [], indent = 0) {
  if (typeof props !== 'object' || props === null || Array.isArray(props)) return ''
  const pad = '  '.repeat(indent)
  const lines = [`${pad}export interface ${name} {`]
  for (const [k, v] of Object.entries(props)) {
    const safeKey = /[^a-zA-Z0-9_]/.test(k) ? `'${k}'` : k
    if (typeof v === 'object' && !Array.isArray(v) && v !== null) {
      const childName = name + k.charAt(0).toUpperCase() + k.slice(1)
      lines.push(`${pad}  ${safeKey}: ${childName};`)
      interfaces.push({ name: childName, props: v })
    } else {
      lines.push(`${pad}  ${safeKey}: ${v};`)
    }
  }
  lines.push(`${pad}}`)
  return lines.join('\n')
}

export function generateTypeScript(jsonText) {
  try {
    const value = JSON.parse(jsonText)
    const root = inferType(value, 'Response')
    const interfaces = []
    let main = ''

    if (typeof root.ts === 'object' && !Array.isArray(root.ts)) {
      main = renderTsInterface('Response', root.ts, interfaces)
    } else {
      main = `export type Response = ${typeof root.ts === 'string' ? root.ts : JSON.stringify(root.ts)};`
    }

    // Render nested interfaces (collected during renderTsInterface)
    const nested = interfaces.map(i => renderTsInterface(i.name, i.props, [])).join('\n\n')
    return [main, nested].filter(Boolean).join('\n\n')
  } catch (_) {
    return '// Could not parse response as JSON'
  }
}

export function generateJsonSchema(jsonText) {
  try {
    const value = JSON.parse(jsonText)
    const { json } = inferType(value, 'Response')
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Response',
      ...json,
    }
    return JSON.stringify(schema, null, 2)
  } catch (_) {
    return '// Could not parse response as JSON'
  }
}
