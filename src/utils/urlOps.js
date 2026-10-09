// ─── URL encoding ops ─────────────────────────────────────────────────────────
// Percent-encoding, the two flavours of it, and the two escape hatches people
// actually need: encode twice, and decode until the string stops changing.
//
// Decoders never throw: malformed percent-sequences come back as
// { ok: false, error } so the caller can surface a real message instead of a
// stack trace. Pure — no I/O, no globals.

export const URL_DESCRIPTION =
  "Percent-encode or decode URL text, with double-encode and decode-until-stable modes.";

export const MAX_DECODE_PASSES = 5;

// Encode. Default is component encoding (the usual meaning of "URL encode",
// where :/?&= and friends are escaped); `keepReserved` switches to encodeURI,
// which leaves a whole URL's structure intact.
export function urlEncode(input, { keepReserved = false } = {}) {
  if (typeof input !== "string") return "";
  return keepReserved ? encodeURI(input) : encodeURIComponent(input);
}

export function urlEncodeTwice(input, opts) {
  return urlEncode(urlEncode(input, opts), opts);
}

// Decode one pass. Never throws.
export function urlDecode(input) {
  if (typeof input !== "string" || input.length === 0) return { ok: true, text: "", passes: 0 };
  try {
    return { ok: true, text: decodeURIComponent(input), passes: 1 };
  } catch (_) {
    return {
      ok: false,
      text: input,
      passes: 0,
      error: "Malformed percent-encoding — looks like a stray '%' or an invalid escape.",
    };
  }
}

// Keep decoding while the result still contains a percent-escape and still
// changes. `maxPasses` is the guard against a string that never settles.
export function decodeUntilStable(input, { maxPasses = MAX_DECODE_PASSES } = {}) {
  if (typeof input !== "string" || input.length === 0) {
    return { ok: true, text: typeof input === "string" ? input : "", passes: 0, capped: false };
  }
  const limit = Math.max(1, Math.floor(Number(maxPasses)) || MAX_DECODE_PASSES);
  let current = input;
  let passes = 0;
  while (passes < limit && /%[0-9a-fA-F]{2}/.test(current)) {
    const res = urlDecode(current);
    if (!res.ok) {
      return { ok: false, text: current, passes, capped: false, error: res.error };
    }
    if (res.text === current) break; // settled
    current = res.text;
    passes += 1;
  }
  return { ok: true, text: current, passes, capped: passes >= limit };
}

// Pull a query string apart, decoding each value. Tolerates a leading '?'.
export function parseQuery(input) {
  if (typeof input !== "string") return [];
  const s = input.startsWith("?") ? input.slice(1) : input;
  if (!s) return [];
  return s.split("&").filter(Boolean).map((pair) => {
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawVal = eq === -1 ? "" : pair.slice(eq + 1);
    const k = urlDecode(rawKey.replace(/\+/g, " "));
    const v = urlDecode(rawVal.replace(/\+/g, " "));
    return { key: k.ok ? k.text : rawKey, value: v.ok ? v.text : rawVal };
  });
}
