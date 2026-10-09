// ─── UUID ops ─────────────────────────────────────────────────────────────────
// Generate v4 (random) and v7 (time-ordered) UUIDs, and validate/parse a
// supplied one. v7 is the interesting one: the first 48 bits are a Unix
// millisecond timestamp, so the values sort in creation order.
//
// Pure apart from the random source. Uses globalThis.crypto (available in every
// modern browser and in Node ≥ 19) with a Math.random fallback so nothing throws
// if the Web Crypto API is missing.

export const UUID_DESCRIPTION =
  "Generate v4 (random) or v7 (time-ordered) UUIDs, and validate/parse an existing UUID.";

const UUID_RE =
  /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i;

function randomBytes(n) {
  const out = new Uint8Array(n);
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
  return out;
}

function toHex(bytes, start, end) {
  let s = "";
  for (let i = start; i < end; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

function format(bytes) {
  return [
    toHex(bytes, 0, 4),
    toHex(bytes, 4, 6),
    toHex(bytes, 6, 8),
    toHex(bytes, 8, 10),
    toHex(bytes, 10, 16),
  ].join("-");
}

// RFC 9562 §5.4 — 122 random bits, version 4, variant 10xx.
export function generateUuidV4() {
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant RFC 4122
  return format(b);
}

// RFC 9562 §5.7 — 48-bit big-endian ms timestamp + version 7 + 74 random bits.
export function generateUuidV7(timestampMs = Date.now()) {
  const ms = Math.floor(Number(timestampMs));
  const ts = Number.isFinite(ms) ? ms : Date.now();
  const b = randomBytes(16);

  // 48-bit timestamp, big-endian.
  const hi = Math.floor(ts / 0x100000000); // upper 16 bits
  const lo = ts >>> 0; // lower 32 bits
  b[0] = (hi >>> 8) & 0xff;
  b[1] = hi & 0xff;
  b[2] = (lo >>> 24) & 0xff;
  b[3] = (lo >>> 16) & 0xff;
  b[4] = (lo >>> 8) & 0xff;
  b[5] = lo & 0xff;

  b[6] = (b[6] & 0x0f) | 0x70; // version 7
  b[8] = (b[8] & 0x3f) | 0x80; // variant RFC 4122
  return format(b);
}

export function generateUuids(version = 4, count = 1) {
  const n = Math.min(Math.max(Math.floor(Number(count)) || 1, 1), 1000);
  const gen = Number(version) === 7 ? generateUuidV7 : generateUuidV4;
  const out = [];
  for (let i = 0; i < n; i++) out.push(gen());
  return out;
}

// Validate + describe. Accepts braces and a urn:uuid: prefix, and reports the
// version/variant it finds.
export function parseUuid(input) {
  if (typeof input !== "string") {
    return { valid: false, error: "Not a string." };
  }
  const trimmed = input.trim();
  if (!trimmed) return { valid: false, error: "Empty input." };

  let s = trimmed;
  if (/^urn:uuid:/i.test(s)) s = s.slice(9);
  s = s.replace(/^[{[]/, "").replace(/[}\]]$/, "");

  const m = UUID_RE.exec(s);
  if (!m) {
    return { valid: false, canonical: null, error: "Not a valid UUID (expects 8-4-4-4-12 hex)." };
  }

  const versionNibble = parseInt(s[14], 16);
  const variantNibble = parseInt(s[19], 16);
  let variant = "unknown";
  if ((variantNibble & 0x8) === 0) variant = "NCS (reserved)";
  else if ((variantNibble & 0xc) === 0x8) variant = "RFC 4122";
  else if ((variantNibble & 0xe) === 0xc) variant = "Microsoft (reserved)";
  else if ((variantNibble & 0xe) === 0xe) variant = "Future (reserved)";

  const result = {
    valid: true,
    canonical: s.toLowerCase(),
    version: versionNibble,
    variant,
    nil: /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(s),
    max: /^f{8}-f{4}-f{4}-f{4}-f{12}$/i.test(s),
  };

  if (versionNibble === 7) {
    const hex = s.replace(/-/g, "").slice(0, 12);
    const ms = parseInt(hex, 16);
    result.timestampMs = ms;
    result.timestampIso = new Date(ms).toISOString();
  }
  return result;
}
