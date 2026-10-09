// ─── Base64 ops ───────────────────────────────────────────────────────────────
// Pure helpers for the Base64 Toolkit. Browser-only (atob / btoa / TextEncoder).
//
// Design notes:
//  • Every function is defensive: malformed input never throws, it returns an
//    empty result and lets the caller decide how to surface the problem.
//  • Text paths are UTF-8 safe (TextEncoder / TextDecoder), so emoji and CJK
//    round-trip correctly — unlike naive `btoa(str)` which throws on >0xFF.
//  • `cleanBase64` accepts pasted real-world input: data URIs, base64url,
//    quoted strings, and line-wrapped blobs.
//  • Media detection prefers the declared mime (from a data URI) and falls
//    back to magic-byte sniffing for raw base64.

const CHUNK = 0x8000; // 32k — keeps String.fromCharCode.apply under arg limits

// ─── Low-level: bytes ⇄ base64 ────────────────────────────────────────────────

export function bytesToBase64(bytes) {
  if (!bytes || bytes.length === 0) return "";
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// Normalise any user-supplied base64-ish string into canonical base64.
export function cleanBase64(input) {
  if (typeof input !== "string") return "";
  let s = input.trim();
  // Strip a `data:<mime>;base64,` prefix.
  if (/^data:/i.test(s)) {
    const comma = s.indexOf(",");
    if (comma !== -1) s = s.slice(comma + 1);
  }
  // Strip surrounding quotes / backticks that come along when copy-pasting.
  s = s.replace(/^["'`]+/, "").replace(/["'`]+$/, "");
  // Drop all whitespace (newlines from line-wrapped blobs).
  s = s.replace(/\s+/g, "");
  // base64url → base64.
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  // Re-pad to a multiple of 4.
  const rem = s.length % 4;
  if (rem === 2) s += "==";
  else if (rem === 3) s += "=";
  else if (rem === 1) s = s.slice(0, -1); // lone trailing char is not decodable
  return s;
}

export function base64ToBytes(input) {
  const cleaned = cleanBase64(input);
  if (!cleaned) return new Uint8Array(0);
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ─── Text ⇄ base64 (UTF-8 safe) ───────────────────────────────────────────────

export function textToBase64(text) {
  return bytesToBase64(new TextEncoder().encode(String(text ?? "")));
}

export function base64ToText(input) {
  return new TextDecoder("utf-8", { fatal: false }).decode(base64ToBytes(input));
}

// ─── Hex ──────────────────────────────────────────────────────────────────────

export function bytesToHex(bytes, { upper = false, spaced = false } = {}) {
  const parts = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    parts[i] = bytes[i].toString(16).padStart(2, "0");
  }
  const out = parts.join(spaced ? " " : "");
  return upper ? out.toUpperCase() : out;
}

export function hexToBytes(hex) {
  if (typeof hex !== "string") return new Uint8Array(0);
  let s = hex.trim().replace(/^0x/i, "");
  s = s.replace(/[\s:,\-]/g, ""); // allow "aa:bb", "aa bb", "aa-bb"
  if (s.length % 2 !== 0) s = s.slice(0, -1); // ignore a dangling nibble
  if (!/^[0-9a-fA-F]*$/.test(s)) {
    throw new Error("Hex contains non-hex characters.");
  }
  const bytes = new Uint8Array(s.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(s.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function base64ToHex(input, opts) {
  return bytesToHex(base64ToBytes(input), opts);
}

export function hexToBase64(hex) {
  return bytesToBase64(hexToBytes(hex));
}

export function textToHex(text, opts) {
  return bytesToHex(new TextEncoder().encode(String(text ?? "")), opts);
}

export function hexToText(hex) {
  return new TextDecoder("utf-8", { fatal: false }).decode(hexToBytes(hex));
}

// ─── base64url variant (RFC 4648 §5) ──────────────────────────────────────────

export function toBase64Url(input) {
  return cleanBase64(input).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(input) {
  return cleanBase64(input);
}

// ─── Basic auth ───────────────────────────────────────────────────────────────

export function decodeBasicAuth(input) {
  const raw = base64ToText(input);
  const idx = raw.indexOf(":");
  if (idx === -1) {
    return { ok: false, username: "", password: "", raw };
  }
  return {
    ok: true,
    username: raw.slice(0, idx),
    password: raw.slice(idx + 1),
    raw,
  };
}

export function encodeBasicAuth(username, password) {
  return textToBase64(`${username ?? ""}:${password ?? ""}`);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function looksLikeBase64(input) {
  if (typeof input !== "string") return false;
  const cleaned = cleanBase64(input);
  if (cleaned.length < 4) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned)) return false;
  return cleaned.length % 4 === 0;
}

// Best-effort human error for the input box.
export function base64Error(input) {
  if (typeof input !== "string" || !input.trim()) return null;
  try {
    base64ToBytes(input);
    return null;
  } catch (e) {
    return e?.message ?? "Invalid base64.";
  }
}

// ─── Wrapping / presentation ──────────────────────────────────────────────────

export function wrapBase64(str, width = 76) {
  if (!str) return "";
  if (!width || width <= 0) return str;
  const out = [];
  for (let i = 0; i < str.length; i += width) out.push(str.slice(i, i + width));
  return out.join("\n");
}

export function dataUri(mime, base64) {
  return `data:${mime || "application/octet-stream"};base64,${cleanBase64(base64)}`;
}

// Pull the mime out of a `data:` URI, if present.
export function detectDataUriMime(input) {
  if (typeof input !== "string") return null;
  const m = input.trim().match(/^data:([^;,]+)/i);
  return m ? m[1].toLowerCase() : null;
}

export function formatBytes(n) {
  if (n === 0 || n == null) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// ─── Media sniffing ───────────────────────────────────────────────────────────

function startsWith(bytes, sig, offset = 0) {
  if (bytes.length < offset + sig.length) return false;
  for (let i = 0; i < sig.length; i++) {
    if (bytes[offset + i] !== sig[i]) return false;
  }
  return true;
}

function asciiAt(bytes, str, offset = 0) {
  if (bytes.length < offset + str.length) return false;
  for (let i = 0; i < str.length; i++) {
    if (bytes[offset + i] !== str.charCodeAt(i)) return false;
  }
  return true;
}

const MIME_META = {
  "image/png": { ext: "png", kind: "image" },
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/jpg": { ext: "jpg", kind: "image" },
  "image/gif": { ext: "gif", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "image/bmp": { ext: "bmp", kind: "image" },
  "image/tiff": { ext: "tiff", kind: "image" },
  "image/x-icon": { ext: "ico", kind: "image" },
  "image/vnd.microsoft.icon": { ext: "ico", kind: "image" },
  "image/svg+xml": { ext: "svg", kind: "image" },
  "application/pdf": { ext: "pdf", kind: "pdf" },
  "audio/mpeg": { ext: "mp3", kind: "audio" },
  "audio/mp3": { ext: "mp3", kind: "audio" },
  "audio/wav": { ext: "wav", kind: "audio" },
  "audio/x-wav": { ext: "wav", kind: "audio" },
  "audio/ogg": { ext: "ogg", kind: "audio" },
  "audio/flac": { ext: "flac", kind: "audio" },
  "audio/mp4": { ext: "m4a", kind: "audio" },
  "audio/aac": { ext: "aac", kind: "audio" },
  "audio/webm": { ext: "weba", kind: "audio" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
  "video/quicktime": { ext: "mov", kind: "video" },
  "video/x-msvideo": { ext: "avi", kind: "video" },
  "video/mpeg": { ext: "mpeg", kind: "video" },
  "application/zip": { ext: "zip", kind: "archive" },
  "application/gzip": { ext: "gz", kind: "archive" },
  "application/x-rar-compressed": { ext: "rar", kind: "archive" },
  "application/json": { ext: "json", kind: "text" },
  "text/plain": { ext: "txt", kind: "text" },
  "text/html": { ext: "html", kind: "text" },
  "text/css": { ext: "css", kind: "text" },
  "text/csv": { ext: "csv", kind: "text" },
  "text/xml": { ext: "xml", kind: "text" },
  "application/xml": { ext: "xml", kind: "text" },
};

export function kindForMime(mime) {
  return MIME_META[(mime || "").toLowerCase()]?.kind ?? null;
}

export function extForMime(mime) {
  return MIME_META[(mime || "").toLowerCase()]?.ext ?? "bin";
}

// Ordered so more specific signatures win (m4a before generic mp4).
const SIGNATURES = [
  { kind: "image", mime: "image/png", ext: "png", test: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]) },
  { kind: "image", mime: "image/jpeg", ext: "jpg", test: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { kind: "image", mime: "image/gif", ext: "gif", test: (b) => asciiAt(b, "GIF8") },
  { kind: "image", mime: "image/webp", ext: "webp", test: (b) => asciiAt(b, "RIFF") && asciiAt(b, "WEBP", 8) },
  { kind: "image", mime: "image/bmp", ext: "bmp", test: (b) => startsWith(b, [0x42, 0x4d]) },
  { kind: "image", mime: "image/x-icon", ext: "ico", test: (b) => startsWith(b, [0x00, 0x00, 0x01, 0x00]) },
  { kind: "image", mime: "image/svg+xml", ext: "svg", test: (b) => asciiAt(b, "<svg") || asciiAt(b, "<?xml") },
  { kind: "pdf", mime: "application/pdf", ext: "pdf", test: (b) => asciiAt(b, "%PDF") },
  { kind: "audio", mime: "audio/mp4", ext: "m4a", test: (b) => asciiAt(b, "ftyp", 4) && (asciiAt(b, "M4A ", 8) || asciiAt(b, "mp42", 8)) },
  { kind: "audio", mime: "audio/mpeg", ext: "mp3", test: (b) => asciiAt(b, "ID3") || startsWith(b, [0xff, 0xfb]) || startsWith(b, [0xff, 0xf3]) || startsWith(b, [0xff, 0xf2]) },
  { kind: "audio", mime: "audio/wav", ext: "wav", test: (b) => asciiAt(b, "RIFF") && asciiAt(b, "WAVE", 8) },
  { kind: "audio", mime: "audio/ogg", ext: "ogg", test: (b) => asciiAt(b, "OggS") },
  { kind: "audio", mime: "audio/flac", ext: "flac", test: (b) => asciiAt(b, "fLaC") },
  { kind: "video", mime: "video/mp4", ext: "mp4", test: (b) => asciiAt(b, "ftyp", 4) },
  { kind: "video", mime: "video/webm", ext: "webm", test: (b) => startsWith(b, [0x1a, 0x45, 0xdf, 0xa3]) },
  { kind: "video", mime: "video/quicktime", ext: "mov", test: (b) => asciiAt(b, "moov", 4) || asciiAt(b, "wide", 4) },
  { kind: "archive", mime: "application/zip", ext: "zip", test: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  { kind: "archive", mime: "application/gzip", ext: "gz", test: (b) => startsWith(b, [0x1f, 0x8b]) },
  { kind: "archive", mime: "application/x-rar-compressed", ext: "rar", test: (b) => asciiAt(b, "Rar!") },
];

// Decide what a byte buffer actually is. `declaredMime` (from a data URI)
// wins when we recognise it; otherwise we sniff magic bytes; otherwise we
// fall back to "is this valid UTF-8 text?".
export function sniffMedia(bytes, declaredMime = "") {
  const declared = (declaredMime || "").toLowerCase();
  if (declared && MIME_META[declared]) {
    return { mime: declared, ext: MIME_META[declared].ext, kind: MIME_META[declared].kind, source: "declared" };
  }
  for (const sig of SIGNATURES) {
    if (sig.test(bytes)) {
      return { mime: sig.mime, ext: sig.ext, kind: sig.kind, source: "magic" };
    }
  }
  // Text heuristic: no NUL bytes in the first 4k, and decodes without error.
  const probe = bytes.subarray(0, Math.min(bytes.length, 4096));
  let hasNul = false;
  for (let i = 0; i < probe.length; i++) {
    if (probe[i] === 0) {
      hasNul = true;
      break;
    }
  }
  if (!hasNul) {
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(probe);
      return { mime: "text/plain", ext: "txt", kind: "text", source: "heuristic" };
    } catch (_) {
      /* fall through */
    }
  }
  return { mime: "application/octet-stream", ext: "bin", kind: "binary", source: "fallback" };
}

// Convenience: full inspection of a pasted base64 blob.
export function inspectBase64(input) {
  const declaredMime = detectDataUriMime(input);
  const bytes = base64ToBytes(input);
  const media = sniffMedia(bytes, declaredMime || "");
  return { bytes, byteLength: bytes.length, ...media, declaredMime };
}

// ─── ASCII / char-code breakdown ──────────────────────────────────────────────

export function bytesToAsciiTable(bytes, limit = 512) {
  const rows = [];
  const n = Math.min(bytes.length, limit);
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    rows.push({
      index: i,
      dec: b,
      hex: b.toString(16).padStart(2, "0").toUpperCase(),
      oct: b.toString(8).padStart(3, "0"),
      bin: b.toString(2).padStart(8, "0"),
      char: b === 32 ? "␠" : b >= 33 && b <= 126 ? String.fromCharCode(b) : b === 10 ? "⏎" : b === 9 ? "⇥" : "·",
      printable: b >= 32 && b <= 126,
    });
  }
  return rows;
}
