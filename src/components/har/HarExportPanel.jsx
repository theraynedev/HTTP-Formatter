import { useState } from "react";
import {
  Download,
  ArrowRight,
  Check,
  File,
  AlertCircle,
} from "reicon-react";
import {
  buildHarFromEntries,
  entriesToCsv,
  entriesToText,
  entriesToJsonl,
} from "../../utils/harOps";

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

// ─── Format option card ────────────────────────────────────────────────────────

function FormatOption({ id, label, description, icon, onSelect, selected, addToast }) {
  const Icon = icon;
  return (
    <button
      onClick={() => onSelect(id)}
      className={`text-left p-4 rounded-card border transition ${
        selected
          ? "border-line bg-surface"
          : "border-line bg-surface hover:border-line-strong hover:bg-surface-raised"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className={selected ? "text-fg" : "text-fg-subtle"} />
        <span className="text-sm font-medium text-fg">{label}</span>
      </div>
      <p className="text-2xs text-fg-subtle mt-1 leading-snug">{description}</p>
    </button>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────────

export default function HarExportPanel({
  entries,
  filteredEntries,
  rawLog,
  addToast,
}) {
  const [format, setFormat] = useState("har");
  const [scope, setScope] = useState("filtered"); // 'filtered' | 'all'

  const source = scope === "filtered" ? filteredEntries : entries;
  const count = source.length;

  const handleDownload = () => {
    if (count === 0) {
      addToast?.("Nothing to export.", "error");
      return;
    }
    const { text, ext, mime, label } = buildExport(source, format, rawLog);
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `har-export-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    addToast?.(`Downloaded ${count} entries as ${label}.`, "success");
  };

  const handleCopy = async () => {
    if (count === 0) {
      addToast?.("Nothing to copy.", "error");
      return;
    }
    const { text, label } = buildExport(source, format, rawLog);
    try {
      await navigator.clipboard.writeText(text);
      addToast?.(`${label} copied.`, "success");
    } catch (_) {
      addToast?.("Copy failed.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Scope selector ── */}
      <section>
        <SectionHeader label="Scope" />
        <div className="grid grid-cols-2 gap-2 max-w-md">
          <ScopeButton
            active={scope === "filtered"}
            onClick={() => setScope("filtered")}
            label="Filtered entries"
            sub={`${filteredEntries.length} entries`}
          />
          <ScopeButton
            active={scope === "all"}
            onClick={() => setScope("all")}
            label="All entries"
            sub={`${entries.length} entries`}
          />
        </div>
      </section>

      {/* ── Format selector ── */}
      <section>
        <SectionHeader label="Format" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <FormatOption
            id="har"
            label="HAR"
            description="Reconstructed HAR 1.2 — preserves original timing, headers, body, cookies."
            icon={File}
            onSelect={setFormat}
            selected={format === "har"}
          />
          <FormatOption
            id="csv"
            label="CSV"
            description="Spreadsheet-friendly columns: method, URL, status, timing, size."
            icon={File}
            onSelect={setFormat}
            selected={format === "csv"}
          />
          <FormatOption
            id="jsonl"
            label="JSON Lines"
            description="One JSON object per line. Streamable, easy to grep."
            icon={File}
            onSelect={setFormat}
            selected={format === "jsonl"}
          />
          <FormatOption
            id="text"
            label="Plain Text"
            description="Human-readable summary, one line per entry."
            icon={File}
            onSelect={setFormat}
            selected={format === "text"}
          />
        </div>
      </section>

      {/* ── Preview ── */}
      <section>
        <SectionHeader
          label="Preview"
          right={
            <span className="text-2xs text-fg-subtle font-mono">
              first {Math.min(count, 5)} of {count}
            </span>
          }
        />
        {count === 0 ? (
          <div className="rounded-card border border-warning/20 bg-warning/[0.04] p-6 text-center">
            <AlertCircle size={18} className="mx-auto text-warning/70 mb-2" />
            <p className="text-sm text-warning/80 font-medium">
              No entries to export
            </p>
            <p className="text-xs text-fg-subtle mt-1">
              Adjust filters or switch to "All entries" to enable export.
            </p>
          </div>
        ) : (
          <pre className="text-xs font-mono leading-5 whitespace-pre-wrap break-all bg-surface border border-line rounded-card p-3 max-h-72 overflow-auto pane-scroll text-fg">
            {buildExport(source, format, rawLog, { preview: true }).text}
          </pre>
        )}
      </section>

      {/* ── Actions ── */}
      <section>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleDownload}
            disabled={count === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-card bg-accent hover:bg-accent-hover text-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]"
          >
            <Download size={14} /> Download
          </button>
          <button
            onClick={handleCopy}
            disabled={count === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-card border border-line bg-surface-raised hover:bg-surface-overlay text-fg hover:text-fg text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ArrowRight size={13} /> Copy
          </button>
        </div>
      </section>
    </div>
  );
}

function ScopeButton({ active, onClick, label, sub }) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-card border transition ${
        active
          ? "border-line bg-surface"
          : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <span className={`block text-xs font-medium ${active ? "text-fg" : "text-fg"}`}>
        {label}
      </span>
      <span className="block text-2xs text-fg-subtle font-mono mt-0.5">{sub}</span>
    </button>
  );
}

function buildExport(entries, format, rawLog, opts = {}) {
  const preview = !!opts.preview;
  const sliceCount = preview ? Math.min(entries.length, 5) : entries.length;
  const items = preview ? entries.slice(0, sliceCount) : entries;

  switch (format) {
    case "har": {
      const text = JSON.stringify(buildHarFromEntries(items, rawLog), null, 2);
      return { text, ext: "har", mime: "application/json", label: "HAR" };
    }
    case "csv":
      return { text: entriesToCsv(items), ext: "csv", mime: "text/csv", label: "CSV" };
    case "jsonl":
      return { text: entriesToJsonl(items), ext: "jsonl", mime: "application/x-ndjson", label: "JSONL" };
    case "text":
      return { text: entriesToText(items), ext: "txt", mime: "text/plain", label: "TXT" };
    default:
      return { text: "", ext: "txt", mime: "text/plain", label: "TXT" };
  }
}