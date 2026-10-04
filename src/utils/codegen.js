// Code generation for multiple languages from a parsed request

function headersObj(headers) {
  const obj = {}
  for (const h of headers) {
    const idx = h.indexOf(':')
    if (idx === -1) continue
    obj[h.slice(0, idx).trim()] = h.slice(idx + 1).trim()
  }
  return obj
}

function jsHeaders(headers, indent = '  ') {
  const obj = headersObj(headers)
  if (!Object.keys(obj).length) return 'null'
  const lines = Object.entries(obj).map(([k, v]) => `${indent}  '${k}': '${v}'`)
  return `{\n${lines.join(',\n')}\n${indent}}`
}

function pyDictStr(obj, indent = '    ') {
  const lines = Object.entries(obj).map(([k, v]) => `${indent}"${k}": "${v}"`)
  return `{\n${lines.join(',\n')}\n}`
}

// ─── Generators ──────────────────────────────────────────────────────────────

export function genFetchJs(parsed) {
  const { method, url, headers, payload } = parsed
  const hObj = headersObj(headers)
  const hasHeaders = Object.keys(hObj).length > 0
  const opts = []
  opts.push(`  method: '${method}'`)
  if (hasHeaders) opts.push(`  headers: ${jsHeaders(headers)}`)
  if (payload) opts.push(`  body: ${JSON.stringify(payload)}`)

  return `const response = await fetch('${url}', {
${opts.join(',\n')}
});

const data = await response.json();
console.log(data);`
}

export function genAxiosJs(parsed) {
  const { method, url, headers, payload } = parsed
  const hObj = headersObj(headers)
  const hasHeaders = Object.keys(hObj).length > 0
  const parts = []
  parts.push(`  method: '${method.toLowerCase()}'`)
  parts.push(`  url: '${url}'`)
  if (hasHeaders) parts.push(`  headers: ${jsHeaders(headers)}`)
  if (payload) {
    try { parts.push(`  data: ${JSON.stringify(JSON.parse(payload), null, 4).split('\n').join('\n  ')}`) }
    catch (_) { parts.push(`  data: ${JSON.stringify(payload)}`) }
  }

  return `import axios from 'axios';

const { data } = await axios({
${parts.join(',\n')}
});

console.log(data);`
}

export function genPythonRequests(parsed) {
  const { method, url, headers, payload } = parsed
  const hObj = headersObj(headers)
  const hasHeaders = Object.keys(hObj).length > 0
  const lines = [`import requests`, ``]
  if (hasHeaders) lines.push(`headers = ${pyDictStr(hObj)}`, ``)

  let bodyArg = ''
  if (payload) {
    try {
      const parsed2 = JSON.parse(payload)
      lines.push(`payload = ${JSON.stringify(parsed2, null, 4)}`, ``)
      bodyArg = ', json=payload'
    } catch (_) {
      lines.push(`payload = ${JSON.stringify(payload)}`, ``)
      bodyArg = ', data=payload'
    }
  }

  const hArg = hasHeaders ? ', headers=headers' : ''
  lines.push(`response = requests.${method.toLowerCase()}(`)
  lines.push(`    '${url}'${hArg}${bodyArg}`)
  lines.push(`)`)
  lines.push(``, `print(response.json())`)
  return lines.join('\n')
}

export function genPythonHttpx(parsed) {
  const { method, url, headers, payload } = parsed
  const hObj = headersObj(headers)
  const hasHeaders = Object.keys(hObj).length > 0
  const lines = [`import httpx`, ``]
  if (hasHeaders) lines.push(`headers = ${pyDictStr(hObj)}`, ``)

  let bodyArg = ''
  if (payload) {
    try {
      const p = JSON.parse(payload)
      lines.push(`payload = ${JSON.stringify(p, null, 4)}`, ``)
      bodyArg = ', json=payload'
    } catch (_) {
      lines.push(`payload = ${JSON.stringify(payload)}`, ``)
      bodyArg = ', content=payload'
    }
  }

  const hArg = hasHeaders ? ', headers=headers' : ''
  lines.push(`with httpx.Client() as client:`)
  lines.push(`    response = client.${method.toLowerCase()}(`)
  lines.push(`        '${url}'${hArg}${bodyArg}`)
  lines.push(`    )`)
  lines.push(`    print(response.json())`)
  return lines.join('\n')
}

export function genNodeFetch(parsed) {
  const { method, url, headers, payload } = parsed
  const hObj = headersObj(headers)
  const hasHeaders = Object.keys(hObj).length > 0
  const opts = []
  opts.push(`  method: '${method}'`)
  if (hasHeaders) opts.push(`  headers: ${jsHeaders(headers)}`)
  if (payload) opts.push(`  body: ${JSON.stringify(payload)}`)

  return `import fetch from 'node-fetch';

const response = await fetch('${url}', {
${opts.join(',\n')}
});

const data = await response.json();
console.log(data);`
}

export function genGo(parsed) {
  const { method, url, headers, payload } = parsed
  const hObj = headersObj(headers)
  const lines = [
    `package main`,
    ``,
    `import (`,
    `\t"fmt"`,
    `\t"io"`,
    payload ? `\t"strings"` : null,
    `\t"net/http"`,
    `)`,
    ``,
    `func main() {`,
  ].filter(l => l !== null)

  if (payload) {
    lines.push(`\tbody := strings.NewReader(${JSON.stringify(payload)})`)
    lines.push(`\treq, _ := http.NewRequest("${method}", "${url}", body)`)
  } else {
    lines.push(`\treq, _ := http.NewRequest("${method}", "${url}", nil)`)
  }

  for (const [k, v] of Object.entries(hObj)) {
    lines.push(`\treq.Header.Set("${k}", "${v}")`)
  }

  lines.push(
    ``,
    `\tclient := &http.Client{}`,
    `\tresp, _ := client.Do(req)`,
    `\tdefer resp.Body.Close()`,
    `\tbody2, _ := io.ReadAll(resp.Body)`,
    `\tfmt.Println(string(body2))`,
    `}`,
  )
  return lines.join('\n')
}

export function genRuby(parsed) {
  const { method, url, headers, payload } = parsed
  const hObj = headersObj(headers)
  const lines = [
    `require 'net/http'`,
    `require 'uri'`,
    `require 'json'`,
    ``,
    `uri = URI.parse('${url}')`,
    `http = Net::HTTP.new(uri.host, uri.port)`,
    `http.use_ssl = uri.scheme == 'https'`,
    ``,
  ]

  const methodMap = {
    GET: 'Net::HTTP::Get', POST: 'Net::HTTP::Post',
    PUT: 'Net::HTTP::Put', PATCH: 'Net::HTTP::Patch', DELETE: 'Net::HTTP::Delete',
  }
  const reqClass = methodMap[method] ?? `Net::HTTP::${method.charAt(0) + method.slice(1).toLowerCase()}`
  lines.push(`request = ${reqClass}.new(uri.request_uri)`)

  for (const [k, v] of Object.entries(hObj)) {
    lines.push(`request['${k}'] = '${v}'`)
  }

  if (payload) {
    lines.push(`request.body = ${JSON.stringify(payload)}`)
  }

  lines.push(``, `response = http.request(request)`, `puts response.body`)
  return lines.join('\n')
}

export function genPhpCurl(parsed) {
  const { method, url, headers, payload } = parsed
  const hObj = headersObj(headers)
  const hArr = Object.entries(hObj).map(([k, v]) => `    '${k}: ${v}'`).join(",\n")
  const lines = [
    `<?php`,
    ``,
    `$ch = curl_init();`,
    ``,
    `curl_setopt_array($ch, [`,
    `    CURLOPT_URL => '${url}',`,
    `    CURLOPT_RETURNTRANSFER => true,`,
    `    CURLOPT_CUSTOMREQUEST => '${method}',`,
  ]

  if (hArr) {
    lines.push(`    CURLOPT_HTTPHEADER => [`)
    lines.push(hArr)
    lines.push(`    ],`)
  }

  if (payload) {
    lines.push(`    CURLOPT_POSTFIELDS => ${JSON.stringify(payload)},`)
  }

  lines.push(`]);`, ``, `$response = curl_exec($ch);`, `curl_close($ch);`, ``, `echo $response;`)
  return lines.join('\n')
}

export function genRustReqwest(parsed) {
  const { method, url, headers, payload } = parsed
  const hObj = headersObj(headers)
  const lines = [
    `use reqwest::header::{HeaderMap, HeaderName, HeaderValue};`,
    ``,
    `#[tokio::main]`,
    `async fn main() -> Result<(), reqwest::Error> {`,
    `    let client = reqwest::Client::new();`,
    ``,
  ]

  if (Object.keys(hObj).length) {
    lines.push(`    let mut headers = HeaderMap::new();`)
    for (const [k, v] of Object.entries(hObj)) {
      lines.push(`    headers.insert(HeaderName::from_static("${k.toLowerCase()}"), HeaderValue::from_static("${v}"));`)
    }
    lines.push(``)
  }

  const hArg = Object.keys(hObj).length ? `\n        .headers(headers)` : ''
  const bodyArg = payload ? `\n        .body(${JSON.stringify(payload)})` : ''
  const methodLower = method.toLowerCase()
  lines.push(`    let response = client.${methodLower}("${url}")${hArg}${bodyArg}`)
  lines.push(`        .send()`)
  lines.push(`        .await?;`)
  lines.push(``)
  lines.push(`    println!("{}", response.text().await?);`)
  lines.push(`    Ok(())`)
  lines.push(`}`)
  return lines.join('\n')
}

export function genCurlCmd(parsed) {
  const { method, url, headers, payload } = parsed
  const parts = [`curl -X ${method} '${url}'`]
  for (const h of headers) parts.push(`  -H '${h}'`)
  if (payload) parts.push(`  --data-raw '${payload}'`)
  return parts.join(' \\\n')
}

export function genPostmanCollection(parsed) {
  const { method, url, headers, payload } = parsed
  const hObj = headersObj(headers)
  const collection = {
    info: { name: 'Imported Request', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: [{
      name: url,
      request: {
        method,
        header: Object.entries(hObj).map(([key, value]) => ({ key, value })),
        url: { raw: url },
        ...(payload ? { body: { mode: 'raw', raw: payload, options: { raw: { language: 'json' } } } } : {}),
      },
    }],
  }
  return JSON.stringify(collection, null, 2)
}

// ─── Language list ────────────────────────────────────────────────────────────

export const LANGUAGES = [
  { id: 'curl',     label: 'cURL',              lang: 'bash',       gen: genCurlCmd },
  { id: 'fetch',    label: 'JS Fetch',           lang: 'javascript', gen: genFetchJs },
  { id: 'axios',    label: 'JS Axios',           lang: 'javascript', gen: genAxiosJs },
  { id: 'nodefetch',label: 'Node Fetch',         lang: 'javascript', gen: genNodeFetch },
  { id: 'python',   label: 'Python requests',    lang: 'python',     gen: genPythonRequests },
  { id: 'httpx',    label: 'Python httpx',       lang: 'python',     gen: genPythonHttpx },
  { id: 'go',       label: 'Go',                 lang: 'go',         gen: genGo },
  { id: 'ruby',     label: 'Ruby net/http',      lang: 'ruby',       gen: genRuby },
  { id: 'php',      label: 'PHP cURL',           lang: 'php',        gen: genPhpCurl },
  { id: 'rust',     label: 'Rust reqwest',       lang: 'rust',       gen: genRustReqwest },
  { id: 'postman',  label: 'Postman Collection', lang: 'json',       gen: genPostmanCollection },
]
