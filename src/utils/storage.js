// localStorage helpers

const HISTORY_KEY = "curlHistory";
const COOKIE_KEY = "includeCookie";
const THEME_KEY = "theme";
const REDACT_KEY = "redactShare";
const MAX_HISTORY = 50;

export function normalizeMethod(method) {
  const value = String(method ?? "GET").trim();
  return value ? value.toUpperCase() : "GET";
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

export function saveEntry(parsed) {
  let label = parsed.url;
  try {
    label = new URL(parsed.url).hostname;
  } catch (_) {}
  const entry = {
    id: Date.now(),
    name: label,
    customName: null,
    tags: [],
    folder: null,
    pinned: false,
    url: parsed.url,
    baseUrl: parsed.baseUrl,
    queryParams: parsed.queryParams,
    method: normalizeMethod(parsed.method),
    headers: parsed.headers,
    payload: parsed.payload,
    bodyIsJson: parsed.bodyIsJson,
    raw: parsed.raw,
    timestamp: new Date().toISOString(),
    // Response metadata — populated for HAR imports, null for parsed curl.
    size: parsed.size ?? null,
    headersSize: parsed.headersSize ?? null,
  };
  const history = getHistory();
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return entry;
}

export function deleteEntry(id) {
  const history = getHistory().filter((h) => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}

export function updateEntry(id, changes) {
  const history = getHistory().map((h) =>
    h.id === id ? { ...h, ...changes } : h,
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function pinEntry(id) {
  const history = getHistory().map((h) =>
    h.id === id ? { ...h, pinned: !h.pinned } : h,
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// Returns existing entry if same method+url already saved, else null
export function findDuplicate(method, url) {
  const history = getHistory();
  return (
    history.find(
      (h) => normalizeMethod(h.method) === normalizeMethod(method) && h.url === url,
    ) ?? null
  );
}

export function exportHistory() {
  return JSON.stringify(getHistory(), null, 2);
}

export function importHistory(jsonText) {
  const incoming = JSON.parse(jsonText);
  if (!Array.isArray(incoming))
    throw new Error("Invalid format: expected an array");
  const existing = getHistory();
  const existingIds = new Set(existing.map((h) => h.id));
  // Prepend new entries (skip if id already present)
  const merged = [
    ...incoming.filter((e) => !existingIds.has(e.id)),
    ...existing,
  ].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(merged));
  return merged.length;
}

export function getCookiePref() {
  return localStorage.getItem(COOKIE_KEY) !== "false";
}

export function setCookiePref(val) {
  localStorage.setItem(COOKIE_KEY, String(val));
}

// Whether share links strip Authorization/Cookie/token values. Defaults ON.
export function getRedactPref() {
  return localStorage.getItem(REDACT_KEY) !== "false";
}

export function setRedactPref(val) {
  localStorage.setItem(REDACT_KEY, String(val));
}

export function getTheme() {
  const theme = localStorage.getItem(THEME_KEY);
  return theme === "light" ? "light" : "dark";
}

export function setTheme(val) {
  localStorage.setItem(THEME_KEY, val);
}

// ─── Nav sidebar collapse ─────────────────────────────────────────────────────
const NAV_KEY = "navCollapsed";

export function getNavCollapsed() {
  return localStorage.getItem(NAV_KEY) === "true";
}

export function setNavCollapsedPref(val) {
  localStorage.setItem(NAV_KEY, String(val));
}
