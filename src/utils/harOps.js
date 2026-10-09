// ─── HAR ops ──────────────────────────────────────────────────────────────────
// Pure helpers for the HAR Analyzer. Works on raw HAR JSON objects (the shape
// produced by browsers, Fiddler, Charles, etc.). Keeps the original raw data
// so we can reconstruct a HAR file from filtered entries later.
//
// All mutating transforms return new structures; nothing is mutated in place.

const VALID_VERSIONS = new Set(["1.1", "1.2"]);

// ─── Parsing ──────────────────────────────────────────────────────────────────

export function parseHarFile(text) {
  if (typeof text !== "string") {
    return { ok: false, error: "Input is not text.", log: null, entries: [] };
  }
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Empty input.", log: null, entries: [] };

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e.message}`, log: null, entries: [] };
  }

  if (!parsed?.log || typeof parsed.log !== "object") {
    return { ok: false, error: "Missing `log` root. Not a HAR document.", log: null, entries: [] };
  }

  const log = parsed.log;
  const version = String(log.version ?? "1.2");
  if (!VALID_VERSIONS.has(version)) {
    return {
      ok: false,
      error: `Unsupported HAR version "${version}". Only 1.1 / 1.2 supported.`,
      log: null,
      entries: [],
    };
  }

  const raw = Array.isArray(log.entries) ? log.entries : [];
  const entries = raw.map((e, i) => normalizeEntry(e, i)).filter(Boolean);

  return {
    ok: true,
    error: null,
    log: { version, creator: log.creator ?? null, comment: log.comment ?? null },
    entries,
    // Original log (without entries mutation) is kept so we can re-emit
    // filtered exports with proper metadata.
    rawLog: parsed.log,
  };
}

function normalizeEntry(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const req = raw.request ?? {};
  const res = raw.response ?? {};
  const url = req.url ?? "";
  const method = String(req.method ?? "GET").toUpperCase();

  const requestHeaders = (Array.isArray(req.headers) ? req.headers : [])
    .map((h) => `${h?.name ?? ""}: ${h?.value ?? ""}`)
    .filter((h) => h.trim() !== ":");

  const queryParams = Array.isArray(req.queryString) ? req.queryString : [];

  let body = "";
  let bodyContentType = null;
  if (req.postData?.text) {
    body = req.postData.text;
    bodyContentType = req.postData.mimeType ?? null;
  } else if (req.postData?._isBase64) {
    body = "[base64 encoded]";
    bodyContentType = req.postData.mimeType ?? null;
  }

  const status = Number(res.status ?? 0);
  const statusText = String(res.statusText ?? "");

  const responseHeaders = (Array.isArray(res.headers) ? res.headers : [])
    .map((h) => `${h?.name ?? ""}: ${h?.value ?? ""}`)
    .filter((h) => h.trim() !== ":");

  const responseContent = res.content ?? {};
  let responseBody = "";
  if (typeof responseContent.text === "string") {
    responseBody = responseContent.text;
  } else if (responseContent._isBase64) {
    responseBody = "[base64 encoded]";
  }

  // Capture content-encoding + content.encoding so display components can
  // decode compressed responses (brotli, etc.) before showing them.
  const contentEncoding = findHeaderValue(
    Array.isArray(res.headers) ? res.headers : [],
    "content-encoding",
  );
  const isBase64 = responseContent.encoding === "base64";

  let host = "";
  try {
    host = new URL(url).host;
  } catch (_) {}

  let path = url;
  try {
    const u = new URL(url);
    path = u.pathname + u.search;
  } catch (_) {}

  const timings = normalizeTimings(raw.timings ?? {});
  const totalTime = Math.max(0, Number(raw.time ?? 0));

  return {
    index,
    startedDateTime: raw.startedDateTime ?? null,
    url,
    host,
    path,
    method,
    requestHeaders,
    queryParams,
    requestBody: body,
    requestContentType: bodyContentType,
    status,
    statusText,
    responseHeaders,
    responseContentType: responseContent.mimeType ?? null,
    responseSize: Number(responseContent.size ?? 0),
    responseBody,
    contentEncoding,
    isBase64,
    timings,
    totalTime,
    serverIPAddress: raw.serverIPAddress ?? null,
    connection: raw.connection ?? null,
    comment: raw.comment ?? null,
    // Keep the raw entry so we can re-emit a faithful HAR on export.
    raw,
  };
}

function findHeaderValue(headers, name) {
  const lower = name.toLowerCase();
  for (const h of headers) {
    if (!h || typeof h.name !== "string") continue;
    if (h.name.toLowerCase() === lower) return String(h.value ?? "").trim();
  }
  return null;
}

function normalizeTimings(raw) {
  // HAR allows -1 for "not applicable" — convert to null.
  const pick = (v) => (v === undefined || v === null || Number(v) < 0 ? null : Number(v));
  return {
    blocked: pick(raw.blocked),
    dns: pick(raw.dns),
    connect: pick(raw.connect),
    ssl: pick(raw.ssl),
    send: pick(raw.send),
    wait: pick(raw.wait),
    receive: pick(raw.receive),
  };
}

// ─── Filter ───────────────────────────────────────────────────────────────────

export function filterEntries(entries, opts = {}) {
  const {
    search = "",
    methods = null, // Set<string> | null
    statuses = null, // Set<'1xx'|'2xx'|'3xx'|'4xx'|'5xx'> | null
    hosts = null, // Set<string> | null
  } = opts;
  const term = search.trim().toLowerCase();
  return entries.filter((e) => {
    if (methods && methods.size > 0 && !methods.has(e.method)) return false;
    if (statuses && statuses.size > 0) {
      const family = statusFamily(e.status);
      if (!family || !statuses.has(family)) return false;
    }
    if (hosts && hosts.size > 0 && !hosts.has(e.host)) return false;
    if (term) {
      const haystack =
        `${e.url} ${e.method} ${e.status} ${e.statusText} ${e.path}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

export function statusFamily(code) {
  if (!code) return null;
  if (code < 100) return null;
  if (code < 200) return "1xx";
  if (code < 300) return "2xx";
  if (code < 400) return "3xx";
  if (code < 500) return "4xx";
  if (code < 600) return "5xx";
  return null;
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export function getInsights(entries) {
  const total = entries.length;
  if (total === 0) {
    return {
      total: 0,
      totalTime: 0,
      totalBytes: 0,
      avgTime: 0,
      avgBytes: 0,
      statusDistribution: { "1xx": 0, "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
      methodDistribution: {},
      hosts: [],
      paths: [],
      statusCodes: [],
      slow: [],
      errored: [],
    };
  }

  const statusDistribution = { "1xx": 0, "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  const methodDistribution = {};
  const hostMap = new Map();
  const pathMap = new Map();
  const statusCodeMap = new Map();

  let totalTime = 0;
  let totalBytes = 0;

  for (const e of entries) {
    const fam = statusFamily(e.status);
    if (fam) statusDistribution[fam]++;

    methodDistribution[e.method] = (methodDistribution[e.method] ?? 0) + 1;

    if (e.host) {
      const cur = hostMap.get(e.host) ?? { host: e.host, count: 0, totalTime: 0, totalBytes: 0 };
      cur.count++;
      cur.totalTime += e.totalTime;
      cur.totalBytes += e.responseSize;
      hostMap.set(e.host, cur);
    }

    if (e.path) {
      const cur = pathMap.get(e.path) ?? { path: e.path, count: 0, totalTime: 0 };
      cur.count++;
      cur.totalTime += e.totalTime;
      pathMap.set(e.path, cur);
    }

    if (e.status) {
      const cur = statusCodeMap.get(e.status) ?? { code: e.status, count: 0 };
      cur.count++;
      statusCodeMap.set(e.status, cur);
    }

    totalTime += e.totalTime;
    totalBytes += e.responseSize;
  }

  const hosts = [...hostMap.values()].sort((a, b) => b.count - a.count);
  const paths = [...pathMap.values()]
    .map((p) => ({ ...p, avgTime: p.count > 0 ? p.totalTime / p.count : 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  const statusCodes = [...statusCodeMap.values()].sort((a, b) => b.count - a.count);

  const slow = [...entries]
    .filter((e) => e.totalTime > 0)
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 10);

  const errored = entries.filter((e) => e.status >= 400);

  return {
    total,
    totalTime,
    totalBytes,
    avgTime: totalTime / total,
    avgBytes: totalBytes / total,
    statusDistribution,
    methodDistribution,
    hosts,
    paths,
    statusCodes,
    slow,
    errored,
  };
}

// ─── History → HAR ────────────────────────────────────────────────────────────
// The History page can hand a saved request to the HAR Analyzer. History keeps
// the request side in full (plus response *sizes* on HAR-imported rows), but it
// never stores a response body — so the document we synthesise carries a
// complete `request` and a deliberately empty `response`. That is enough for
// the Analyzer's Entries view to show the request faithfully, and it is honest
// about what we do not have rather than inventing a response.

/** `"Name: value"` → `{ name, value }`. A header with no colon keeps its text. */
function splitHeader(line) {
  const s = String(line ?? "");
  const i = s.indexOf(":");
  if (i === -1) return { name: s.trim(), value: "" };
  return { name: s.slice(0, i).trim(), value: s.slice(i + 1).trim() };
}

/**
 * Build a HAR 1.2 document from a saved history entry.
 * Returns `null` for anything that isn't an entry object.
 */
export function historyEntryToHar(entry) {
  if (!entry || typeof entry !== "object") return null;

  const payload = typeof entry.payload === "string" ? entry.payload : "";
  const size = typeof entry.size === "number" ? entry.size : null;
  const headersSize =
    typeof entry.headersSize === "number" ? entry.headersSize : null;

  const started = entry.timestamp ? new Date(entry.timestamp) : null;
  const startedDateTime =
    started && !Number.isNaN(started.getTime()) ? started.toISOString() : null;

  const request = {
    method: String(entry.method ?? "GET").toUpperCase(),
    url: entry.url ?? "",
    httpVersion: "HTTP/1.1",
    headers: (Array.isArray(entry.headers) ? entry.headers : []).map(splitHeader),
    queryString: (Array.isArray(entry.queryParams) ? entry.queryParams : [])
      .filter((q) => q && q.enabled !== false)
      .map((q) => ({ name: String(q.key ?? ""), value: String(q.value ?? "") })),
    cookies: [],
    headersSize: -1,
    bodySize: payload ? payload.length : 0,
  };
  if (payload) {
    request.postData = {
      mimeType: entry.bodyIsJson ? "application/json" : "text/plain",
      text: payload,
    };
  }

  return {
    log: {
      version: "1.2",
      creator: { name: "HTTP Formatter History", version: "1.0" },
      entries: [
        {
          startedDateTime,
          time: 0,
          request,
          response: {
            status: 0,
            statusText: "",
            httpVersion: "HTTP/1.1",
            headers: [],
            cookies: [],
            content: { size: size ?? 0, mimeType: "" },
            redirectURL: "",
            headersSize: headersSize ?? -1,
            bodySize: -1,
          },
          cache: {},
          timings: { send: 0, wait: 0, receive: 0 },
          comment: "Reconstructed from History — request only.",
        },
      ],
    },
  };
}

// ─── History → HAR file ───────────────────────────────────────────────────────
// One multi-entry document from the whole saved history, for the History page's
// "Export HAR" action. Same request-only contract as `historyEntryToHar`, so an
// exported file round-trips back through `parseHarFile` (and the Formatter's
// HAR import) unchanged.

/** Returns `null` when there is nothing exportable. */
export function historyToHar(entries) {
  if (!Array.isArray(entries)) return null;
  const docs = entries.map(historyEntryToHar).filter(Boolean);
  if (!docs.length) return null;
  return {
    log: {
      version: "1.2",
      creator: { name: "HTTP Formatter History", version: "1.0" },
      comment: "Exported from HTTP Formatter History — requests only.",
      entries: docs.map((d) => d.log.entries[0]),
    },
  };
}

// ─── Reconstruction ───────────────────────────────────────────────────────────

export function buildHarFromEntries(entries, templateLog = null) {
  // Rebuilds a HAR document using the entries' stored `raw` payloads. We keep
  // the original log metadata (creator/version) if supplied.
  const log = templateLog
    ? { ...templateLog, entries: entries.map((e) => e.raw) }
    : {
        version: "1.2",
        creator: { name: "HTTP Formatter HAR Analyzer", version: "1.0" },
        entries: entries.map((e) => e.raw),
      };
  // Drop the entries array from templateLog before re-assigning.
  const { entries: _dropped, ...rest } = log;
  return { log: { ...rest, entries: entries.map((e) => e.raw) } };
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export function entriesToText(entries) {
  return entries
    .map((e) => {
      const status = `${e.status || "???"} ${e.statusText}`.trim();
      return `[${e.method}] ${e.url}  →  ${status}  ·  ${formatDuration(e.totalTime)}`;
    })
    .join("\n");
}

export function entriesToCsv(entries) {
  const header = [
    "startedDateTime",
    "method",
    "url",
    "status",
    "statusText",
    "totalTime_ms",
    "responseSize_bytes",
    "responseContentType",
    "host",
  ];
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const rows = entries.map((e) =>
    [
      e.startedDateTime,
      e.method,
      e.url,
      e.status,
      e.statusText,
      e.totalTime.toFixed(2),
      e.responseSize,
      e.responseContentType,
      e.host,
    ]
      .map(escape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

export function entriesToJsonl(entries) {
  return entries
    .map((e) =>
      JSON.stringify({
        startedDateTime: e.startedDateTime,
        method: e.method,
        url: e.url,
        status: e.status,
        statusText: e.statusText,
        totalTime: e.totalTime,
        responseSize: e.responseSize,
        responseContentType: e.responseContentType,
      }),
    ).join("\n");
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export function formatDuration(ms) {
  if (!ms || ms < 0) return "—";
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

export function formatBytes(n) {
  if (!n) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function statusColor(code) {
  if (code >= 500) return "text-danger";
  if (code >= 400) return "text-warning";
  if (code >= 300) return "text-info";
  if (code >= 200) return "text-success";
  if (code >= 100) return "text-fg-muted";
  return "text-fg-subtle";
}

// ─── Body decoding ────────────────────────────────────────────────────────────
// HAR exporters (notably Chrome DevTools) sometimes save the response body as
// the raw compressed bytes — interpreting it back as UTF-8 produces a "looks
// like gibberish" string. Decode those for the user via the browser's
// DecompressionStream API.
//
// Two flavours of encoding matter here:
//   1. `content.encoding === "base64"` on the HAR content object — the `text`
//      field is base64-encoded binary.
//   2. A `Content-Encoding` response header (gzip, br, deflate, ...) — the
//      binary is compressed.
//
// Supported by `DecompressionStream`: gzip, deflate, deflate-raw universally,
// brotli ('br') in Chrome 121+ / Safari TP but not yet Firefox as of late
// 2024. We try; if the browser can't, we surface a clear error so the UI can
// show the raw text and tell the user why.

const DECODE_LIMIT = 50 * 1024 * 1024; // 50 MB — refuse anything bigger

export async function decodeResponseBody({
  body,
  encoding,
  isBase64 = false,
} = {}) {
  if (typeof body !== "string" || !body) return body ?? "";
  if (!encoding) return { body, decoded: body, fromEncoding: null, wasBase64: isBase64 };

  const fmt = encoding.toLowerCase();

  // Step 1: get raw bytes. Two cases:
  //   - HAR `content.encoding === "base64"` → atob() to bytes
  //   - else → encode the string back to UTF-8 bytes (HAR `text` was UTF-8
  //     with replacement chars for non-ASCII bytes)
  let bytes;
  try {
    if (isBase64) {
      const bin = atob(body);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(body);
    }
  } catch (e) {
    throw new Error(`Could not get raw bytes: ${e.message}`);
  }

  // Step 2: skip if identity.
  if (fmt === "identity") {
    return {
      body: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
      decoded: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
      fromEncoding: null,
      wasBase64: isBase64,
    };
  }

  // Step 3: decompress.
  let stream;
  try {
    stream = new Response(bytes).body.pipeThrough(new DecompressionStream(fmt));
  } catch (e) {
    throw new Error(
      `Browser cannot decode Content-Encoding "${fmt}". ${e.message || ""}`.trim(),
    );
  }

  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > DECODE_LIMIT) {
      try {
        await reader.cancel();
      } catch (_) {}
      throw new Error(`Decoded body exceeds ${DECODE_LIMIT / 1024 / 1024} MB cap.`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Step 4: decode bytes to UTF-8 string. Use fatal:false so partial
  // decodes still produce something useful (replacement char for bad bytes).
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(merged);
  return { body: decoded, decoded, fromEncoding: fmt, wasBase64: isBase64 };
}