// ─── JSON ops ─────────────────────────────────────────────────────────────────
// Pure helpers for the JSON Utility tab. No React here — everything is a plain
// function that takes data in and returns data (or a result object) out.
//
// Design notes:
//  • `parseJsonSafe` is the only parser used by the UI; it always returns
//    { ok, value, error } so callers don't have to try/catch.
//  • Path notation supports both dot-notation (`users[0].name`) and array-
//    iteration shorthand (`users[].email`). A path token is either a key
//    name, a numeric index, or the literal "[]" / "*".
//  • All transformations are non-mutating — they return new structures.
//  • The detection helper walks the JSON and reports every leaf path with a
//    primitive type. It caps recursion to keep huge inputs responsive.

const MAX_DETECT_DEPTH = 12;

// ─── Parsing ──────────────────────────────────────────────────────────────────

export function parseJsonSafe(text) {
  if (typeof text !== "string") return { ok: false, value: null, error: "Input is not text." };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, value: null, error: "Empty input." };
  try {
    return { ok: true, value: JSON.parse(trimmed), error: null };
  } catch (e) {
    return { ok: false, value: null, error: e.message };
  }
}

// ─── Pretty / minify ─────────────────────────────────────────────────────────

export function formatJson(text, indent = 2) {
  const parsed = parseJsonSafe(text);
  if (!parsed.ok) return { ok: false, text, error: parsed.error };
  return { ok: true, text: JSON.stringify(parsed.value, null, indent), error: null };
}

export function minifyJson(text) {
  const parsed = parseJsonSafe(text);
  if (!parsed.ok) return { ok: false, text, error: parsed.error };
  return { ok: true, text: JSON.stringify(parsed.value), error: null };
}

// ─── Sort keys (deep) ─────────────────────────────────────────────────────────

export function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const sorted = {};
    for (const key of Object.keys(value).sort((a, b) => a.localeCompare(b))) {
      sorted[key] = sortKeys(value[key]);
    }
    return sorted;
  }
  return value;
}

export function sortJson(text) {
  const parsed = parseJsonSafe(text);
  if (!parsed.ok) return { ok: false, text, error: parsed.error };
  return { ok: true, text: JSON.stringify(sortKeys(parsed.value), null, 2), error: null };
}

// ─── Remove empty / null / undefined values ───────────────────────────────────

function isEmpty(v) {
  if (v === null || v === undefined || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
}

export function removeEmpty(value) {
  if (Array.isArray(value)) {
    const filtered = value
      .map(removeEmpty)
      .filter((v) => !isEmpty(v));
    return filtered;
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const cleaned = removeEmpty(v);
      if (!isEmpty(cleaned)) out[k] = cleaned;
    }
    return out;
  }
  return value;
}

export function removeEmptyJson(text) {
  const parsed = parseJsonSafe(text);
  if (!parsed.ok) return { ok: false, text, error: parsed.error };
  return { ok: true, text: JSON.stringify(removeEmpty(parsed.value), null, 2), error: null };
}

// ─── Remove duplicates (arrays + array-of-objects) ────────────────────────────

function dedupePrimitive(arr) {
  return [...new Set(arr)];
}

function valueKey(v) {
  if (v === null || v === undefined) return "__null__";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function dedupeObjects(arr) {
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const k = valueKey(v);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(v);
    }
  }
  return out;
}

export function removeDuplicates(value) {
  if (Array.isArray(value)) {
    const allPrim = value.every((v) => v === null || typeof v !== "object");
    return allPrim ? dedupePrimitive(value) : dedupeObjects(value);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = removeDuplicates(v);
    return out;
  }
  return value;
}

export function removeDuplicatesJson(text) {
  const parsed = parseJsonSafe(text);
  if (!parsed.ok) return { ok: false, text, error: parsed.error };
  return { ok: true, text: JSON.stringify(removeDuplicates(parsed.value), null, 2), error: null };
}

// ─── Escape / unescape ───────────────────────────────────────────────────────
// Turns a JSON document into a single-line, escaped string and back.

export function escapeJson(text) {
  return { ok: true, text: JSON.stringify(text), error: null };
}

export function unescapeJson(text) {
  const parsed = parseJsonSafe(text);
  if (!parsed.ok) return { ok: false, text, error: parsed.error };
  return { ok: true, text: JSON.stringify(parsed.value, null, 2), error: null };
}

// ─── Path parsing ─────────────────────────────────────────────────────────────
// Tokens can be:
//   - a key name (e.g. "users")
//   - a numeric index (e.g. "0" inside [0])
//   - the wildcard token "*" or "[]" meaning "every element"

function tokenizePath(path) {
  if (!path || typeof path !== "string") return [];
  const tokens = [];
  // split on dots that are outside of brackets
  let buf = "";
  let bracket = false;
  for (let i = 0; i < path.length; i++) {
    const c = path[i];
    if (c === "[") {
      if (buf) { tokens.push(buf); buf = ""; }
      bracket = true;
    } else if (c === "]") {
      // Empty brackets (`[]`) or `[*]` mean "every element of an array".
      if (buf) {
        tokens.push(buf);
      } else {
        tokens.push("[]");
      }
      buf = "";
      bracket = false;
    } else if (c === "." && !bracket) {
      if (buf) { tokens.push(buf); buf = ""; }
    } else {
      buf += c;
    }
  }
  if (buf) tokens.push(buf);
  return tokens;
}

// Resolve a single token against a value. Returns { matched, values } where
// values is the array of candidates for the next step. `wildcard` means the
// token is "*" or "[]".
function resolveToken(value, token, wildcard) {
  if (wildcard) {
    if (!Array.isArray(value)) return { matched: false, values: [] };
    return { matched: true, values: value };
  }
  if (value === null || typeof value !== "object") return { matched: false, values: [] };
  if (Array.isArray(value)) {
    const idx = Number(token);
    if (!Number.isInteger(idx) || idx < 0 || idx >= value.length) return { matched: false, values: [] };
    return { matched: true, values: [value[idx]] };
  }
  if (!(token in value)) return { matched: false, values: [] };
  return { matched: true, values: [value[token]] };
}

// Walk a path against a value, collecting every matched leaf value. Handles
// wildcards by fanning out across arrays at that depth.
export function resolvePath(root, path) {
  const tokens = tokenizePath(path);
  if (tokens.length === 0) return { ok: true, values: [root], missing: false };

  let current = [root];
  let missing = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const wildcard = token === "*" || token === "[]";
    const next = [];
    for (const v of current) {
      const r = resolveToken(v, wildcard ? "" : token, wildcard);
      if (r.matched) next.push(...r.values);
      else missing = true;
    }
    current = next;
    if (current.length === 0) return { ok: true, values: [], missing: true };
  }
  return { ok: true, values: current, missing };
}

// ─── Field extraction ─────────────────────────────────────────────────────────

export function extractValue(root, path) {
  return resolvePath(root, path);
}

// ─── Auto-detect fields ──────────────────────────────────────────────────────
// Walks a JSON value and emits a sorted, deduped list of leaf paths. A "leaf"
// is a path whose value is a primitive (string / number / boolean / null).

export function detectFields(value, prefix = "", out = new Set(), depth = 0) {
  if (depth > MAX_DETECT_DEPTH) return out;
  if (value === null || typeof value !== "object") {
    if (prefix) out.add(prefix);
    return out;
  }
  if (Array.isArray(value)) {
    // Sample a few entries to avoid blowing up on huge arrays.
    const samples = value.slice(0, 5);
    for (const item of samples) {
      detectFields(item, prefix ? `${prefix}[]` : "[]", out, depth + 1);
    }
    return out;
  }
  const keys = Object.keys(value);
  if (keys.length === 0) {
    if (prefix) out.add(prefix);
    return out;
  }
  for (const key of keys) {
    const next = prefix ? `${prefix}.${key}` : key;
    detectFields(value[key], next, out, depth + 1);
  }
  return out;
}

export function detectFieldsList(value) {
  return [...detectFields(value)].sort((a, b) => a.localeCompare(b));
}

// ─── Apply extraction options ─────────────────────────────────────────────────

export function applyOptions(values, opts) {
  let out = values;

  if (opts.removeEmpty) {
    out = out.filter(
      (v) => v !== null && v !== undefined && v !== "",
    );
  }

  if (opts.caseInsensitive) {
    out = out.map((v) =>
      typeof v === "string" ? v.toLowerCase() : v,
    );
  }

  if (opts.unique) {
    out = dedupeObjects(out);
  }

  return out;
}

// ─── Run extraction across multiple fields ────────────────────────────────────

export function runExtraction(root, paths, opts) {
  // Returns { rows: [[…]…], missing: [path…], total }
  const rows = [];
  const missing = [];
  let total = 0;

  for (const rawPath of paths) {
    const path = rawPath.trim();
    if (!path) continue;
    const { values, missing: m } = resolvePath(root, path);
    if (m && values.length === 0) {
      missing.push(path);
      continue;
    }
    if (m) missing.push(path);
    const filtered = applyOptions(values, opts);
    total += filtered.length;
    rows.push({ path, values: filtered });
  }

  // Single-field, "one per line" mode produces a flat string array.
  if (paths.length === 1 && opts.onePerLine) {
    return {
      mode: "list",
      items: rows[0]?.values ?? [],
      missing,
      total,
    };
  }

  // Multi-field, "preserve structure" mode aligns values per row when all
  // paths are wildcards over the same arrays.
  if (paths.length > 1 && opts.preserveStructure && allWildcards(paths)) {
    const aligned = alignByIndex(root, paths, opts);
    // `columns` is required by the results table — without it the renderer
    // dereferenced undefined and took the whole app down.
    return {
      mode: "table",
      columns: paths.map((p) => p.trim()),
      rows: aligned,
      missing,
      total,
    };
  }

  // Default: a "table" of N rows × paths columns, where each column lists
  // all matches for that path. Compact view.
  const maxLen = Math.max(0, ...rows.map((r) => r.values.length));
  const table = [];
  for (let i = 0; i < maxLen; i++) {
    const row = rows.map((r) => r.values[i] ?? "");
    table.push(row);
  }
  return { mode: "table", columns: rows.map((r) => r.path), rows: table, missing, total };
}

function allWildcards(paths) {
  return paths.every((p) => tokenizePath(p).some((t) => t === "*" || t === "[]"));
}

function alignByIndex(root, paths, opts) {
  // For wildcards like `users[].name` and `users[].email`, find the shared
  // array and zip values together row-by-row.
  // Cache tokenizePath per path — this function used to tokenize N times for
  // each row (paths.length × arrayRef.length), which got quadratic fast.
  const tokenized = paths.map((p) => ({ path: p, tokens: tokenizePath(p) }));
  const sharedPrefix = findSharedArrayPrefix(tokenized.map((t) => t.tokens));
  if (!sharedPrefix) return [];

  const arrayRef = walkPath(root, sharedPrefix);
  if (!Array.isArray(arrayRef)) return [];

  const out = [];
  for (const item of arrayRef) {
    const row = paths.map((_, i) => {
      const after = tokenized[i].tokens.slice(sharedPrefix.length);
      const { values } = resolvePath(item, after.join("."));
      return values[0] ?? "";
    });
    if (opts.removeEmpty && row.every((c) => c === null || c === undefined || c === "")) {
      continue;
    }
    out.push(row);
  }
  return out;
}

function findSharedArrayPrefix(tokenLists) {
  // Returns the longest common prefix whose last token is a wildcard array step.
  if (!tokenLists.length) return null;
  const minLen = Math.min(...tokenLists.map((t) => t.length));
  for (let i = minLen; i > 0; i--) {
    const candidate = tokenLists[0].slice(0, i);
    const ok = tokenLists.every((t) => {
      const slice = t.slice(0, i);
      if (slice.join(".") !== candidate.join(".")) return false;
      const last = candidate[candidate.length - 1];
      return last === "*" || last === "[]";
    });
    if (ok) return candidate;
  }
  return null;
}

function walkPath(root, tokens) {
  let v = root;
  for (const token of tokens) {
    const wildcard = token === "*" || token === "[]";
    if (wildcard) return Array.isArray(v) ? v : null;
    if (v === null || typeof v !== "object") return null;
    if (Array.isArray(v)) {
      const idx = Number(token);
      if (!Number.isInteger(idx)) return null;
      v = v[idx];
    } else if (token in v) {
      v = v[token];
    } else {
      return null;
    }
  }
  return v;
}

// ─── Conversions: CSV / YAML / XML ────────────────────────────────────────────

export function escapeCsvCell(v) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(columns, rows) {
  const header = columns.map(escapeCsvCell).join(",");
  const body = rows
    .map((r) => r.map(escapeCsvCell).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

export function jsonToYaml(obj, indent = 0) {
  const pad = "  ".repeat(indent);
  if (obj === null || obj === undefined) return `${pad}null`;
  if (typeof obj === "boolean" || typeof obj === "number") return `${pad}${obj}`;
  if (typeof obj === "string") {
    if (/[:#\-?,\n\r"'\[\]{}|&*!><%@`]/.test(obj) || obj === "" || /^\s|\s$/.test(obj)) {
      return `${pad}${JSON.stringify(obj)}`;
    }
    return `${pad}${obj}`;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return `${pad}[]`;
    return obj
      .map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const entries = Object.entries(item);
          if (entries.length === 0) return `${pad}{}`;
          const first = `${pad}- ${yamlScalar(entries[0][0])}: ${yamlInline(entries[0][1])}`;
          const rest = entries
            .slice(1)
            .map(([k, v]) => `${pad}  ${yamlScalar(k)}: ${yamlInline(v)}`)
            .join("\n");
          return rest ? `${first}\n${rest}` : first;
        }
        return `${pad}- ${yamlInline(item)}`;
      })
      .join("\n");
  }
  if (typeof obj === "object") {
    const entries = Object.entries(obj);
    if (entries.length === 0) return `${pad}{}`;
    return entries
      .map(([k, v]) => {
        if (v && typeof v === "object") {
          const inner = jsonToYaml(v, indent + 1);
          return `${pad}${k}:\n${inner}`;
        }
        return `${pad}${yamlScalar(k)}: ${yamlInline(v)}`;
      })
      .join("\n");
  }
  return `${pad}${obj}`;
}

function yamlScalar(s) {
  if (/[:#\-?,\n\r"'\[\]{}|&*!><%@`\s]/.test(s) || s === "") return JSON.stringify(s);
  return s;
}

function yamlInline(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (typeof v === "string") return yamlScalar(v);
  if (Array.isArray(v) && v.every((x) => x === null || ["string", "number", "boolean"].includes(typeof x))) {
    return `[${v.map(yamlInline).join(", ")}]`;
  }
  if (v && typeof v === "object") {
    const entries = Object.entries(v);
    if (entries.length === 0) return "{}";
    return `{${entries.map(([k, val]) => `${yamlScalar(k)}: ${yamlInline(val)}`).join(", ")}}`;
  }
  return String(v);
}

export function jsonToXml(obj, rootName = "root") {
  // Convert any JSON value to a single-element XML tree. Keys become element
  // names, repeated keys are not supported (XML limitation), arrays become
  // repeated children, primitives become text content.
  const lines = [];
  appendXml(lines, rootName, obj, 0);
  return lines.join("\n");
}

function safeTag(name) {
  const cleaned = String(name).replace(/[^A-Za-z0-9_\-.]/g, "_");
  return cleaned || "_";
}

function appendXml(lines, tag, value, depth) {
  const pad = "  ".repeat(depth);
  if (value === null || value === undefined) {
    lines.push(`${pad}<${tag}/>`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${pad}<${tag}/>`);
      return;
    }
    for (const item of value) {
      appendXml(lines, tag, item, depth);
    }
    return;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      lines.push(`${pad}<${tag}/>`);
      return;
    }
    lines.push(`${pad}<${tag}>`);
    for (const [k, v] of entries) appendXml(lines, safeTag(k), v, depth + 1);
    lines.push(`${pad}</${tag}>`);
    return;
  }
  const text = String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  lines.push(`${pad}<${tag}>${text}</${tag}>`);
}

// ─── JSON tree builder (for pathfinder tree view) ────────────────────────────

export function buildTree(value, label = "$", path = label) {
  return {
    key: label,
    path,
    type: jsonType(value),
    value,
    children: isContainer(value)
      ? Object.entries(value).map(([k, v], i) => {
          const childPath = Array.isArray(value)
            ? `${path}[${i}]`
            : path === "$"
              ? k
              : /^[A-Za-z_$][\w$]*$/.test(k)
                ? `${path}.${k}`
                : `${path}["${k}"]`;
          return buildTree(v, Array.isArray(value) ? String(i) : k, childPath);
        })
      : [],
  };
}

export function jsonType(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

export function isContainer(v) {
  return v !== null && typeof v === "object";
}

// ─── Stats for input meta ────────────────────────────────────────────────────

export function summarize(value) {
  if (value === null) return { kind: "null", count: 1 };
  if (Array.isArray(value)) return { kind: "array", count: value.length };
  if (typeof value === "object") return { kind: "object", count: Object.keys(value).length };
  return { kind: typeof value, count: 1 };
}

export function countRecords(value) {
  // Best-effort: arrays of objects are "records". Otherwise it's a single value.
  if (Array.isArray(value)) {
    if (value.length === 0) return 0;
    if (value.every((v) => v && typeof v === "object" && !Array.isArray(v))) return value.length;
    return value.length;
  }
  if (value && typeof value === "object") return 1;
  return 1;
}