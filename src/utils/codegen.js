// Code generation for multiple languages + security commands
import { generateJsonSchema } from "./schema.js";

function headersObj(headers) {
  const obj = {};
  for (const h of headers) {
    const idx = h.indexOf(":");
    if (idx === -1) continue;
    obj[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
  }
  return obj;
}

function jsHeaders(headers, indent = "  ") {
  const obj = headersObj(headers);
  if (!Object.keys(obj).length) return "null";
  const lines = Object.entries(obj).map(
    ([k, v]) => `${indent}  '${k}': '${v}'`,
  );
  return `{\n${lines.join(",\n")}\n${indent}}`;
}

function pyDictStr(obj, indent = "    ") {
  const lines = Object.entries(obj).map(([k, v]) => `${indent}"${k}": "${v}"`);
  return `{\n${lines.join(",\n")}\n}`;
}

// ─── Code generators ──────────────────────────────────────────────────────────

export function genFetchJs(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const hasHeaders = Object.keys(hObj).length > 0;
  const opts = [];
  opts.push(`  method: '${method}'`);
  if (hasHeaders) opts.push(`  headers: ${jsHeaders(headers)}`);
  if (payload) opts.push(`  body: ${JSON.stringify(payload)}`);
  return `const response = await fetch('${url}', {\n${opts.join(",\n")}\n});\n\nconst data = await response.json();\nconsole.log(data);`;
}

export function genAxiosJs(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const hasHeaders = Object.keys(hObj).length > 0;
  const parts = [];
  parts.push(`  method: '${method.toLowerCase()}'`);
  parts.push(`  url: '${url}'`);
  if (hasHeaders) parts.push(`  headers: ${jsHeaders(headers)}`);
  if (payload) {
    try {
      parts.push(
        `  data: ${JSON.stringify(JSON.parse(payload), null, 4).split("\n").join("\n  ")}`,
      );
    } catch (_) {
      parts.push(`  data: ${JSON.stringify(payload)}`);
    }
  }
  return `import axios from 'axios';\n\nconst { data } = await axios({\n${parts.join(",\n")}\n});\n\nconsole.log(data);`;
}

export function genPythonRequests(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const hasHeaders = Object.keys(hObj).length > 0;
  const lines = [`import requests`, ``];
  if (hasHeaders) lines.push(`headers = ${pyDictStr(hObj)}`, ``);
  let bodyArg = "";
  if (payload) {
    try {
      const p2 = JSON.parse(payload);
      lines.push(`payload = ${JSON.stringify(p2, null, 4)}`, ``);
      bodyArg = ", json=payload";
    } catch (_) {
      lines.push(`payload = ${JSON.stringify(payload)}`, ``);
      bodyArg = ", data=payload";
    }
  }
  const hArg = hasHeaders ? ", headers=headers" : "";
  lines.push(
    `response = requests.${method.toLowerCase()}(\n    '${url}'${hArg}${bodyArg}\n)`,
    ``,
    `print(response.json())`,
  );
  return lines.join("\n");
}

export function genPythonHttpx(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const hasHeaders = Object.keys(hObj).length > 0;
  const lines = [`import httpx`, ``];
  if (hasHeaders) lines.push(`headers = ${pyDictStr(hObj)}`, ``);
  let bodyArg = "";
  if (payload) {
    try {
      const p2 = JSON.parse(payload);
      lines.push(`payload = ${JSON.stringify(p2, null, 4)}`, ``);
      bodyArg = ", json=payload";
    } catch (_) {
      lines.push(`payload = ${JSON.stringify(payload)}`, ``);
      bodyArg = ", content=payload";
    }
  }
  const hArg = hasHeaders ? ", headers=headers" : "";
  lines.push(`with httpx.Client() as client:`);
  lines.push(
    `    response = client.${method.toLowerCase()}(\n        '${url}'${hArg}${bodyArg}\n    )`,
  );
  lines.push(`    print(response.json())`);
  return lines.join("\n");
}

export function genNodeFetch(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const hasHeaders = Object.keys(hObj).length > 0;
  const opts = [];
  opts.push(`  method: '${method}'`);
  if (hasHeaders) opts.push(`  headers: ${jsHeaders(headers)}`);
  if (payload) opts.push(`  body: ${JSON.stringify(payload)}`);
  return `import fetch from 'node-fetch';\n\nconst response = await fetch('${url}', {\n${opts.join(",\n")}\n});\n\nconst data = await response.json();\nconsole.log(data);`;
}

export function genGo(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
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
  ].filter((l) => l !== null);
  if (payload) {
    lines.push(`\tbody := strings.NewReader(${JSON.stringify(payload)})`);
    lines.push(`\treq, _ := http.NewRequest("${method}", "${url}", body)`);
  } else lines.push(`\treq, _ := http.NewRequest("${method}", "${url}", nil)`);
  for (const [k, v] of Object.entries(hObj))
    lines.push(`\treq.Header.Set("${k}", "${v}")`);
  lines.push(
    ``,
    `\tclient := &http.Client{}`,
    `\tresp, _ := client.Do(req)`,
    `\tdefer resp.Body.Close()`,
    `\tbody2, _ := io.ReadAll(resp.Body)`,
    `\tfmt.Println(string(body2))`,
    `}`,
  );
  return lines.join("\n");
}

export function genRuby(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const lines = [
    `require 'net/http'`,
    `require 'uri'`,
    `require 'json'`,
    ``,
    `uri = URI.parse('${url}')`,
    `http = Net::HTTP.new(uri.host, uri.port)`,
    `http.use_ssl = uri.scheme == 'https'`,
    ``,
  ];
  const methodMap = {
    GET: "Net::HTTP::Get",
    POST: "Net::HTTP::Post",
    PUT: "Net::HTTP::Put",
    PATCH: "Net::HTTP::Patch",
    DELETE: "Net::HTTP::Delete",
  };
  lines.push(
    `request = ${methodMap[method] ?? `Net::HTTP::${method.charAt(0) + method.slice(1).toLowerCase()}`}.new(uri.request_uri)`,
  );
  for (const [k, v] of Object.entries(hObj))
    lines.push(`request['${k}'] = '${v}'`);
  if (payload) lines.push(`request.body = ${JSON.stringify(payload)}`);
  lines.push(``, `response = http.request(request)`, `puts response.body`);
  return lines.join("\n");
}

export function genPhpCurl(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const hArr = Object.entries(hObj)
    .map(([k, v]) => `    '${k}: ${v}'`)
    .join(",\n");
  const lines = [
    `<?php`,
    ``,
    `$ch = curl_init();`,
    ``,
    `curl_setopt_array($ch, [`,
    `    CURLOPT_URL => '${url}',`,
    `    CURLOPT_RETURNTRANSFER => true,`,
    `    CURLOPT_CUSTOMREQUEST => '${method}',`,
  ];
  if (hArr) {
    lines.push(`    CURLOPT_HTTPHEADER => [`);
    lines.push(hArr);
    lines.push(`    ],`);
  }
  if (payload)
    lines.push(`    CURLOPT_POSTFIELDS => ${JSON.stringify(payload)},`);
  lines.push(
    `]);`,
    ``,
    `$response = curl_exec($ch);`,
    `curl_close($ch);`,
    ``,
    `echo $response;`,
  );
  return lines.join("\n");
}

export function genRustReqwest(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const lines = [
    `use reqwest::header::{HeaderMap, HeaderName, HeaderValue};`,
    ``,
    `#[tokio::main]`,
    `async fn main() -> Result<(), reqwest::Error> {`,
    `    let client = reqwest::Client::new();`,
    ``,
  ];
  if (Object.keys(hObj).length) {
    lines.push(`    let mut headers = HeaderMap::new();`);
    for (const [k, v] of Object.entries(hObj))
      lines.push(
        `    headers.insert(HeaderName::from_static("${k.toLowerCase()}"), HeaderValue::from_static("${v}"));`,
      );
    lines.push(``);
  }
  const hArg = Object.keys(hObj).length ? `\n        .headers(headers)` : "";
  const bodyArg = payload ? `\n        .body(${JSON.stringify(payload)})` : "";
  lines.push(
    `    let response = client.${method.toLowerCase()}("${url}")${hArg}${bodyArg}`,
  );
  lines.push(
    `        .send()`,
    `        .await?;`,
    ``,
    `    println!("{}", response.text().await?);`,
    `    Ok(())`,
    `}`,
  );
  return lines.join("\n");
}

export function genCurlCmd(parsed) {
  const { method, url, headers, payload } = parsed;
  const parts = [`curl -X ${method} '${url}'`];
  for (const h of headers) parts.push(`  -H '${h}'`);
  if (payload) parts.push(`  --data-raw '${payload}'`);
  return parts.join(" \\\n");
}

export function genWget(parsed) {
  const { method, url, headers, payload } = parsed;
  const parts = [`wget --method=${method}`, `  --output-document=-`];
  for (const h of headers) parts.push(`  --header='${h}'`);
  if (payload) parts.push(`  --body-data='${payload.replace(/'/g, "\\'")}'`);
  parts.push(`  '${url}'`);
  return parts.join(" \\\n");
}

export function genPostmanCollection(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const collection = {
    info: {
      name: "Imported Request",
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [
      {
        name: url,
        request: {
          method,
          header: Object.entries(hObj).map(([key, value]) => ({ key, value })),
          url: { raw: url },
          ...(payload
            ? {
                body: {
                  mode: "raw",
                  raw: payload,
                  options: { raw: { language: "json" } },
                },
              }
            : {}),
        },
      },
    ],
  };
  return JSON.stringify(collection, null, 2);
}

// ─── Security / attack command generators ────────────────────────────────────

function getAuthHeader(headers) {
  const hObj = headersObj(headers);
  return hObj["authorization"] ?? hObj["x-api-key"] ?? null;
}

function getCookieHeader(headers) {
  const hObj = headersObj(headers);
  return hObj["cookie"] ?? null;
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (_) {
    return url;
  }
}

function getPort(url, defaultPort = 80) {
  try {
    const u = new URL(url);
    return u.port || (u.protocol === "https:" ? "443" : "80");
  } catch (_) {
    return String(defaultPort);
  }
}

function getPath(url) {
  try {
    return new URL(url).pathname;
  } catch (_) {
    return "/";
  }
}

function getScheme(url) {
  try {
    return new URL(url).protocol.replace(":", "");
  } catch (_) {
    return "http";
  }
}

// Join command lines with proper shell continuations and append notes below.
// Lines must NOT carry their own trailing backslash — this adds them.
function shellBlock(cmdLines, notes = []) {
  const cmd = cmdLines.filter((l) => l !== null && l !== undefined).join(" \\\n");
  const noteLines = notes.filter((l) => l !== null && l !== undefined);
  return noteLines.length ? `${cmd}\n\n${noteLines.join("\n")}` : cmd;
}

// Path including the query string — required by hydra/sqlmap style targets
function getPathWithQuery(url) {
  try {
    const u = new URL(url);
    return u.pathname + (u.search || "");
  } catch (_) {
    return "/";
  }
}

// Extract login-related fields from payload for credential stuffing tools
function getCredFields(parsed) {
  const hObj = headersObj(parsed.headers);
  let userField = "username";
  let passField = "password";
  if (parsed.payload) {
    try {
      const obj = JSON.parse(parsed.payload);
      const keys = Object.keys(obj);
      // Guess user/pass field names
      const userKeys = keys.filter((k) =>
        /user|email|login|account|usr/i.test(k),
      );
      const passKeys = keys.filter((k) => /pass|pwd|secret|token/i.test(k));
      if (userKeys[0]) userField = userKeys[0];
      if (passKeys[0]) passField = passKeys[0];
    } catch (_) {
      // form-encoded
      const pairs = parsed.payload.split("&");
      for (const p of pairs) {
        const [k] = p.split("=");
        if (/user|email|login|account/i.test(k)) userField = k;
        if (/pass|pwd|secret/i.test(k)) passField = k;
      }
    }
  }
  return { userField, passField };
}

export function genHydra(parsed) {
  const host = getHostname(parsed.url);
  const port = getPort(parsed.url);
  const pathWithQuery = getPathWithQuery(parsed.url);
  const scheme = getScheme(parsed.url);
  const { userField, passField } = getCredFields(parsed);
  const hObj = headersObj(parsed.headers);
  const ct = hObj["content-type"] ?? "";
  const isJson = ct.includes("application/json");

  // Build the POST data template with HYDRA placeholders
  let postData = "";
  if (parsed.payload) {
    if (isJson) {
      try {
        const obj = JSON.parse(parsed.payload);
        obj[userField] = "^USER^";
        obj[passField] = "^PASS^";
        postData = JSON.stringify(obj);
      } catch (_) {
        postData = parsed.payload;
      }
    } else {
      postData = parsed.payload
        .split("&")
        .map((p) => {
          const eq = p.indexOf("=");
          const k = eq === -1 ? p : p.slice(0, eq);
          if (k === userField) return `${k}=^USER^`;
          if (k === passField) return `${k}=^PASS^`;
          return p;
        })
        .join("&");
    }
    // Guarantee the placeholders are present even if field names weren't detected
    if (!postData.includes("^USER^"))
      postData += `${postData ? "&" : ""}${userField}=^USER^`;
    if (!postData.includes("^PASS^"))
      postData += `${postData ? "&" : ""}${passField}=^PASS^`;
  } else {
    postData = `${userField}=^USER^&${passField}=^PASS^`;
  }

  // Hydra has NO -H flag. Custom headers belong inside the module string as
  // H= optional entries: "<path>:<params>:<fail>:<H=..>:<H=..>"
  const optionals = ["F=invalid"];
  for (const [k, v] of Object.entries(hObj)) {
    if (["content-length", "host"].includes(k.toLowerCase())) continue;
    optionals.push(`H=${k}: ${v}`);
  }

  const moduleStr = `${pathWithQuery}:${postData}:${optionals.join(":")}`;

  const lines = [
    `# Hydra — HTTP POST form brute-force`,
    `# Replace userlist.txt / passlist.txt with your wordlists.`,
    `# Update F=... to a string that appears ONLY on a failed login.`,
    `# Note: hydra has no -H flag — headers are H= entries in the module string.`,
    `# If the body contains colons and hydra mis-parses it, URL-encode the body.`,
    ``,
    `hydra \\`,
    `  -L userlist.txt \\`,
    `  -P passlist.txt \\`,
    `  -s ${port} \\`,
    `  -t 4 \\`,
    `  -f \\`,
    scheme === "https" ? `  -S \\` : null,
    `  ${host} \\`,
    `  http-post-form \\`,
    `  "${moduleStr.replace(/"/g, '\\"')}"`,
  ].filter((l) => l !== null);
  return lines.join("\n");
}

export function genMedusa(parsed) {
  const host = getHostname(parsed.url);
  const port = getPort(parsed.url);
  const pathWithQuery = getPathWithQuery(parsed.url);
  const scheme = getScheme(parsed.url);
  const { userField, passField } = getCredFields(parsed);
  const cookie = getCookieHeader(parsed.headers);

  const lines = [
    `# Medusa — HTTP web-form brute-force`,
    `# Check module options for your build with: medusa -M web-form -?`,
    `# Replace userlist.txt / passlist.txt with your wordlists.`,
    `# Update DENY-SIGNAL to a string that appears ONLY on a failed login.`,
    ``,
    `medusa \\`,
    `  -h ${host} \\`,
    `  -n ${port} \\`,
    `  -U userlist.txt \\`,
    `  -P passlist.txt \\`,
    `  -M web-form \\`,
    `  -m FORM:"${pathWithQuery}" \\`,
    `  -m FORM-DATA:"post?${userField}=MEDUSA_FORM_USER&${passField}=MEDUSA_FORM_PASS" \\`,
    `  -m DENY-SIGNAL:"invalid" \\`,
    cookie ? `  -m COOKIE:"${cookie.replace(/"/g, '\\"')}" \\` : null,
    `  -f`,
    scheme === "https" ? `` : null,
    scheme === "https" ? `# HTTPS: add -m SSL if your medusa build supports it.` : null,
  ].filter((l) => l !== null);
  return lines.join("\n");
}

export function genLegion(parsed) {
  const host = getHostname(parsed.url);
  const port = getPort(parsed.url);
  const scheme = getScheme(parsed.url);
  const lines = [
    `# Legion (successor to SECFORCE's Sparta)`,
    `# Run Legion's GUI and add the target, or use the CLI module:`,
    ``,
    `# Target info extracted from request:`,
    `#   Host:   ${host}`,
    `#   Port:   ${port}`,
    `#   Scheme: ${scheme}`,
    ``,
    `# Start Legion:`,
    `legion`,
    ``,
    `# Or run the underlying nmap discovery then Hydra via Legion's scheduler:`,
    `nmap -sV -p ${port} --script http-auth-finder ${host}`,
    ``,
    `# For HTTP brute-force Legion internally calls Hydra — configure via GUI`,
    `# with the target URL: ${parsed.url}`,
  ];
  return lines.join("\n");
}

export function genSqlmap(parsed) {
  const { url, method, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const cookie = getCookieHeader(headers);
  const auth = getAuthHeader(headers);

  const cmd = [`sqlmap`, `  -u "${url}"`, `  --method=${method}`];

  if (payload) cmd.push(`  --data="${payload.replace(/"/g, '\\"')}"`);
  if (cookie) cmd.push(`  --cookie="${cookie}"`);
  if (auth) cmd.push(`  --headers="Authorization: ${auth}"`);

  // Remaining custom headers (sqlmap takes --headers repeatedly)
  for (const [k, v] of Object.entries(hObj)) {
    if (["cookie", "authorization", "content-length"].includes(k.toLowerCase()))
      continue;
    cmd.push(`  --headers="${k}: ${v}"`);
  }

  cmd.push(`  --batch`, `  --random-agent`, `  --level=2`, `  --risk=1`);

  const notes = [
    `# SQLMap — automated SQL injection detection & exploitation`,
    `# Add --dbs to enumerate databases, --dump to extract data.`,
    `# Use --level=3 --risk=2 for deeper testing.`,
  ];

  const qs = [];
  try {
    new URL(url).searchParams.forEach((v, k) => qs.push(k));
  } catch (_) {}
  if (qs.length)
    notes.push(
      `# Likely injectable params: ${qs.join(", ")} — add -p <param> to target one.`,
    );
  else if (payload) notes.push(`# Target a POST field with: -p <field_name>`);
  else
    notes.push(
      `# No query params and no body — nothing injectable. Add params to the URL,`,
      `# or save this request to a file and run: sqlmap -r request.txt`,
    );

  return shellBlock(cmd, notes);
}

export function genNikto(parsed) {
  const host = getHostname(parsed.url);
  const port = getPort(parsed.url);
  const scheme = getScheme(parsed.url);
  const cookie = getCookieHeader(parsed.headers);
  const hObj = headersObj(parsed.headers);
  const auth = hObj["authorization"];

  const cmd = [`nikto`, `  -h ${scheme}://${host}`, `  -p ${port}`];

  // Nikto's -id takes "user:pass" for HTTP Basic auth (valid across versions).
  if (auth && /^basic /i.test(auth)) {
    try {
      const creds = atob(auth.slice(6));
      cmd.push(`  -id "${creds}"`);
    } catch (_) {}
  }

  cmd.push(
    `  -Tuning 123b`,
    `  -maxtime 300`,
    `  -Format txt`,
    `  -output nikto-report.txt`,
  );

  const notes = [`# Nikto — web server vulnerability scanner`];

  // There is no portable cookie flag across nikto versions — don't emit one.
  if (cookie)
    notes.push(
      `# A Cookie header is present but nikto has no portable cookie flag.`,
      `# Set it in nikto.conf, or pass -Plugins "cookies" if your build supports it.`,
    );

  return shellBlock(cmd, notes);
}

export function genWfuzz(parsed) {
  const { url, method, headers, payload } = parsed;
  const cookie = getCookieHeader(headers);
  const hObj = headersObj(headers);

  // Replace the first query param value or a path segment with FUZZ
  let fuzzUrl = url;
  try {
    const u = new URL(url);
    const params = Array.from(u.searchParams.keys());
    if (params.length) {
      u.searchParams.set(params[0], "FUZZ");
      fuzzUrl = u.toString();
    } else {
      fuzzUrl = url.replace(/\/([^/]+)$/, "/FUZZ");
    }
  } catch (_) {}

  const cmd = [`wfuzz`, `  -w wordlist.txt`, `  --hc 404,400`];

  for (const [k, v] of Object.entries(hObj)) {
    if (k.toLowerCase() === "content-length") continue;
    cmd.push(`  -H "${k}: ${v}"`);
  }

  if (payload && method !== "GET")
    cmd.push(`  -d "${payload.replace(/"/g, '\\"')}"`);
  if (method !== "GET") cmd.push(`  -X ${method}`);
  cmd.push(`  "${fuzzUrl}"`);

  const notes = [
    `# wfuzz — web fuzzer`,
    `# Replace wordlist.txt with your payload list (e.g. /usr/share/wfuzz/wordlist/general/common.txt)`,
    `# --hc hides responses by status code — adjust to filter noise.`,
    `# FUZZ marks the injection point: ${fuzzUrl}`,
  ];

  return shellBlock(cmd, notes);
}

export function genFfuf(parsed) {
  const { url, method, headers, payload } = parsed;
  const hObj = headersObj(headers);

  let fuzzUrl = url;
  try {
    const u = new URL(url);
    const params = Array.from(u.searchParams.keys());
    if (params.length) {
      u.searchParams.set(params[0], "FUZZ");
      fuzzUrl = u.toString();
    } else {
      fuzzUrl = url.replace(/\/?$/, "/FUZZ");
    }
  } catch (_) {}

  const cmd = [
    `ffuf`,
    `  -w wordlist.txt`,
    `  -u "${fuzzUrl}"`,
    `  -mc 200,201,301,302,403`,
  ];

  for (const [k, v] of Object.entries(hObj)) {
    if (k.toLowerCase() === "content-length") continue;
    cmd.push(`  -H "${k}: ${v}"`);
  }

  if (method !== "GET") cmd.push(`  -X ${method}`);
  if (payload && method !== "GET")
    cmd.push(`  -d "${payload.replace(/"/g, '\\"')}"`);

  cmd.push(`  -o ffuf-results.json`, `  -of json`);

  const notes = [
    `# ffuf — fast web fuzzer`,
    `# Replace wordlist.txt with e.g. /usr/share/seclists/Discovery/Web-Content/common.txt`,
    `# FUZZ marks the injection point: ${fuzzUrl}`,
    `# Add -fs 0 to filter empty responses, -t 40 to raise concurrency.`,
  ];

  return shellBlock(cmd, notes);
}

export function genGobuster(parsed) {
  const { url, headers } = parsed;
  const hObj = headersObj(headers);
  const cookie = getCookieHeader(headers);

  const cmd = [
    `gobuster dir`,
    `  -u "${url}"`,
    `  -w /usr/share/seclists/Discovery/Web-Content/common.txt`,
    `  -t 50`,
    `  -x php,html,js,txt,json`,
    `  -o gobuster-results.txt`,
  ];

  if (cookie) cmd.push(`  -c "${cookie}"`);

  for (const [k, v] of Object.entries(hObj)) {
    if (["cookie", "content-length", "host"].includes(k.toLowerCase()))
      continue;
    cmd.push(`  -H "${k}: ${v}"`);
  }

  const notes = [
    `# gobuster — directory/file & DNS brute-forcer`,
    `# Modes: dir (directories), dns (subdomains), vhost (virtual hosts)`,
    `# DNS subdomain enumeration:`,
    `# gobuster dns -d ${getHostname(url)} -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt`,
  ];

  return shellBlock(cmd, notes);
}

export function genHashcat(parsed) {
  // Hashcat is offline — it cracks a captured hash, it does not attack a live
  // endpoint. Never feed it an Authorization header value.
  const hashHint = "<PASTE_HASH_HERE>";

  return `# Hashcat — offline password hash cracking
# This does NOT attack the live endpoint. Capture a hash first, e.g.:
#   - HTTP Digest challenge:  curl -s -I --digest '${parsed.url}'
#   - Hashes from a leaked DB or /etc/
# Basic auth is plaintext base64 — decode it, never crack it:
#   echo '<basic value>' | base64 -d
# Identify the mode with: hashid '<hash>'
# Common attack modes: -a 0 (dictionary), -a 3 (brute-force mask)
# Common hash types: -m 0 (MD5), -m 1000 (NTLM), -m 1800 (sha512crypt), -m 3200 (bcrypt)

# Dictionary attack:
hashcat \\
  -m 0 \\
  -a 0 \\
  '${hashHint}' \\
  /usr/share/wordlists/rockyou.txt \\
  --force

# Brute-force (up to 8 chars, lower+digits):
hashcat \\
  -m 0 \\
  -a 3 \\
  '${hashHint}' \\
  '?l?l?l?l?d?d?d?d' \\
  --force`;
}

export function genCurlReplay(parsed) {
  const { method, url, headers, payload } = parsed;
  const hFlags = headers.map((h) => `-H '${h}'`).join(" \\\n  ");
  const dataFlag = payload ? ` \\\n  --data-raw '${payload}'` : "";
  return `#!/usr/bin/env bash
# Replay this request in a loop — useful for timing attacks or rate-limit testing
# Adjust COUNT and DELAY as needed

COUNT=10
DELAY=0.5   # seconds between requests

for i in $(seq 1 $COUNT); do
  echo "--- Request $i ---"
  curl -s -o /dev/null -w "Status: %{http_code}  Time: %{time_total}s\\n" \\
    -X ${method} '${url}' \\
    ${hFlags}${dataFlag}
  sleep $DELAY
done`;
}

export function genMsfConsole(parsed) {
  const { url, method, headers, payload } = parsed;
  const hObj = headersObj(parsed.headers);
  const host = getHostname(url);
  const port = getPort(url);
  const path = getPath(url);
  const scheme = getScheme(url);
  const ssl = scheme === "https";

  const rhosts = host;
  const lines = [
    `# Metasploit Framework — HTTP auxiliary scanner`,
    `# Paste these commands into msfconsole`,
    ``,
    `use auxiliary/scanner/http/http_login`,
    `set RHOSTS ${rhosts}`,
    `set RPORT ${port}`,
    `set SSL ${ssl}`,
    `set AUTH_URI ${path}`,
    `set VHOST ${host}`,
    `set STOP_ON_SUCCESS true`,
    `set BRUTEFORCE_SPEED 3`,
    `set USER_FILE /usr/share/seclists/Usernames/top-usernames-shortlist.txt`,
    `set PASS_FILE /usr/share/seclists/Passwords/Common-Credentials/10k-most-common.txt`,
  ];

  // http_login has no COOKIE option — surface it as a note instead of an
  // invalid `set` that makes msfconsole error out.
  const cookie = getCookieHeader(headers);
  if (cookie) lines.push(`# Cookie present: ${cookie}`);

  const ct = hObj["content-type"];
  if (ct) lines.push(`# Content-Type hint: ${ct}`);

  lines.push(
    ``,
    `run`,
    ``,
    `# For web application scanning:`,
    `use auxiliary/scanner/http/options`,
    `set RHOSTS ${rhosts}`,
    `set RPORT ${port}`,
    `run`,
  );
  return lines.join("\n");
}

// ─── Java / C# / OpenAPI generators ──────────────────────────────────────────

function javaStr(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "");
}

// C# verbatim string: quotes are doubled
function csharpVerbatim(s) {
  return String(s).replace(/"/g, '""');
}

export function genJavaOkHttp(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const lines = [
    `import java.io.IOException;`,
    `import okhttp3.*;`,
    ``,
    `public class Main {`,
    `  public static void main(String[] args) throws IOException {`,
    `    OkHttpClient client = new OkHttpClient();`,
    ``,
  ];
  if (payload) {
    const ct = hObj["content-type"] ?? "application/json";
    lines.push(
      `    MediaType mediaType = MediaType.parse("${ct}");`,
      `    RequestBody body = RequestBody.create(mediaType, "${javaStr(payload)}");`,
      ``,
    );
  }
  lines.push(`    Request.Builder builder = new Request.Builder()`);
  lines.push(`        .url("${javaStr(url)}");`);
  for (const [k, v] of Object.entries(hObj))
    lines.push(`    builder.addHeader("${javaStr(k)}", "${javaStr(v)}");`);
  lines.push(
    `    builder.method("${method}", ${payload ? "body" : "null"});`,
    ``,
    `    Request request = builder.build();`,
    `    try (Response response = client.newCall(request).execute()) {`,
    `      System.out.println(response.body().string());`,
    `    }`,
    `  }`,
    `}`,
  );
  return lines.join("\n");
}

export function genJavaNetHttp(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const lines = [
    `import java.net.URI;`,
    `import java.net.http.HttpClient;`,
    `import java.net.http.HttpRequest;`,
    `import java.net.http.HttpResponse;`,
    ``,
    `public class Main {`,
    `  public static void main(String[] args) throws Exception {`,
    `    HttpClient client = HttpClient.newHttpClient();`,
    ``,
    `    HttpRequest.Builder builder = HttpRequest.newBuilder()`,
    `        .uri(URI.create("${javaStr(url)}"));`,
    ``,
  ];
  for (const [k, v] of Object.entries(hObj))
    lines.push(`    builder.header("${javaStr(k)}", "${javaStr(v)}");`);
  lines.push(``);
  if (payload) {
    lines.push(
      `    builder.method(`,
      `        "${method}",`,
      `        HttpRequest.BodyPublishers.ofString("${javaStr(payload)}"));`,
    );
  } else {
    lines.push(`    builder.method("${method}", HttpRequest.BodyPublishers.noBody());`);
  }
  lines.push(
    ``,
    `    HttpRequest request = builder.build();`,
    `    HttpResponse<String> response =`,
    `        client.send(request, HttpResponse.BodyHandlers.ofString());`,
    ``,
    `    System.out.println(response.statusCode());`,
    `    System.out.println(response.body());`,
    `  }`,
    `}`,
  );
  return lines.join("\n");
}

export function genCsharpHttpClient(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  const lines = [
    `using System;`,
    `using System.Net.Http;`,
    `using System.Text;`,
    `using System.Threading.Tasks;`,
    ``,
    `class Program`,
    `{`,
    `    static async Task Main()`,
    `    {`,
    `        using var client = new HttpClient();`,
    ``,
    `        var request = new HttpRequestMessage(new HttpMethod("${method}"), "${csharpVerbatim(url)}");`,
  ];
  for (const [k, v] of Object.entries(hObj))
    lines.push(`        request.Headers.TryAddWithoutValidation("${csharpVerbatim(k)}", "${csharpVerbatim(v)}");`);
  if (payload) {
    const ct = hObj["content-type"] ?? "application/json";
    lines.push(
      `        request.Content = new StringContent(@"${csharpVerbatim(payload)}", Encoding.UTF8, "${ct}");`,
    );
  }
  lines.push(
    ``,
    `        var response = await client.SendAsync(request);`,
    `        Console.WriteLine((int)response.StatusCode);`,
    `        Console.WriteLine(await response.Content.ReadAsStringAsync());`,
    `    }`,
    `}`,
  );
  return lines.join("\n");
}

export function genCsharpRestSharp(parsed) {
  const { method, url, headers, payload } = parsed;
  const hObj = headersObj(headers);
  let origin = url;
  let path = "/";
  try {
    const u = new URL(url);
    origin = `${u.protocol}//${u.host}`;
    path = u.pathname + (u.search || "");
  } catch (_) {}
  const lines = [
    `using System;`,
    `using System.Threading.Tasks;`,
    `using RestSharp;`,
    ``,
    `class Program`,
    `{`,
    `    static async Task Main()`,
    `    {`,
    `        var client = new RestClient(new RestClientOptions("${csharpVerbatim(origin)}"));`,
    `        var request = new RestRequest("${csharpVerbatim(path)}", Method.${method.charAt(0) + method.slice(1).toLowerCase()});`,
    ``,
  ];
  for (const [k, v] of Object.entries(hObj))
    lines.push(`        request.AddHeader("${csharpVerbatim(k)}", "${csharpVerbatim(v)}");`);
  if (payload) lines.push(`        request.AddStringBody(@"${csharpVerbatim(payload)}", DataFormat.Json);`);
  lines.push(
    ``,
    `        var response = await client.ExecuteAsync(request);`,
    `        Console.WriteLine((int)response.StatusCode);`,
    `        Console.WriteLine(response.Content);`,
    `    }`,
    `}`,
  );
  return lines.join("\n");
}

export function genOpenApi(parsed) {
  let u = null;
  try {
    u = new URL(parsed.url);
  } catch (_) {}
  const path = u ? u.pathname || "/" : "/";
  const server = u ? `${u.protocol}//${u.host}` : parsed.url;
  const hObj = headersObj(parsed.headers);

  const parameters = [];
  if (u) {
    for (const [k, v] of u.searchParams.entries()) {
      parameters.push({
        name: k,
        in: "query",
        required: false,
        schema: { type: "string", example: v },
      });
    }
  }
  for (const [k, v] of Object.entries(hObj)) {
    const lk = k.toLowerCase();
    if (["content-type", "content-length", "host", "cookie"].includes(lk))
      continue;
    parameters.push({
      name: k,
      in: "header",
      required: /authorization|x-api-key|token/i.test(lk),
      schema: { type: "string", example: v },
    });
  }

  const operation = {
    summary: `${parsed.method} ${path}`,
    ...(parameters.length ? { parameters } : {}),
    responses: {
      "200": { description: "Successful response" },
    },
  };

  if (parsed.payload && ["POST", "PUT", "PATCH", "DELETE"].includes(parsed.method)) {
    let schemaObj = { type: "string" };
    try {
      const s = JSON.parse(generateJsonSchema(parsed.payload));
      delete s.$schema;
      delete s.title;
      if (s && typeof s === "object") schemaObj = s;
    } catch (_) {}
    const ct =
      hObj["content-type"] ?? (parsed.bodyIsJson ? "application/json" : "text/plain");
    operation.requestBody = {
      required: true,
      content: { [ct]: { schema: schemaObj } },
    };
  }

  const spec = {
    openapi: "3.0.3",
    info: { title: "Imported Request", version: "1.0.0" },
    servers: [{ url: server }],
    paths: { [path]: { [parsed.method.toLowerCase()]: operation } },
  };
  return JSON.stringify(spec, null, 2);
}

// ─── Full list ────────────────────────────────────────────────────────────────

export const CATEGORIES = [
  {
    id: "code",
    label: "Code",
    items: [
      { id: "curl", label: "cURL", lang: "bash", gen: genCurlCmd },
      { id: "wget", label: "wget", lang: "bash", gen: genWget },
      { id: "fetch", label: "JS Fetch", lang: "javascript", gen: genFetchJs },
      { id: "axios", label: "JS Axios", lang: "javascript", gen: genAxiosJs },
      {
        id: "nodefetch",
        label: "Node Fetch",
        lang: "javascript",
        gen: genNodeFetch,
      },
      {
        id: "python",
        label: "Python requests",
        lang: "python",
        gen: genPythonRequests,
      },
      {
        id: "httpx",
        label: "Python httpx",
        lang: "python",
        gen: genPythonHttpx,
      },
      { id: "go", label: "Go", lang: "go", gen: genGo },
      { id: "ruby", label: "Ruby net/http", lang: "ruby", gen: genRuby },
      { id: "php", label: "PHP cURL", lang: "php", gen: genPhpCurl },
      { id: "rust", label: "Rust reqwest", lang: "rust", gen: genRustReqwest },
      { id: "java", label: "Java OkHttp", lang: "java", gen: genJavaOkHttp },
      {
        id: "javanet",
        label: "Java 11 HttpClient",
        lang: "java",
        gen: genJavaNetHttp,
      },
      {
        id: "csharp",
        label: "C# HttpClient",
        lang: "csharp",
        gen: genCsharpHttpClient,
      },
      {
        id: "restsharp",
        label: "C# RestSharp",
        lang: "csharp",
        gen: genCsharpRestSharp,
      },
      {
        id: "postman",
        label: "Postman Collection",
        lang: "json",
        gen: genPostmanCollection,
      },
    ],
  },
  {
    id: "spec",
    label: "Spec",
    items: [
      { id: "openapi", label: "OpenAPI 3", lang: "json", gen: genOpenApi },
    ],
  },
  {
    id: "attack",
    label: "Attack",
    items: [
      { id: "hydra", label: "Hydra", lang: "bash", gen: genHydra },
      { id: "medusa", label: "Medusa", lang: "bash", gen: genMedusa },
      { id: "legion", label: "Legion", lang: "bash", gen: genLegion },
      { id: "sqlmap", label: "SQLMap", lang: "bash", gen: genSqlmap },
      { id: "wfuzz", label: "wfuzz", lang: "bash", gen: genWfuzz },
      { id: "ffuf", label: "ffuf", lang: "bash", gen: genFfuf },
      { id: "gobuster", label: "Gobuster", lang: "bash", gen: genGobuster },
      { id: "msf", label: "Metasploit", lang: "bash", gen: genMsfConsole },
      { id: "replay", label: "Curl Replay", lang: "bash", gen: genCurlReplay },
    ],
  },
  {
    id: "recon",
    label: "Recon",
    items: [
      { id: "nikto", label: "Nikto", lang: "bash", gen: genNikto },
      { id: "hashcat", label: "Hashcat", lang: "bash", gen: genHashcat },
    ],
  },
];

// Flat list for backwards compat
export const LANGUAGES = CATEGORIES.flatMap((c) => c.items);
