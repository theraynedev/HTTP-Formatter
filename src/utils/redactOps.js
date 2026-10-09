// ─── Redaction ops ────────────────────────────────────────────────────────────
// Hide the contents of a secret while leaving a short tail (and optionally a
// head) readable, so a key can be pasted into a ticket or a chat safely.
//
// Deliberately NOT the same job as `maskify`: maskify describes the *shape* of
// a string (?d/?l/?u) and is reversible-looking; this hides the *contents* and
// is not reversible. Don't conflate the two.
//
// Pure — no I/O, no globals.

export const REDACT_DESCRIPTION =
  "Mask a token or API key with * except the last N characters (default 4) — for sharing secrets safely.";

export const DEFAULT_VISIBLE = 4;

function clampInt(value, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

// Mask every character except the last `visible` (and, optionally, the first
// `keepStart`, which is handy for keeping a non-secret type prefix like
// "sk_live_" or "ghp_" readable).
export function maskToken(input, { visible = DEFAULT_VISIBLE, keepStart = 0, maskChar = "*" } = {}) {
  if (typeof input !== "string" || input.length === 0) return "";
  const len = input.length;
  const head = clampInt(keepStart, 0, len);
  const tailLen = clampInt(visible, 0, len - head);
  const headStr = input.slice(0, head);
  const tailStr = tailLen > 0 ? input.slice(len - tailLen) : "";
  const middle = len - headStr.length - tailStr.length;
  return headStr + maskChar.repeat(middle) + tailStr;
}

// Redact a whole blob (e.g. an .env file or a log) by replacing every long
// run of token-ish characters. Conservative on purpose: only masks runs of 16+
// characters from the base64url / hex alphabets, so prose and short words pass
// through untouched. '=' is deliberately excluded so a run stops at the
// `KEY=value` boundary instead of swallowing the variable name.
const TOKEN_RUN = /[A-Za-z0-9_\-+/]{16,}/g;

export function maskTokenRuns(text, { visible = DEFAULT_VISIBLE } = {}) {
  if (typeof text !== "string" || text.length === 0) return "";
  return text.replace(TOKEN_RUN, (m) => maskToken(m, { visible }));
}
