import { useState, useMemo, useRef, useEffect } from "react";
import {
  Upload,
  Archive,
  Document,
  Trash,
  AlertCircle,
  CheckCircle,
  Clock,
  Globe,
  Sparkles,
  ArrowRight,
} from "reicon-react";
import HarEntriesPanel from "./har/HarEntriesPanel.jsx";
import HarInsightsPanel from "./har/HarInsightsPanel.jsx";
import HarExportPanel from "./har/HarExportPanel.jsx";
import { Skeleton, SkeletonGroup, SkeletonRows } from "./Skeleton.jsx";
import {
  parseHarFile,
  filterEntries,
  getInsights,
  formatBytes,
  formatDuration,
} from "../utils/harOps";

// ─── Sub-tabs ─────────────────────────────────────────────────────────────────

const SUB_TABS = [
  { id: "entries", label: "Entries" },
  { id: "insights", label: "Insights" },
  { id: "export", label: "Export" },
];

// ─── Sample HAR ───────────────────────────────────────────────────────────────
// A tiny but realistic HAR so users can try the toolkit without exporting
// from a browser. Includes a variety of methods / statuses / hosts.
const SAMPLE_HAR = JSON.stringify(
  {
    log: {
      version: "1.2",
      creator: { name: "HTTP Formatter HAR Analyzer", version: "1.0" },
      entries: [
        {
          startedDateTime: "2025-01-15T10:00:00.000Z",
          time: 142,
          request: {
            method: "GET",
            url: "https://api.example.com/users",
            headers: [
              { name: "Accept", value: "application/json" },
              { name: "Authorization", value: "Bearer demo-token" },
            ],
            queryString: [{ name: "page", value: "1" }],
          },
          response: {
            status: 200,
            statusText: "OK",
            headers: [{ name: "Content-Type", value: "application/json" }],
            content: {
              mimeType: "application/json",
              size: 412,
              text: '{"users":[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]}',
            },
          },
          timings: { send: 1, wait: 110, receive: 31 },
        },
        {
          startedDateTime: "2025-01-15T10:00:01.000Z",
          time: 88,
          request: {
            method: "POST",
            url: "https://api.example.com/users",
            headers: [
              { name: "Content-Type", value: "application/json" },
              { name: "Authorization", value: "Bearer demo-token" },
            ],
            postData: {
              mimeType: "application/json",
              text: '{"name":"Alan","email":"alan@example.com"}',
            },
          },
          response: {
            status: 201,
            statusText: "Created",
            headers: [{ name: "Content-Type", value: "application/json" }],
            content: {
              mimeType: "application/json",
              size: 64,
              text: '{"id":3}',
            },
          },
          timings: { send: 2, wait: 60, receive: 26 },
        },
        {
          startedDateTime: "2025-01-15T10:00:02.000Z",
          time: 1820,
          request: {
            method: "GET",
            url: "https://cdn.example.com/assets/main.css",
            headers: [{ name: "Accept", value: "text/css" }],
          },
          response: {
            status: 200,
            statusText: "OK",
            headers: [{ name: "Content-Type", value: "text/css" }],
            content: { mimeType: "text/css", size: 18420 },
            _isBase64: false,
            text: "/* demo css */",
          },
          timings: { send: 1, wait: 1450, receive: 369 },
        },
        {
          startedDateTime: "2025-01-15T10:00:03.000Z",
          time: 35,
          request: {
            method: "GET",
            url: "https://cdn.example.com/assets/logo.svg",
          },
          response: {
            status: 404,
            statusText: "Not Found",
            headers: [{ name: "Content-Type", value: "text/plain" }],
            content: { mimeType: "text/plain", size: 18, text: "Not Found\n" },
          },
          timings: { send: 1, wait: 20, receive: 14 },
        },
        {
          startedDateTime: "2025-01-15T10:00:04.000Z",
          time: 612,
          request: {
            method: "PUT",
            url: "https://api.example.com/users/2",
            headers: [{ name: "Content-Type", value: "application/json" }],
            postData: {
              mimeType: "application/json",
              text: '{"name":"Grace Hopper"}',
            },
          },
          response: {
            status: 500,
            statusText: "Internal Server Error",
            headers: [{ name: "Content-Type", value: "application/json" }],
            content: {
              mimeType: "application/json",
              size: 32,
              text: '{"error":"boom"}',
            },
          },
          timings: { send: 2, wait: 580, receive: 30 },
        },
        {
          startedDateTime: "2025-01-15T10:00:05.000Z",
          time: 240,
          request: {
            method: "DELETE",
            url: "https://api.example.com/users/99",
            headers: [{ name: "Authorization", value: "Bearer demo-token" }],
          },
          response: {
            status: 204,
            statusText: "No Content",
            headers: [],
            content: { mimeType: null, size: 0 },
          },
          timings: { send: 1, wait: 220, receive: 19 },
        },
        {
          startedDateTime: "2025-01-15T10:00:06.000Z",
          time: 76,
          request: {
            method: "PATCH",
            url: "https://api.example.com/users/1",
            headers: [{ name: "Content-Type", value: "application/json" }],
            postData: {
              mimeType: "application/json",
              text: '{"name":"Ada L."}',
            },
          },
          response: {
            status: 200,
            statusText: "OK",
            headers: [{ name: "Content-Type", value: "application/json" }],
            content: {
              mimeType: "application/json",
              size: 38,
              text: '{"id":1,"name":"Ada L."}',
            },
          },
          timings: { send: 1, wait: 50, receive: 25 },
        },
      ],
    },
  },
  null,
  2,
);

// ─── File meta strip ──────────────────────────────────────────────────────────

function FileMetaStrip({ fileMeta, log, entries, onReset }) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-card border border-line bg-surface">
      <div className="flex items-center gap-2 mr-2 min-w-0">
        <span className="w-6 h-6 rounded-control bg-surface-raised border border-line flex items-center justify-center shrink-0">
          <Archive size={11} className="text-fg-muted" />
        </span>
        <div className="leading-tight min-w-0">
          <p className="text-xs font-medium text-fg truncate max-w-md">
            {fileMeta?.name ?? "Untitled HAR"}
          </p>
          <p className="text-2xs text-fg-subtle font-mono">
            {fileMeta ? `${formatBytes(fileMeta.size)} · ` : ""}
            HAR {log?.version ?? "?"}
            {log?.creator?.name ? ` · ${log.creator.name}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 ml-auto">
        <span className="text-2xs tracking-label uppercase text-fg-subtle font-medium">
          <span className="text-fg">{entries.length}</span> entries
        </span>
        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2 py-1 rounded-control border border-line bg-surface-raised hover:bg-surface-overlay text-fg-muted hover:text-fg text-2xs font-medium transition"
        >
          <Trash size={11} /> Clear
        </button>
      </div>
    </div>
  );
}

// ─── Empty state: drop / paste / sample ───────────────────────────────────────

function HarDropZone({ onLoad, addToast }) {
  const [dragging, setDragging] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef(null);

  const tryLoad = (text, source) => {
    if (!text.trim()) {
      addToast?.("Empty input.", "error");
      setParsing(false);
      return;
    }
    setParsing(true);
    // Parsing a large HAR is synchronous and can block the main thread for a
    // while. Hand the frame back first so the skeleton actually paints.
    setTimeout(() => {
      const result = parseHarFile(text);
      if (!result.ok) {
        addToast?.(result.error, "error");
        setParsing(false);
        return;
      }
      onLoad({ parsed: result, fileMeta: { name: source, size: text.length } });
      addToast?.(
        `Loaded ${result.entries.length} request${result.entries.length !== 1 ? "s" : ""}.`,
        "success",
      );
    }, 0);
  };

  const handleFile = (file) => {
    if (!file) return;
    setParsing(true);
    const reader = new FileReader();
    reader.onerror = () => {
      addToast?.("Could not read that file.", "error");
      setParsing(false);
    };
    reader.onload = (ev) => tryLoad(ev.target.result, file.name);
    reader.readAsText(file);
  };

  // Reading + parsing a dropped file: hold the shape of the result so the
  // layout doesn't jump when the entries land.
  if (parsing) {
    return (
      <div className="w-full max-w-2xl">
        <SkeletonGroup label="Reading HAR file…">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-card" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-52 max-w-full" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <div className="mt-5 rounded-card border border-line bg-surface p-3">
            <SkeletonRows rows={7} />
          </div>
        </SkeletonGroup>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      {/* ── Drop target ── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`w-full max-w-2xl rounded-panel border-2 border-dashed transition-colors p-12 text-center ${
          dragging ? "border-line bg-surface" : "border-line bg-surface"
        }`}
      >
        <div className="w-12 h-12 mx-auto rounded-panel bg-surface-raised border border-line flex items-center justify-center mb-3">
          <Upload size={20} className="text-fg-subtle" />
        </div>
        <p className="text-sm text-fg font-medium mb-1">Drop a HAR file here</p>
        <p className="text-xs text-fg-subtle mb-4">
          Or pick one from disk, paste it, or load the sample.
        </p>

        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-card bg-accent hover:bg-accent-hover text-white text-sm font-medium transition active:scale-[0.99]"
          >
            <Document size={13} /> Choose file
          </button>
          <button
            onClick={() => tryLoad(SAMPLE_HAR, "sample.har")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-card border border-line bg-surface-raised hover:bg-surface-overlay text-fg text-sm font-medium transition"
          >
            <Sparkles size={13} /> Load sample
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".har,application/json,application/x-har+json"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {/* ── Paste textarea ── */}
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xs font-semibold tracking-label uppercase text-fg-subtle">
            Or paste HAR content
          </h2>
          <span className="flex-1 h-px bg-surface-raised" />
        </div>
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder='{"log":{"version":"1.2","creator":{...},"entries":[...]}}'
          spellCheck={false}
          autoComplete="off"
          className="w-full h-40 bg-surface border border-line rounded-card p-3 font-mono text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-accent resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-2xs text-fg-subtle font-mono">
            {pastedText.length.toLocaleString()} chars
          </span>
          <button
            onClick={() => tryLoad(pastedText, "pasted.har")}
            disabled={!pastedText.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised hover:bg-surface-overlay text-fg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Parse <ArrowRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-tab bar ──────────────────────────────────────────────────────────────

function SubTabBar({ tab, setTab }) {
  return (
    <div className="flex items-center gap-1 border-b border-line">
      {SUB_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          aria-pressed={tab === t.id}
          className={`px-3 py-2 text-xs font-semibold transition border-b-2 -mb-px ${
            tab === t.id
              ? "text-accent-text border-accent bg-accent/10"
              : "text-fg-subtle border-transparent hover:text-fg hover:border-line-strong"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export default function HarToolkit({ addToast, seed, onSeedConsumed }) {
  const [parsed, setParsed] = useState(null); // { ok, error, log, entries, rawLog }
  const [fileMeta, setFileMeta] = useState(null);
  const [tab, setTabRaw] = useState("entries");
  const [tabLoading, setTabLoading] = useState(false);

  const setTab = (next) => {
    if (next === tab) return;
    setTabLoading(true);
    setTabRaw(next);
    setTimeout(() => setTabLoading(false), 120);
  };

  // Shared filter state
  const [search, setSearch] = useState("");
  const [methods, setMethods] = useState(() => new Set());
  const [statuses, setStatuses] = useState(() => new Set());
  const [hosts, setHosts] = useState(() => new Set());

  // Cross-panel navigation: Insights → Entries
  const [pendingSelectedIndex, setPendingSelectedIndex] = useState(null);

  const entries = parsed?.entries ?? [];
  const rawLog = parsed?.rawLog ?? null;

  const availableHosts = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => e.host && set.add(e.host));
    return [...set].sort();
  }, [entries]);

  const filteredEntries = useMemo(
    () =>
      filterEntries(entries, {
        search,
        methods: methods.size > 0 ? methods : null,
        statuses: statuses.size > 0 ? statuses : null,
        hosts: hosts.size > 0 ? hosts : null,
      }),
    [entries, search, methods, statuses, hosts],
  );

  const insights = useMemo(
    () => getInsights(filteredEntries),
    [filteredEntries],
  );

  const toggle = (setter) => (value) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };
  const toggleMethod = toggle(setMethods);
  const toggleStatus = toggle(setStatuses);
  const toggleHost = toggle(setHosts);

  const resetFilters = () => {
    setSearch("");
    setMethods(new Set());
    setStatuses(new Set());
    setHosts(new Set());
  };

  const handleLoad = ({ parsed, fileMeta }) => {
    setParsed(parsed);
    setFileMeta(fileMeta);
    resetFilters();
    setTab("entries");
    setPendingSelectedIndex(null);
  };

  const handleReset = () => {
    setParsed(null);
    setFileMeta(null);
    resetFilters();
    setPendingSelectedIndex(null);
  };

  // History → "Send to Analyzer" pushes a pre-parsed document in through the
  // exact same path a dropped file takes, so nothing downstream can tell the
  // difference. The seed is consumed once and then cleared by the parent —
  // otherwise leaving and re-entering this page would reload the same request.
  useEffect(() => {
    if (!seed?.parsed) return;
    handleLoad(seed);
    onSeedConsumed?.();
    // handleLoad is stable in practice (plain setState wrappers) — re-running
    // on it would only re-apply the same seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // Insights → Entries cross-panel jump
  const handleSelectFromInsights = (index) => {
    setPendingSelectedIndex(index);
    setTab("entries");
  };

  // When tab returns to entries, clear the pending selection so it only
  // fires once.
  useEffect(() => {
    if (tab === "entries" && pendingSelectedIndex !== null) {
      // HarEntriesPanel will handle the actual selection via prop.
      // We schedule a one-shot clearing in a microtask so the panel
      // sees the index first.
      const t = setTimeout(() => setPendingSelectedIndex(null), 0);
      return () => clearTimeout(t);
    }
  }, [tab, pendingSelectedIndex]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!parsed) {
    return (
      <div className="h-full min-h-0 overflow-y-auto pane-scroll">
        <div className="space-y-6 pb-4">
          <div>
            <h1 className="text-lg font-semibold text-fg">HAR Analyzer</h1>
            <p className="text-xs text-fg-subtle mt-1">
              Inspect, filter, and export HTTP Archive (HAR) files. Drop a HAR
              exported from Chrome DevTools, Safari, or Fiddler.
            </p>
          </div>
          <HarDropZone onLoad={handleLoad} addToast={addToast} />
        </div>
      </div>
    );
  }

  // After successful parse
  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="shrink-0 flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-fg">HAR Analyzer</h1>
          <p className="text-xs text-fg-subtle mt-0.5">
            {insights.total} of {entries.length} entries ·{" "}
            {formatDuration(insights.totalTime)} total ·{" "}
            {formatBytes(insights.totalBytes)} transferred
          </p>
        </div>
      </div>

      {/* ── File meta strip ── */}
      <div className="shrink-0">
        <FileMetaStrip
          fileMeta={fileMeta}
          log={parsed.log}
          entries={entries}
          onReset={handleReset}
        />
      </div>

      {/* ── Sub-tabs ── */}
      <div className="shrink-0">
        <SubTabBar tab={tab} setTab={setTab} />
      </div>

      {/* ── Active panel ── */}
      <div className="flex-1 min-h-0 overflow-y-auto pane-scroll">
        {tabLoading ? (
          <SkeletonGroup label="">
            <SkeletonRows count={8} />
          </SkeletonGroup>
        ) : (
          <div className="pb-4">
            <div style={{ display: tab === "entries" ? "block" : "none" }}>
              <HarEntriesPanel
                entries={entries}
                filteredEntries={filteredEntries}
                search={search}
                setSearch={setSearch}
                methods={methods}
                toggleMethod={toggleMethod}
                statuses={statuses}
                toggleStatus={toggleStatus}
                hosts={hosts}
                toggleHost={toggleHost}
                resetFilters={resetFilters}
                availableHosts={availableHosts}
                pendingSelectedIndex={pendingSelectedIndex}
              />
            </div>
            <div style={{ display: tab === "insights" ? "block" : "none" }}>
              <HarInsightsPanel
                insights={insights}
                entries={entries}
                onSelect={handleSelectFromInsights}
              />
            </div>
            <div style={{ display: tab === "export" ? "block" : "none" }}>
              <HarExportPanel
                entries={entries}
                filteredEntries={filteredEntries}
                rawLog={rawLog}
                addToast={addToast}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
