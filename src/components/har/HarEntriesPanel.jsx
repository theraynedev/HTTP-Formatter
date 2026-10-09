import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Broom,
  RowHorizontal,
  RowVertical,
  Check,
  Code,
  Clock,
  Globe,
  Refresh,
  Download,
  AlertCircle,
  Key,
} from "reicon-react";
import MethodBadge from "../MethodBadge.jsx";
import CopyButton from "../CopyButton.jsx";
import {
  formatDuration,
  formatBytes,
  statusFamily,
  statusColor,
} from "../../utils/harOps";
import { highlightHeaders, highlightJson } from "../../utils/highlight";

// ─── Header noise filter ───────────────────────────────────────────────────────
// Chrome/Firefox emit a pile of client-hint, fetch-metadata and HTTP/2
// pseudo-headers that add nothing when you are reading a captured request. The
// "Format" control next to the copy button hides them. Matched against the
// *whole* rendered line (`name: value`), so `sec-ch-ua` also covers
// `sec-ch-ua-mobile` / `sec-ch-ua-platform`, and `sec-fetch-` covers
// `-dest` / `-mode` / `-site` / `-user`.
const NOISE_HEADER_PATTERNS = [
  /^:/, // HTTP/2 pseudo-headers: :authority, :method, :path, :scheme
  /^sec-ch-ua\b/i,
  /^sec-fetch-/i,
  /^dnt\s*:\s*1\b/i,
  /^priority\s*:\s*u=1\b/i,
  /^pragma\s*:\s*no-cache\b/i,
];

function isNoiseHeader(line) {
  const s = String(line ?? "").trim();
  return NOISE_HEADER_PATTERNS.some((re) => re.test(s));
}

/** Re-serialise JSON on one line; anything unparseable is returned untouched. */
function compactJson(input) {
  if (typeof input !== "string") return input;
  try {
    return JSON.stringify(JSON.parse(input));
  } catch (_) {
    return input;
  }
}

function isParseableJson(input) {
  if (typeof input !== "string" || !input.trim()) return false;
  try {
    JSON.parse(input);
    return true;
  } catch (_) {
    return false;
  }
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, right }) {
  return (
    <div className="flex items-center gap-3 mb-2">
      <h2 className="text-xs font-semibold tracking-label uppercase text-fg-subtle">
        {label}
      </h2>
      {right}
      <span className="flex-1 h-px bg-surface-raised" />
    </div>
  );
}

// ─── Method/status filter chips ────────────────────────────────────────────────

const METHOD_PRESETS = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const STATUS_FAMILIES = ["1xx", "2xx", "3xx", "4xx", "5xx"];

function ChipToggle({ active, onClick, children, accent = "white" }) {
  const cls =
    accent === "red"
      ? active
        ? "border-danger/40 bg-danger/15 text-danger"
        : "border-line bg-surface text-fg-subtle hover:text-fg"
      : active
        ? "border-accent/40 bg-accent/15 text-accent-text"
        : "border-line bg-surface text-fg-subtle hover:text-fg";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-2xs font-medium tracking-label transition ${cls}`}
    >
      {children}
    </button>
  );
}

// ─── Detail sub-tabs ───────────────────────────────────────────────────────────

const DETAIL_TABS = [
  { id: "request", label: "Request" },
  { id: "response", label: "Response" },
  { id: "timing", label: "Timing" },
];

const MAX_FORMATTED_BODY_LENGTH = 100_000;

function EntryDetail({ entry }) {
  const [tab, setTabRaw] = useState("request");
  const [tabLoading, setTabLoading] = useState(false);

  const setTab = (next) => {
    if (next === tab) return;
    setTabLoading(true);
    setTabRaw(next);
    setTimeout(() => setTabLoading(false), 100);
  };

  // Reset to request tab when entry changes.
  useEffect(() => {
    setTabRaw("request");
    setTabLoading(false);
  }, [entry?.index]);

  if (!entry) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <MethodBadge method={entry.method} />
        <span
          className={`text-xs font-medium font-mono tabular-nums ${statusColor(entry.status)}`}
        >
          {entry.status || "???"} {entry.statusText}
        </span>
        <span className="text-2xs text-fg-subtle font-mono">
          · {formatDuration(entry.totalTime)} ·{" "}
          {formatBytes(entry.responseSize)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <p className="text-xs font-mono text-fg break-all flex-1 min-w-0">
          {entry.url}
        </p>
        <CopyButton
          getText={() => entry.url}
          size={11}
          className="w-6 h-6 shrink-0"
        />
      </div>

      <div className="flex items-center gap-1 border-b border-line">
        {DETAIL_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-xs font-semibold transition border-b-2 -mb-px ${
              tab === t.id
                ? "text-fg border-fg"
                : "text-fg-subtle border-transparent hover:text-fg hover:border-line-strong"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-xs">
        {tabLoading ? (
          <div className="space-y-2 py-1">
            {[80, 60, 90, 50, 70].map((w, i) => (
              <div
                key={i}
                className="h-3 rounded bg-surface-raised animate-pulse"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        ) : (
          renderDetailTab(entry, tab)
        )}
      </div>
    </div>
  );
}

function renderDetailTab(entry, tab) {
  if (tab === "request") return <RequestView entry={entry} />;
  if (tab === "response") return <ResponseView entry={entry} />;
  if (tab === "timing") return <TimingView entry={entry} />;
  return null;
}

function RequestView({ entry }) {
  return (
    <div className="space-y-3">
      <DetailKV label="Method" value={entry.method} mono />
      <DetailKV label="URL" value={entry.url} mono />
      {entry.queryParams.length > 0 && (
        <div>
          <p className="text-2xs tracking-label uppercase text-fg-subtle font-medium mb-1">
            Query
          </p>
          <KVList items={entry.queryParams.map((p) => [p.name, p.value])} />
        </div>
      )}
      <HeadersView headers={entry.requestHeaders} />
      {entry.requestBody && (
        <BodyView
          label="Request Body"
          contentType={entry.requestContentType}
          body={entry.requestBody}
        />
      )}
    </div>
  );
}

function ResponseView({ entry }) {
  return (
    <div className="space-y-3">
      <DetailKV
        label="Status"
        value={`${entry.status || "???"} ${entry.statusText}`.trim()}
        accent={statusColor(entry.status)}
      />
      <DetailKV label="Size" value={formatBytes(entry.responseSize)} mono />
      <DetailKV label="Type" value={entry.responseContentType ?? "—"} mono />
      <HeadersView headers={entry.responseHeaders} />
      {entry.responseBody ? (
        <BodyView
          label="Response Body"
          contentType={entry.responseContentType}
          body={entry.responseBody}
          encoding={entry.contentEncoding}
          isBase64={entry.isBase64}
        />
      ) : (
        <Empty text="No response body was captured." />
      )}
    </div>
  );
}

function TimingView({ entry }) {
  const t = entry.timings;
  const total = entry.totalTime || 0;
  const phases = [
    { label: "Blocked", value: t.blocked },
    { label: "DNS", value: t.dns },
    { label: "Connect", value: t.connect },
    { label: "SSL", value: t.ssl },
    { label: "Send", value: t.send },
    { label: "Wait (TTFB)", value: t.wait },
    { label: "Receive", value: t.receive },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-2xs tracking-label uppercase text-fg-subtle font-medium">
          Total
        </p>
        <p className="text-sm font-mono text-fg font-medium">
          {formatDuration(total)}
        </p>
      </div>

      <div>
        <p className="text-2xs tracking-label uppercase text-fg-subtle font-medium mb-2">
          Phases
        </p>
        <div className="space-y-1">
          {phases.map((p) => {
            const v = p.value ?? 0;
            const pct = total > 0 ? (v / total) * 100 : 0;
            return (
              <div
                key={p.label}
                className="grid grid-cols-[120px_1fr_80px] items-center gap-2"
              >
                <span className="text-2xs font-mono text-fg-muted">
                  {p.label}
                </span>
                <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                  <div
                    className="h-full bg-surface"
                    style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                  />
                </div>
                <span className="text-2xs font-mono text-fg tabular-nums text-right">
                  {formatDuration(v)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <KVList
        items={[
          ["Server IP", entry.serverIPAddress ?? "—"],
          ["Started", entry.startedDateTime ?? "—"],
        ]}
      />
    </div>
  );
}

function HeadersView({ headers }) {
  // Hooks run before the empty guard so the hook order never changes.
  const [cleaned, setCleaned] = useState(false);

  // A different entry (or a different header set) starts unfolded.
  useEffect(() => {
    setCleaned(false);
  }, [headers]);

  if (!headers?.length) return <Empty text="No headers." />;

  const hiddenCount = headers.filter(isNoiseHeader).length;
  const shown = cleaned ? headers.filter((h) => !isNoiseHeader(h)) : headers;
  // Strip the ": " separator so the copied value matches what's in the
  // displayed block. Also keeps it round-trippable for `curl -H` flags.
  // Copies whatever is on screen, so a cleaned list copies clean.
  const getText = () => shown.map((h) => h.replace(/:\s*/, ": ")).join("\n");

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <p className="text-2xs tracking-label uppercase text-fg-subtle font-medium">
          Headers
        </p>
        <span className="flex-1 h-px bg-surface" />
        {cleaned && hiddenCount > 0 && (
          <span className="text-2xs text-fg-subtle font-mono whitespace-nowrap">
            {hiddenCount} hidden
          </span>
        )}
        <button
          onClick={() => setCleaned((v) => !v)}
          aria-pressed={cleaned}
          title={
            cleaned
              ? "Show all headers again"
              : "Hide browser noise headers (:authority, :method, :path, :scheme, sec-ch-ua, sec-fetch-*, dnt: 1, priority: u=1, pragma: no-cache)"
          }
          className={`inline-flex items-center gap-1 px-2 h-6 rounded-control border text-2xs font-medium transition ${
            cleaned
              ? "border-line-strong bg-surface-raised text-fg"
              : "border-line bg-surface-raised text-fg-muted hover:text-fg hover:border-line-strong"
          }`}
        >
          <Broom size={10} />
          Format
        </button>
        <CopyButton getText={getText} size={11} className="w-6 h-6" />
      </div>
      <pre
        className="font-mono text-xs leading-6 whitespace-pre-wrap break-all text-fg bg-surface border border-line rounded-control p-3 max-h-60 overflow-auto pane-scroll"
        dangerouslySetInnerHTML={{ __html: highlightHeaders(shown, false) }}
      />
    </div>
  );
}

// Manual Base64 decode: atob() the displayed text to bytes, then UTF-8 decode
// the bytes back to a string. We try `atob` straight on the input — if it
// throws (e.g. user is looking at plain text and clicks Base64 anyway), we
// surface a clear message instead of crashing. Returns null on hard failure
// so the UI can decide whether to swap the body.
function tryBase64Decode(input) {
  if (typeof input !== "string" || !input)
    return { ok: false, reason: "empty" };
  // Strip whitespace/newlines so pretty-printed base64 still decodes.
  const cleaned = input.replace(/\s+/g, "");
  try {
    const bin = atob(cleaned);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return { ok: true, decoded };
  } catch (e) {
    return {
      ok: false,
      reason: "not-base64",
      message: e?.message ?? "Invalid base64.",
    };
  }
}

function BodyView({ label, contentType, body, encoding, isBase64 }) {
  // Manual controls — no automatic Content-Encoding decompression. The user
  // can opt into Base64 decoding with the button below.
  const [base64On, setBase64On] = useState(false);
  const [decodedCache, setDecodedCache] = useState(null);
  const [base64Error, setBase64Error] = useState(null);
  const [compact, setCompact] = useState(false);

  // Reset whenever the underlying body changes (e.g. user picked a different
  // entry in the list). Otherwise stale decoded text could leak across rows.
  useEffect(() => {
    setBase64On(false);
    setDecodedCache(null);
    setBase64Error(null);
    setCompact(false);
  }, [body]);

  const handleToggleBase64 = () => {
    if (base64On) {
      setBase64On(false);
      return;
    }
    if (decodedCache !== null) {
      setBase64On(true);
      return;
    }
    const result = tryBase64Decode(body);
    if (!result.ok) {
      setBase64Error(
        result.reason === "empty"
          ? "Nothing to decode."
          : "Not valid base64 — leaving body as-is.",
      );
      return;
    }
    setDecodedCache(result.decoded);
    setBase64Error(null);
    setBase64On(true);
  };

  const source = base64On && decodedCache !== null ? decodedCache : body;
  // Compact only offered for something we can actually re-serialise — a
  // pretty-printed JSON body. Derived from the *current* text, so it follows
  // the base64 toggle.
  const canCompact = useMemo(
    () =>
      source.length <= MAX_FORMATTED_BODY_LENGTH && isParseableJson(source),
    [source],
  );
  const text = compact && canCompact ? compactJson(source) : source;
  const isJson = (contentType ?? "").toLowerCase().includes("json");
  const encodingBadge =
    encoding && encoding.toLowerCase() !== "identity" ? encoding : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <p className="text-2xs tracking-label uppercase text-fg-subtle font-medium">
          {label}
        </p>
        {contentType ? (
          <span className="text-2xs text-fg-subtle">· {contentType}</span>
        ) : null}
        {encodingBadge ? (
          <span
            className="text-2xs text-fg-subtle font-mono"
            title={`Response uses Content-Encoding: ${encodingBadge}. Body is shown as stored.`}
          >
            · {encodingBadge}
          </span>
        ) : null}
        {base64On ? (
          <span className="text-2xs text-success/80 font-mono">
            · base64 decoded
          </span>
        ) : null}
        {base64Error ? (
          <span className="flex items-center gap-1 text-2xs text-warning/90">
            <AlertCircle size={9} />
            {base64Error}
          </span>
        ) : null}
        <span className="flex-1 h-px bg-surface" />
        <button
          onClick={handleToggleBase64}
          title={
            base64On
              ? "Restore raw body"
              : isBase64
                ? "Decode base64 (HAR says the body is base64-encoded)"
                : "Try to base64-decode the current body"
          }
          aria-label="Toggle base64 decoding"
          className={`inline-flex items-center gap-1 px-2 h-6 rounded-control border text-2xs font-medium transition ${
            base64On
              ? "border-success/40 bg-success/10 text-success hover:bg-success/15"
              : "border-line bg-surface-raised text-fg-muted hover:text-fg hover:border-line-strong"
          }`}
        >
          <Key size={10} />
          {base64On ? "Raw" : "Base64"}
        </button>
        {canCompact && (
          <button
            onClick={() => setCompact((v) => !v)}
            title={
              compact
                ? "Expand back to pretty-printed JSON"
                : "Collapse this JSON body onto a single line"
            }
            aria-pressed={compact}
            className={`inline-flex items-center gap-1 px-2 h-6 rounded-control border text-2xs font-medium transition ${
              compact
                ? "border-line-strong bg-surface-raised text-fg"
                : "border-line bg-surface-raised text-fg-muted hover:text-fg hover:border-line-strong"
            }`}
          >
            {compact ? <RowVertical size={10} /> : <RowHorizontal size={10} />}
            {compact ? "Pretty" : "Compact"}
          </button>
        )}
        <CopyButton getText={() => text} size={11} className="w-6 h-6" />
      </div>
      <pre
        className="font-mono text-xs leading-5 whitespace-pre-wrap break-all text-fg bg-surface border border-line rounded-card p-3 max-h-[50vh] overflow-auto pane-scroll"
        dangerouslySetInnerHTML={{
          __html:
            isJson &&
            typeof text === "string" &&
            text.length <= MAX_FORMATTED_BODY_LENGTH
              ? highlightJson(text, compact ? 0 : 2)
              : escapeHtml(text),
        }}
      />
    </div>
  );
}

function KVList({ items }) {
  return (
    <div className="rounded-control border border-line bg-surface overflow-hidden divide-y divide-line">
      {items.map(([k, v], i) => (
        <div
          key={i}
          className="grid grid-cols-[140px_1fr] gap-3 px-3 py-2 text-xs font-mono"
        >
          <span className="text-fg-subtle truncate">{k}</span>
          <span className="text-fg break-all min-w-0">{v ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

function DetailKV({ label, value, mono = false, accent = null }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-xs">
      <span className="text-fg-subtle font-medium tracking-label">{label}</span>
      <span
        className={`break-all min-w-0 ${mono ? "font-mono" : ""} ${accent ?? "text-fg"}`}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function Empty({ text }) {
  return <p className="text-xs text-fg-subtle italic">{text}</p>;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function EntryRow({ entry, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full grid grid-cols-[70px_60px_minmax(0,1fr)_70px_70px] items-center gap-2 px-3 py-2 text-left text-xs transition border-b border-line ${
        selected
          ? "bg-accent/10 shadow-[inset_2px_0_0_rgb(var(--c-accent))]"
          : "hover:bg-surface-raised"
      }`}
    >
      <MethodBadge method={entry.method} size="xs" />
      <span
        className={`font-mono tabular-nums font-medium ${statusColor(entry.status)}`}
      >
        {entry.status || "—"}
      </span>
      <span className="font-mono text-fg truncate min-w-0">{entry.path}</span>
      <span className="font-mono text-fg-subtle text-2xs tabular-nums text-right">
        {formatBytes(entry.responseSize)}
      </span>
      <span className="font-mono text-fg-subtle text-2xs tabular-nums text-right">
        {formatDuration(entry.totalTime)}
      </span>
    </button>
  );
}

// ─── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({
  search,
  setSearch,
  methods,
  toggleMethod,
  statuses,
  toggleStatus,
  hosts,
  toggleHost,
  availableHosts,
  resetFilters,
  filteredCount,
  totalCount,
}) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          size={12}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by URL, status, method…"
          className="w-full pl-7 pr-3 py-1.5 bg-surface border border-line rounded-control text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-2xs tracking-label uppercase text-fg-subtle font-medium mr-1">
          Method
        </span>
        {METHOD_PRESETS.map((m) => (
          <ChipToggle
            key={m}
            active={methods.has(m)}
            onClick={() => toggleMethod(m)}
          >
            {m}
          </ChipToggle>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-2xs tracking-label uppercase text-fg-subtle font-medium mr-1">
          Status
        </span>
        {STATUS_FAMILIES.map((s) => (
          <ChipToggle
            key={s}
            active={statuses.has(s)}
            onClick={() => toggleStatus(s)}
            accent={s === "4xx" || s === "5xx" ? "red" : "white"}
          >
            {s}
          </ChipToggle>
        ))}
      </div>

      {availableHosts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-2xs tracking-label uppercase text-fg-subtle font-medium mr-1">
            Host
          </span>
          {availableHosts.slice(0, 8).map((h) => (
            <ChipToggle
              key={h}
              active={hosts.has(h)}
              onClick={() => toggleHost(h)}
            >
              {h}
            </ChipToggle>
          ))}
          {availableHosts.length > 8 && (
            <span className="text-2xs text-fg-subtle">
              +{availableHosts.length - 8} more
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 text-2xs text-fg-subtle font-mono pt-1">
        <span>
          {filteredCount} of {totalCount} entries
        </span>
        {(methods.size > 0 ||
          statuses.size > 0 ||
          hosts.size > 0 ||
          search) && (
          <button
            onClick={resetFilters}
            className="text-fg-subtle hover:text-fg font-medium underline-offset-2 hover:underline"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export default function HarEntriesPanel({
  entries,
  filteredEntries,
  search,
  setSearch,
  methods,
  toggleMethod,
  statuses,
  toggleStatus,
  hosts,
  toggleHost,
  resetFilters,
  availableHosts,
  pendingSelectedIndex = null,
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const listRef = useRef(null);

  // Default selection: first entry once data lands or filter changes
  useEffect(() => {
    if (pendingSelectedIndex !== null) {
      // Honor external cross-panel jump from Insights.
      const target = entries.find((e) => e.index === pendingSelectedIndex);
      if (target) {
        setSelectedIndex(target.index);
        return;
      }
    }
    if (filteredEntries.length === 0) {
      setSelectedIndex(null);
      return;
    }
    const stillVisible = filteredEntries.find((e) => e.index === selectedIndex);
    if (!stillVisible) setSelectedIndex(filteredEntries[0].index);
  }, [filteredEntries, pendingSelectedIndex, entries]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedEntry = useMemo(
    () => entries.find((e) => e.index === selectedIndex) ?? null,
    [entries, selectedIndex],
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
      {/* ── Left: list + filter ── */}
      <div>
        <SectionHeader
          label="Entries"
          right={
            <span className="text-2xs text-fg-subtle font-mono">
              {filteredEntries.length}/{entries.length}
            </span>
          }
        />
        <div className="rounded-card border border-line bg-surface p-3 mb-2">
          <FilterBar
            search={search}
            setSearch={setSearch}
            methods={methods}
            toggleMethod={toggleMethod}
            statuses={statuses}
            toggleStatus={toggleStatus}
            hosts={hosts}
            toggleHost={toggleHost}
            availableHosts={availableHosts}
            resetFilters={resetFilters}
            filteredCount={filteredEntries.length}
            totalCount={entries.length}
          />
        </div>

        <div
          ref={listRef}
          className="rounded-card border border-line bg-surface overflow-hidden max-h-[600px] overflow-y-auto pane-scroll"
        >
          {filteredEntries.length === 0 ? (
            <p className="text-xs text-fg-subtle italic p-4 text-center">
              No entries match your filters.
            </p>
          ) : (
            filteredEntries.map((e) => (
              <EntryRow
                key={e.index}
                entry={e}
                selected={selectedIndex === e.index}
                onSelect={() => setSelectedIndex(e.index)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right: detail ── */}
      <div>
        <SectionHeader label="Detail" />
        <div className="rounded-card border border-line bg-surface p-4 min-h-[600px]">
          {selectedEntry ? (
            <EntryDetail entry={selectedEntry} />
          ) : (
            <p className="text-xs text-fg-subtle italic text-center mt-12">
              Select an entry to inspect its request, response, and timing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
