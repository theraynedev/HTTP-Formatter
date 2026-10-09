// ─── maskify ──────────────────────────────────────────────────────────────────
// Turn a string into a hashcat-style character-class pattern: every ASCII
// digit / lower / upper character becomes a "?d" / "?l" / "?u" token, and
// every other character (symbols, punctuation, whitespace, hyphens, …) is
// copied through literally, in its original position.
//
// Design notes:
//  • Pure — no I/O, no globals, no side effects; safe to call from anywhere
//    (browser, Node, tests) with no setup.
//  • Only ASCII 0-9, a-z, A-Z are classified. Accented letters, emoji,
//    non-ASCII digits and every other code point are left untouched, so the
//    output round-trips a UTF-8 string without corrupting it.
//  • Iteration is by code point (for…of), so a surrogate pair (emoji) stays a
//    single literal unit instead of being split in half.
//  • Caveat: because a literal "?" is preserved as-is, a "?" in the input is
//    indistinguishable from the start of a token in the output. That is
//    inherent to the "?d/?l/?u" syntax and is the documented behaviour.

export const MASKIFY_DESCRIPTION =
  "Convert a string into a ?d/?l/?u character-class pattern (useful for hashcat-style mask generation, format fingerprinting, etc.).";

// The three tokens, exported so callers and tests can reference them by name.
export const MASKIFY_TOKENS = Object.freeze({
  digit: "?d",
  lower: "?l",
  upper: "?u",
});

export function maskify(input) {
  if (typeof input !== "string" || input.length === 0) return "";
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0);
    if (code >= 0x30 && code <= 0x39) out += MASKIFY_TOKENS.digit;
    else if (code >= 0x61 && code <= 0x7a) out += MASKIFY_TOKENS.lower;
    else if (code >= 0x41 && code <= 0x5a) out += MASKIFY_TOKENS.upper;
    else out += ch; // symbols, punctuation, whitespace, non-ASCII — verbatim
  }
  return out;
}
