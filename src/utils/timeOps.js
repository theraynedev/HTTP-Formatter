// ─── Timestamp ops ────────────────────────────────────────────────────────────
// Unix epoch ⇄ ISO 8601 ⇄ human-readable, with the unit inferred from the
// number of digits (10 = seconds, 13 = ms, 16 = µs, 19 = ns) and a timezone
// picker for the human rendering. Batch mode converts a pasted block.
//
// Pure — no I/O. All rendering goes through Intl so DST is handled correctly.

export const TIME_DESCRIPTION =
  "Convert Unix timestamps (s/ms/µs) to ISO 8601 and human-readable form, with timezone selection and batch mode.";

export const TIMEZONES = [
  { id: "UTC", label: "UTC" },
  { id: "local", label: "Local" },
  { id: "America/New_York", label: "New York" },
  { id: "America/Los_Angeles", label: "Los Angeles" },
  { id: "Europe/London", label: "London" },
  { id: "Europe/Berlin", label: "Berlin" },
  { id: "Asia/Shanghai", label: "Shanghai" },
  { id: "Asia/Tokyo", label: "Tokyo" },
  { id: "Asia/Kolkata", label: "Kolkata" },
  { id: "Australia/Sydney", label: "Sydney" },
];

// Digits → unit. Tolerant on purpose: real-world timestamps are frequently
// 10, 13, 16 or 19 digits, and anything nearby is treated as the closest match.
function unitForLength(len) {
  if (len <= 10) return { unit: "seconds", perMs: 1000 };
  if (len <= 13) return { unit: "milliseconds", perMs: 1 };
  if (len <= 16) return { unit: "microseconds", perMs: 1 / 1000 };
  return { unit: "nanoseconds", perMs: 1 / 1e6 };
}

const MAX_DATE_MS = 8.64e15;

export function parseTimestamp(input) {
  if (typeof input !== "string") return { ok: false, error: "Not a string." };
  const s = input.trim();
  if (!s) return { ok: false, error: "Empty input." };
  if (/^now$/i.test(s)) return { ok: true, ms: Date.now(), unit: "now", value: s };
  if (/^today$/i.test(s)) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return { ok: true, ms: d.getTime(), unit: "today", value: s };
  }

  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) {
    return { ok: false, error: "Not a Unix timestamp — expected digits (optionally signed)." };
  }

  const negative = m[1] === "-";
  const intPart = m[2];
  const frac = m[3] ?? "";

  // A decimal point implies seconds with a fractional part.
  const { unit, perMs } = frac ? { unit: "seconds", perMs: 1000 } : unitForLength(intPart.length);

  const numeric = Number(`${negative ? "-" : ""}${intPart}${frac ? "." + frac : ""}`);
  if (!Number.isFinite(numeric)) return { ok: false, error: "Value is not a finite number." };

  const ms = Math.round(numeric * perMs);
  if (!Number.isFinite(ms) || Math.abs(ms) > MAX_DATE_MS) {
    return { ok: false, error: "Out of range for a JavaScript Date (±8.64e15 ms)." };
  }
  return { ok: true, ms, unit, value: s };
}

export function formatInZone(ms, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timeZone === "local" ? undefined : timeZone,
      dateStyle: "medium",
      timeStyle: "long",
      hour12: false,
    }).format(new Date(ms));
  } catch (_) {
    return null;
  }
}

export function relativeTime(ms, now = Date.now()) {
  const diff = ms - now;
  const abs = Math.abs(diff);
  const units = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
    ["second", 1000],
  ];
  for (const [name, size] of units) {
    if (abs >= size) {
      const n = Math.round(abs / size);
      const plural = `${n} ${name}${n === 1 ? "" : "s"}`;
      return diff < 0 ? `${plural} ago` : `in ${plural}`;
    }
  }
  return "just now";
}

// One timestamp → every rendering the UI wants.
export function convertTimestamp(input, { timeZone = "UTC" } = {}) {
  const parsed = parseTimestamp(input);
  if (!parsed.ok) return { ok: false, input, error: parsed.error };

  const { ms, unit } = parsed;
  const d = new Date(ms);
  return {
    ok: true,
    input,
    unit,
    ms,
    seconds: Math.floor(ms / 1000),
    iso: d.toISOString(),
    utc: formatInZone(ms, "UTC"),
    local: formatInZone(ms, "local"),
    custom: formatInZone(ms, timeZone),
    customZone: timeZone,
    relative: relativeTime(ms),
  };
}

// Paste a block of timestamps, one per line (commas also work).
export function convertBatch(text, opts = {}) {
  if (typeof text !== "string" || !text.trim()) return [];
  return text
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => convertTimestamp(t, opts));
}
