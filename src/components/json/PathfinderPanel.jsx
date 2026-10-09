import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import {
  Upload,
  Document,
  Trash,
  Copy3,
  Check,
  Download,
  Brush,
  Compress,
  CheckCircle,
  AlertCircle,
  Sort,
  Filter,
  Hashtag,
  Sparkles,
  MagicWand,
  Refresh,
  ArrowRight,
} from "reicon-react";
import JsonTree from "./JsonTree.jsx";
import {
  parseJsonSafe,
  formatJson,
  minifyJson,
  sortJson,
  removeEmptyJson,
  removeDuplicatesJson,
  escapeJson,
  unescapeJson,
  jsonToYaml,
  jsonToXml,
  summarize,
  countRecords,
} from "../../utils/jsonOps";

const SAMPLE = JSON.stringify(
  {
    users: [
      {
        name: "Ada Lovelace",
        email: "ada@example.com",
        organization: "Acme Inc.",
        active: true,
        address: { city: "London", country: "UK" },
      },
      {
        name: "Grace Hopper",
        email: "grace@example.com",
        organization: "Globex",
        active: true,
        address: { city: "New York", country: "USA" },
      },
      {
        name: "Alan Turing",
        email: "alan@example.com",
        organization: "Acme Inc.",
        active: false,
        address: { city: "Manchester", country: "UK" },
      },
    ],
    metadata: { total: 3, generated: "" },
  },
  null,
  2,
);

// ─── Action button ────────────────────────────────────────────────────────────

function ActionButton({ onClick, children, title, destructive = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-control border text-xs font-medium transition ${
        destructive
          ? "border-line bg-surface-raised text-fg-muted hover:text-danger hover:border-danger/30"
          : "border-line bg-surface-raised text-fg hover:text-fg hover:bg-surface-overlay"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Validation banner ────────────────────────────────────────────────────────

function ValidationBanner({ validation }) {
  if (!validation || validation.ok === null) return null;
  if (validation.ok) {
    return (
      <div className="flex items-center gap-2 text-xs text-success px-1">
        <CheckCircle size={12} />
        Valid JSON · {validation.summary}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 text-xs text-danger px-1">
      <AlertCircle size={12} className="mt-0.5 shrink-0" />
      <span className="break-all">{validation.error}</span>
    </div>
  );
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

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function PathfinderPanel({ addToast }) {
  const [input, setInput] = useState(SAMPLE);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Debounce: parsing JSON + building the tree on every keystroke makes
  // the textarea feel laggy for big docs. Coalesce to one parse per 150ms
  // of inactivity. The textarea itself stays bound to `input` so typing
  // feels instant.
  const [debouncedInput, setDebouncedInput] = useState(input);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedInput(input), 150);
    return () => clearTimeout(t);
  }, [input]);

  // Live validation
  const validation = useMemo(() => {
    const trimmed = debouncedInput.trim();
    if (!trimmed) return { ok: null, error: null, summary: "" };
    const result = parseJsonSafe(debouncedInput);
    if (!result.ok) return { ok: false, error: result.error, summary: "" };
    const sum = summarize(result.value);
    const records = countRecords(result.value);
    const summary = `${sum.kind} · ${sum.count} ${sum.kind === "array" ? "items" : sum.kind === "object" ? "keys" : ""} · ${records} record${records !== 1 ? "s" : ""}`;
    return { ok: true, error: null, summary, value: result.value };
  }, [debouncedInput]);

  // ─── File / drop handlers ──────────────────────────────────────────────────

  const ingestFile = useCallback(
    (file) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setInput(ev.target.result);
        addToast?.(`Loaded ${file.name}.`, "success");
      };
      reader.onerror = () => addToast?.("Failed to read file.", "error");
      reader.readAsText(file);
    },
    [addToast],
  );

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      addToast?.("Only .json files are supported.", "error");
      return;
    }
    ingestFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) ingestFile(file);
    e.target.value = "";
  };

  // ─── Transformations (apply on the current input) ──────────────────────────

  const apply = (op, label) => {
    const result = op(input);
    if (!result.ok) {
      addToast?.(`${label}: ${result.error}`, "error", 5000);
      return false;
    }
    setInput(result.text);
    addToast?.(`${label} applied.`, "success");
    return true;
  };

  const handleBeautify = () => apply(formatJson, "Beautify");
  const handleMinify = () => apply(minifyJson, "Minify");
  const handleSort = () => apply(sortJson, "Sort keys");
  const handleRemoveEmpty = () => apply(removeEmptyJson, "Remove empty values");
  const handleRemoveDuplicates = () => apply(removeDuplicatesJson, "Remove duplicates");
  const handleEscape = () => apply(escapeJson, "Escape");
  const handleUnescape = () => apply(unescapeJson, "Unescape");

  const handleValidate = () => {
    if (!input.trim()) {
      addToast?.("Paste JSON first.", "error");
      return;
    }
    if (validation.ok) {
      addToast?.("JSON is valid.", "success");
    } else {
      addToast?.(`Invalid JSON: ${validation.error}`, "error", 5000);
    }
  };

  // ─── Clipboard / download ──────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!input.trim()) {
      addToast?.("Nothing to copy.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(input);
      addToast?.("JSON copied to clipboard.", "success");
    } catch (_) {
      addToast?.("Copy failed.", "error");
    }
  };

  const handleDownload = () => {
    if (!input.trim()) {
      addToast?.("Nothing to download.", "error");
      return;
    }
    const blob = new Blob([input], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `json-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast?.("Downloaded.", "success");
  };

  const handleClear = () => {
    if (!input.trim()) return;
    setInput("");
    addToast?.("Cleared.", "info", 1500);
  };

  // ─── Conversions ───────────────────────────────────────────────────────────

  const exportTransformed = (transform, ext, mime, label) => {
    const parsed = parseJsonSafe(input);
    if (!parsed.ok) {
      addToast?.(`${label}: ${parsed.error}`, "error", 5000);
      return;
    }
    const out = transform(parsed.value);
    const blob = new Blob([out], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `json-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    addToast?.(`Downloaded as ${ext.toUpperCase()}.`, "success");
  };

  const handleExportCsv = () => {
    const parsed = parseJsonSafe(input);
    if (!parsed.ok) {
      addToast?.(`CSV: ${parsed.error}`, "error", 5000);
      return;
    }
    const value = parsed.value;
    let columns = [];
    let rows = [];
    if (Array.isArray(value)) {
      const keySet = new Set();
      for (const item of value) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          for (const k of Object.keys(item)) keySet.add(k);
        }
      }
      columns = [...keySet];
      rows = value.map((item) =>
        columns.map((c) => (item && typeof item === "object" ? item[c] : "")),
      );
    } else if (value && typeof value === "object") {
      columns = ["key", "value"];
      rows = Object.entries(value).map(([k, v]) => [k, v]);
    } else {
      columns = ["value"];
      rows = [[value]];
    }
    const out = jsonToCsv(columns, rows);
    const blob = new Blob([out], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `json-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast?.("Downloaded as CSV.", "success");
  };

  const handleExportYaml = () =>
    exportTransformed((v) => jsonToYaml(v), "yaml", "text/yaml", "YAML");
  const handleExportXml = () =>
    exportTransformed((v) => jsonToXml(v, "root"), "xml", "application/xml", "XML");

  // ─── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Editor + Tree (split) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor */}
        <div>
          <SectionHeader label="JSON Editor" />
          <div
            className={`relative rounded-card border transition-colors ${
              dragging
                ? "border-line bg-surface-raised"
                : "border-line bg-surface"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {dragging && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-card bg-surface-raised pointer-events-none">
                <Upload size={22} className="text-fg/50 mb-2" />
                <p className="text-sm text-fg/50">Drop .json file</p>
              </div>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              placeholder='Paste JSON here, drop a .json file, or click the upload icon.\n\n⌘↵  to beautify'
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleBeautify();
                }
              }}
              className="w-full h-[420px] bg-transparent rounded-card p-4 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none transition leading-relaxed"
            />
          </div>

          {/* Validation banner */}
          <div className="mt-2">
            <ValidationBanner validation={validation} />
          </div>

          {/* File + clear */}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised text-fg-muted hover:text-fg hover:bg-surface-overlay text-xs font-medium transition"
            >
              <Document size={12} /> Upload .json
            </button>
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised text-fg-muted hover:text-danger hover:border-danger/30 text-xs font-medium transition"
            >
              <Trash size={12} /> Clear
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        {/* Tree */}
        <div>
          <SectionHeader
            label="JSON Tree"
            right={
              validation.ok
                ? null
                : (
                  <span className="text-2xs text-fg-subtle italic">
                    parse to inspect
                  </span>
                )
            }
          />
          {/* min-h keeps the card level with the editor beside it, but the tree
              grows with its content instead of trapping it behind an inner
              scrollbar. The page scrolls; the box never does. */}
          <div className="rounded-card border border-line bg-surface p-3 min-h-[460px]">
            {validation.ok ? (
              <JsonTree value={validation.value} />
            ) : (
              <p className="text-xs text-fg-subtle italic">
                Tree appears once valid JSON is loaded.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Transformation actions ── */}
      <section>
        <SectionHeader label="Transform" />
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={handleBeautify} title="Beautify / Pretty-print">
            <Brush size={11} /> Beautify
          </ActionButton>
          <ActionButton onClick={handleMinify} title="Minify">
            <Compress size={11} /> Minify
          </ActionButton>
          <ActionButton onClick={handleValidate} title="Validate">
            <CheckCircle size={11} /> Validate
          </ActionButton>
          <ActionButton onClick={handleSort} title="Sort keys A→Z (deep)">
            <Sort size={11} /> Sort keys
          </ActionButton>
          <ActionButton onClick={handleRemoveEmpty} title="Remove empty values">
            <Filter size={11} /> Remove empty
          </ActionButton>
          <ActionButton onClick={handleRemoveDuplicates} title="Remove duplicates">
            <Hashtag size={11} /> Remove duplicates
          </ActionButton>
          <ActionButton onClick={handleEscape} title="Escape JSON">
            <Sparkles size={11} /> Escape
          </ActionButton>
          <ActionButton onClick={handleUnescape} title="Unescape JSON">
            <MagicWand size={11} /> Unescape
          </ActionButton>
        </div>
      </section>

      {/* ── Conversion actions ── */}
      <section>
        <SectionHeader label="Convert &amp; Download" />
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={handleCopy} title="Copy JSON to clipboard">
            <Copy3 size={11} /> Copy
          </ActionButton>
          <ActionButton onClick={handleDownload} title="Download as JSON">
            <Download size={11} /> JSON
          </ActionButton>
          <ActionButton onClick={handleExportCsv} title="Download as CSV">
            <ArrowRight size={11} /> CSV
          </ActionButton>
          <ActionButton onClick={handleExportYaml} title="Download as YAML">
            <ArrowRight size={11} /> YAML
          </ActionButton>
          <ActionButton onClick={handleExportXml} title="Download as XML">
            <ArrowRight size={11} /> XML
          </ActionButton>
          <button
            onClick={() => {
              setInput(SAMPLE);
              addToast?.("Sample JSON loaded.", "info", 1500);
            }}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-control border border-dashed border-line bg-transparent text-fg-subtle hover:text-fg hover:border-line-strong text-xs font-medium transition"
            title="Reload sample data"
          >
            <Refresh size={11} /> Sample
          </button>
        </div>
      </section>
    </div>
  );
}