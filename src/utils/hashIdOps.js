// ─── Hash identifier ──────────────────────────────────────────────────────────
// Guess which algorithm produced a hash from its length, character set and
// prefix. This is heuristics, not proof: several algorithms share a shape
// (MD5 and NTLM are both 32 hex), so we return a *ranked* list and never claim
// a single guaranteed answer.
//
// Pure — no I/O, no globals.

export const HASHID_DESCRIPTION =
  "Guess the algorithm behind a hash from its length, charset and prefix — returns a ranked list, never a guarantee.";

const HEX_RE = /^[0-9a-f]+$/i;
const CRYPT_DES_RE = /^[./0-9A-Za-z]{13}$/;

// Prefix-anchored formats. These are self-identifying, so they outrank any
// length-based guess.
const PREFIX_RULES = [
  { re: /^\$2[abxy]\$/, algo: "bcrypt", note: "Modular Crypt Format, cost in the prefix" },
  { re: /^\$argon2(id|i|d)\$/, algo: "Argon2", note: "Argon2 password hash (PHC string format)" },
  { re: /^\$y\$/, algo: "yescrypt", note: "yescrypt, default on modern Linux" },
  { re: /^\$7\$/, algo: "scrypt", note: "scrypt (PHC / crypt)" },
  { re: /^\$6\$/, algo: "sha512crypt", note: "SHA-512 crypt ($6$)" },
  { re: /^\$5\$/, algo: "sha256crypt", note: "SHA-256 crypt ($5$)" },
  { re: /^\$1\$/, algo: "md5crypt", note: "MD5 crypt ($1$) — legacy" },
  { re: /^\*[0-9A-Fa-f]{40}$/, algo: "MySQL 4.1+", note: "MySQL PASSWORD(), '*' + SHA1(SHA1(pw))" },
  { re: /^\{SSHA\}/, algo: "SSHA (LDAP)", note: "Salted SHA-1, base64 body" },
  { re: /^\{SHA\}/, algo: "SHA (LDAP)", note: "Plain SHA-1, base64 body" },
];

// Length → candidates, for the hex-shaped digests. Order within an entry is
// most-likely first.
const HEX_BY_LENGTH = {
  8: [
    { algo: "CRC-32", confidence: "low", note: "8 hex chars — also a truncated digest" },
  ],
  16: [
    { algo: "MySQL PASSWORD() (pre-4.1)", confidence: "low", note: "16 hex — also half of an MD5" },
  ],
  32: [
    { algo: "MD5", confidence: "high", note: "128-bit digest, no salt" },
    { algo: "NTLM", confidence: "medium", note: "Same 32-hex shape as MD5" },
    { algo: "MD4", confidence: "low", note: "Superseded by MD5" },
    { algo: "LM (half)", confidence: "low", note: "Legacy Windows, 16 hex per half" },
  ],
  40: [
    { algo: "SHA-1", confidence: "high", note: "160-bit digest" },
    { algo: "RIPEMD-160", confidence: "medium", note: "Also 160-bit / 40 hex" },
    { algo: "MySQL 4.1+ (no '*')", confidence: "low", note: "Usually prefixed with '*'" },
  ],
  56: [
    { algo: "SHA-224", confidence: "high", note: "224-bit digest" },
    { algo: "SHA3-224", confidence: "medium", note: "Also 224-bit / 56 hex" },
  ],
  64: [
    { algo: "SHA-256", confidence: "high", note: "256-bit digest" },
    { algo: "Keccak-256", confidence: "medium", note: "Ethereum-style, also 64 hex" },
    { algo: "SHA3-256", confidence: "medium", note: "Also 256-bit / 64 hex" },
    { algo: "BLAKE2s-256", confidence: "low", note: "Also 256-bit / 64 hex" },
  ],
  96: [
    { algo: "SHA-384", confidence: "high", note: "384-bit digest" },
    { algo: "SHA3-384", confidence: "medium", note: "Also 384-bit / 96 hex" },
  ],
  128: [
    { algo: "SHA-512", confidence: "high", note: "512-bit digest" },
    { algo: "Whirlpool", confidence: "medium", note: "Also 512-bit / 128 hex" },
    { algo: "SHA3-512", confidence: "medium", note: "Also 512-bit / 128 hex" },
    { algo: "BLAKE2b-512", confidence: "low", note: "Also 512-bit / 128 hex" },
  ],
};

const CONFIDENCE_ORDER = { high: 0, medium: 1, low: 2 };

export function identifyHash(input) {
  if (typeof input !== "string") return [];
  const value = input.trim();
  if (!value) return [];

  const results = [];

  for (const rule of PREFIX_RULES) {
    if (rule.re.test(value)) {
      results.push({ algo: rule.algo, confidence: "high", note: rule.note, basis: "prefix" });
    }
  }
  if (results.length) return rank(results);

  if (HEX_RE.test(value)) {
    for (const cand of HEX_BY_LENGTH[value.length] ?? []) {
      results.push({ ...cand, basis: "length+hex" });
    }
  } else if (CRYPT_DES_RE.test(value)) {
    results.push({
      algo: "DES(Unix) crypt",
      confidence: "medium",
      note: "13 chars of [./0-9A-Za-z] — classic crypt(3) shape",
      basis: "length+charset",
    });
  }

  return rank(results);
}

function rank(results) {
  return [...results].sort(
    (a, b) => CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence],
  );
}

// Plain-text rendering for the CLI / copy button.
export function formatHashCandidates(candidates) {
  if (!candidates || candidates.length === 0) {
    return "No match — length and charset don't line up with a known digest.";
  }
  const pad = Math.max(...candidates.map((c) => c.algo.length));
  return candidates
    .map((c) => `${c.algo.padEnd(pad)}  ${c.confidence.padEnd(6)}  ${c.note}`)
    .join("\n");
}
