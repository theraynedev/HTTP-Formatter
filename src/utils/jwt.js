// ─── JWT decode / encode / verify ─────────────────────────────────────────────
// Decoding reuses the existing Base64 and JSON helpers rather than re-deriving
// them; signing uses Web Crypto's HMAC, which is present in every modern
// browser and in Node ≥ 19 (so the same code runs in the app, the CLI and the
// test runner).
//
// Nothing here throws on bad input — every entry point returns a result object
// with an `error` string the caller can render.

import { base64ToText, bytesToBase64, fromBase64Url, textToBase64, toBase64Url } from "./base64Ops.js";
import { parseJsonSafe } from "./jsonOps.js";

export const JWT_DESCRIPTION =
  "Decode, verify and sign JSON Web Tokens (HS256/384/512) — flags alg:none, expired tokens and missing claims.";

export const JWT_ALGS = ["HS256", "HS384", "HS512"];
const HMAC_HASH = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" };

// ─── Low level ────────────────────────────────────────────────────────────────

// base64url → parsed JSON. Returns null on anything malformed.
function decodeSegment(segment) {
  if (typeof segment !== "string" || !segment) return null;
  try {
    const text = base64ToText(fromBase64Url(segment));
    const parsed = parseJsonSafe(text);
    return parsed.ok ? parsed.value : null;
  } catch (_) {
    return null;
  }
}

function stripBearer(token) {
  return String(token ?? "").replace(/^Bearer\s+/i, "").trim();
}

function splitToken(token) {
  const raw = stripBearer(token);
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  return { raw, parts };
}

async function hmacSign(alg, secret, data) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is unavailable in this environment.");
  const enc = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: HMAC_HASH[alg] },
    false,
    ["sign"],
  );
  const sig = await subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}

// Constant-ish time compare, so we don't leak where a signature diverges.
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── Decode ───────────────────────────────────────────────────────────────────

export function decodeJwt(token) {
  const split = splitToken(token);
  if (!split) return null;
  const { raw, parts } = split;

  const header = decodeSegment(parts[0]);
  const payload = decodeSegment(parts[1]);
  if (!header || !payload) return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = payload.exp ?? null;
  const iat = payload.iat ?? null;
  const nbf = payload.nbf ?? null;

  let expiryStatus = "none"; // 'valid' | 'expired' | 'none'
  let secondsLeft = null;
  if (exp !== null) {
    secondsLeft = exp - now;
    expiryStatus = secondsLeft > 0 ? "valid" : "expired";
  }

  return {
    raw,
    header,
    payload,
    signature: parts[2],
    alg: header.alg ?? null,
    exp,
    iat,
    nbf,
    expiryStatus,
    secondsLeft,
    expiresAt: exp ? new Date(exp * 1000).toLocaleString() : null,
    issuedAt: iat ? new Date(iat * 1000).toLocaleString() : null,
  };
}

// Decode + a list of things worth flagging. Never throws.
export function inspectJwt(token) {
  const decoded = decodeJwt(token);
  if (!decoded) {
    return {
      ok: false,
      error: "Not a JWT — expected three dot-separated base64url segments.",
      flags: [],
    };
  }

  const flags = [];
  const now = Math.floor(Date.now() / 1000);

  if (decoded.alg === "none" || decoded.alg == null) {
    flags.push({ level: "error", message: 'alg is "none" — the token is unsigned and can be forged.' });
  }
  if (decoded.signature === "") {
    flags.push({ level: "error", message: "Signature segment is empty." });
  }
  if (decoded.exp == null) {
    flags.push({ level: "warn", message: "No exp claim — the token never expires." });
  } else if (decoded.exp <= now) {
    flags.push({ level: "error", message: `Expired ${formatDuration(now - decoded.exp)} ago.` });
  }
  if (decoded.iat == null) {
    flags.push({ level: "info", message: "No iat claim — issuance time is unknown." });
  }
  if (decoded.nbf != null && decoded.nbf > now) {
    flags.push({ level: "warn", message: `Not valid until ${formatDuration(decoded.nbf - now)} from now (nbf).` });
  }

  return { ok: true, ...decoded, flags };
}

// ─── Encode / sign ────────────────────────────────────────────────────────────

export async function encodeJwt({ header, payload, secret = "", alg = "HS256" } = {}) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "Payload must be a JSON object." };
  }
  const finalAlg = header?.alg ?? alg;
  if (finalAlg !== "none" && !HMAC_HASH[finalAlg]) {
    return { ok: false, error: `Unsupported algorithm "${finalAlg}". Use ${JWT_ALGS.join(", ")} or "none".` };
  }
  if (finalAlg !== "none" && !secret) {
    return { ok: false, error: `A secret is required to sign with ${finalAlg}.` };
  }

  const headerObj = { alg: finalAlg, typ: "JWT", ...(header ?? {}) };
  const signingInput = `${toBase64Url(textToBase64(JSON.stringify(headerObj)))}.${toBase64Url(
    textToBase64(JSON.stringify(payload)),
  )}`;

  let signature = "";
  if (finalAlg !== "none") {
    try {
      const sig = await hmacSign(finalAlg, secret, signingInput);
      signature = toBase64Url(bytesToBase64(sig));
    } catch (e) {
      return { ok: false, error: e?.message ?? "Signing failed." };
    }
  }
  return { ok: true, token: `${signingInput}.${signature}`, alg: finalAlg };
}

// ─── Verify ───────────────────────────────────────────────────────────────────

export async function verifyJwt(token, secret = "") {
  const split = splitToken(token);
  if (!split) return { ok: false, valid: false, reason: "Not a JWT — expected three dot-separated segments." };

  const { parts } = split;
  const header = decodeSegment(parts[0]);
  if (!header) return { ok: false, valid: false, reason: "Header is not valid base64url JSON." };

  const alg = header.alg ?? null;
  if (alg === "none" || alg == null) {
    return { ok: true, valid: false, alg: "none", reason: 'alg is "none" — an unsigned token can never be verified.' };
  }
  if (!HMAC_HASH[alg]) {
    return { ok: true, valid: false, alg, reason: `Unsupported algorithm "${alg}" — only ${JWT_ALGS.join(", ")} can be checked here.` };
  }
  if (!secret) {
    return { ok: true, valid: false, alg, reason: "A secret is required to verify the signature." };
  }

  let expected;
  try {
    const sig = await hmacSign(alg, secret, `${parts[0]}.${parts[1]}`);
    expected = toBase64Url(bytesToBase64(sig));
  } catch (e) {
    return { ok: false, valid: false, alg, reason: e?.message ?? "Verification failed." };
  }

  const actual = parts[2];
  const valid = timingSafeEqual(expected, actual);

  // A matching signature says nothing about freshness — surface that too.
  const now = Math.floor(Date.now() / 1000);
  const payload = decodeSegment(parts[1]);
  let freshness = "unknown";
  if (payload && typeof payload.exp === "number") {
    freshness = payload.exp > now ? "valid" : "expired";
  }

  return {
    ok: true,
    valid,
    alg,
    freshness,
    reason: valid
      ? freshness === "expired"
        ? "Signature is valid, but the token has expired."
        : "Signature is valid."
      : "Signature does not match — wrong secret, tampered payload, or a different algorithm.",
  };
}

// ─── Presentation helpers (unchanged) ─────────────────────────────────────────

export function formatDuration(seconds) {
  if (seconds <= 0) return "Expired";
  const abs = Math.abs(seconds);
  if (abs < 60) return `${abs}s`;
  if (abs < 3600) return `${Math.floor(abs / 60)}m ${abs % 60}s`;
  if (abs < 86400) return `${Math.floor(abs / 3600)}h ${Math.floor((abs % 3600) / 60)}m`;
  return `${Math.floor(abs / 86400)}d ${Math.floor((abs % 86400) / 3600)}h`;
}

// Extract the Authorization header value from parsed headers array
export function extractAuthHeader(headers) {
  for (const h of headers) {
    const lower = h.toLowerCase();
    if (lower.startsWith("authorization:")) {
      return h.slice("authorization:".length).trim();
    }
  }
  return null;
}
