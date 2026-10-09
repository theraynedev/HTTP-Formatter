// ─── Utility registry ─────────────────────────────────────────────────────────
// A single catalog of the pure string → string utilities the tool exposes.
// The CLI (bin/util.mjs) is driven entirely by this list, and every entry
// carries the same one-line description it advertises elsewhere.
//
// Contract: every `run` takes a string and returns a string (or a Promise of
// one). Anything that needs bytes, files or the DOM belongs in a workspace
// component, not here. Set `needsInput: false` for generators that ignore
// their input, so the CLI doesn't demand stdin.
//
// Adding a utility = export it from a module and append one entry below.

import { MASKIFY_DESCRIPTION, maskify } from "./maskify.js";
import {
  base64ToText,
  fromBase64Url,
  hexToText,
  textToBase64,
  textToHex,
  toBase64Url,
} from "./base64Ops.js";
import { REDACT_DESCRIPTION, maskToken } from "./redactOps.js";
import { urlDecode, urlEncode } from "./urlOps.js";
import { HASHID_DESCRIPTION, formatHashCandidates, identifyHash } from "./hashIdOps.js";
import { generateUuidV4, generateUuidV7 } from "./uuidOps.js";
import { TIME_DESCRIPTION, convertTimestamp } from "./timeOps.js";
import {
  SECHEADERS_DESCRIPTION,
  checkSecurityHeaders,
  formatSecurityReport,
} from "./secHeadersOps.js";

// Turn a { ok, error } result into a thrown error, so the CLI can report it.
function unwrap(res, pick = (r) => r.text) {
  if (!res.ok) throw new Error(res.error ?? "Operation failed.");
  return pick(res);
}

export const UTIL_REGISTRY = [
  {
    id: "maskify",
    label: "Maskify",
    description: MASKIFY_DESCRIPTION,
    run: maskify,
  },
  {
    id: "mask-token",
    label: "Mask token",
    description: REDACT_DESCRIPTION,
    run: (input) => maskToken(input),
  },
  {
    id: "identify-hash",
    label: "Identify hash",
    description: HASHID_DESCRIPTION,
    run: (input) => formatHashCandidates(identifyHash(input)),
  },
  {
    id: "url-encode",
    label: "URL encode",
    description: "Percent-encode text for use in a URL (component encoding).",
    run: (input) => urlEncode(input),
  },
  {
    id: "url-decode",
    label: "URL decode",
    description: "Decode percent-encoding, peeling repeated layers until the text settles.",
    run: (input) => unwrap(urlDecode(input)),
  },
  {
    id: "timestamp",
    label: "Timestamp → ISO",
    description: TIME_DESCRIPTION,
    run: (input) => unwrap(convertTimestamp(input), (r) => r.iso),
  },
  {
    id: "check-headers",
    label: "Security headers",
    description: SECHEADERS_DESCRIPTION,
    run: (input) => formatSecurityReport(checkSecurityHeaders(input)),
  },
  {
    id: "uuid-v4",
    label: "UUID v4",
    description: "Generate a random (v4) UUID.",
    needsInput: false,
    run: () => generateUuidV4(),
  },
  {
    id: "uuid-v7",
    label: "UUID v7",
    description: "Generate a time-ordered (v7) UUID — sorts by creation time.",
    needsInput: false,
    run: () => generateUuidV7(),
  },
  {
    id: "text-to-base64",
    label: "Text → Base64",
    description: "Encode UTF-8 text as Base64.",
    run: textToBase64,
  },
  {
    id: "base64-to-text",
    label: "Base64 → Text",
    description: "Decode Base64 back to UTF-8 text.",
    run: base64ToText,
  },
  {
    id: "text-to-hex",
    label: "Text → Hex",
    description: "Encode UTF-8 text as lowercase hexadecimal bytes.",
    run: textToHex,
  },
  {
    id: "hex-to-text",
    label: "Hex → Text",
    description: "Decode hexadecimal bytes back to UTF-8 text.",
    run: hexToText,
  },
  {
    id: "to-base64url",
    label: "Base64 → base64url",
    description: "Rewrite Base64 using the URL-safe alphabet (RFC 4648 §5).",
    run: toBase64Url,
  },
  {
    id: "from-base64url",
    label: "base64url → Base64",
    description: "Rewrite base64url back to standard Base64.",
    run: fromBase64Url,
  },
];

export function findUtil(id) {
  return UTIL_REGISTRY.find((u) => u.id === id) ?? null;
}
