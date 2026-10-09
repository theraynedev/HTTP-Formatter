import { useRef, useState, useMemo, useEffect } from "react";
import {
  Upload,
  Document,
  Trash,
  Check,
  Download,
  Plus,
  Xmark,
  Hashtag,
  Filter,
  CheckCircle,
  AlertCircle,
  MagicWand,
  Refresh,
  Data,
  ArrowRight,
  Search,
  ChevronLeft,
  ChevronRight,
} from "reicon-react";
import CopyDropdown from "../CopyDropdown.jsx";
import {
  parseJsonSafe,
  detectFieldsList,
  runExtraction,
  toCsv,
} from "../../utils/jsonOps";

const SAMPLE = JSON.stringify(
  {
    users: [
      { name: "John Doe", organization: "Acme Inc.", email: "john@example.com" },
      { name: "Jane Doe", organization: "Globex", email: "jane@example.com" },
      { name: "Alan Turing", organization: "Acme Inc.", email: "alan@example.com" },
      { name: "Ada Lovelace", organization: "Initech", email: "ada@example.com" },
    ],
    metadata: { generated: "" },
  },
  null,
  2,
);

const DEFAULT_OPTIONS = {
  unique: true,
  removeEmpty: true,
  removeDuplicates: false,
  caseSensitive: true,
  caseInsensitive: false,
  flatten: false,
  preserveStructure: false,
  onePerLine: true,
};

// Results are paged rather than put inside a fixed-height scrollbox: a big
// extraction (thousands of values) would otherwise create an endless page or a
// nested scroll area, and the panel is meant to read as one continuous column.
const PAGE_SIZE = 50;

// The detected-field pill cloud can run into the hundreds on a large document.
// Past this many we collapse behind an explicit "Show all" toggle — a disclosure,
// not a scrollbox, so nothing is ever trapped behind an inner scrollbar.
const DETECTED_CAP = 60;

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

// ─── Toggle (checkbox) ─────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-2 cursor-pointer group select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-accent shrink-0"
      />
      <div className="min-w-0">
        <span className="text-xs font-medium text-fg group-hover:text-fg transition">
          {label}
        </span>
        {hint && (
          <span className="block text-2xs text-fg-subtle mt-0.5 leading-snug">
            {hint}
          </span>
        )}
      </div>
    </label>
  );
}

// ─── File metadata strip ───────────────────────────────────────────────────────

function FileMeta({ fileName, fileSize, validation }) {
  return (
    <div className="flex items-center gap-3 text-2xs font-mono text-fg-subtle px-1">
      {fileName && (
        <span className="flex items-center gap-1 truncate min-w-0">
          <Document size={11} className="shrink-0" />
          <span className="truncate">{fileName}</span>
        </span>
      )}
      {fileSize != null && <span>{formatBytes(fileSize)}</span>}
      {validation.ok !== null && (
        <span
          className={`flex items-center gap-1 ${validation.ok ? "text-success" : "text-danger"}`}
        >
          {validation.ok ? <CheckCircle size={11} /> : <AlertCircle size={11} />}
          {validation.ok ? "valid" : "invalid"}
        </span>
      )}
    </div>
  );
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function ExtractorPanel({ addToast }) {
  const [input, setInput] = useState(SAMPLE);
  const [fields, setFields] = useState(["organization", "name", "email"]);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [detectedList, setDetectedList] = useState([]);
  const [detectedSearch, setDetectedSearch] = useState("");
  const [fileName, setFileName] = useState(null);
  const [fileSize, setFileSize] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [results, setResults] = useState(null); // { mode, columns?, rows?, items?, missing, total }
  const [resultsPage, setResultsPage] = useState(1);
  const [showAllDetected, setShowAllDetected] = useState(false);
  const fileInputRef = useRef(null);

  // ─── Debounced input (skip re-parsing the whole JSON on every keystroke).
  //      Validation, detection, and tree re-runs are expensive on big docs,
  //      so we coalesce to one parse per ~150ms of inactivity. The textarea
  //      still feels instant because it's bound to `input`, not to this.
  const [debouncedInput, setDebouncedInput] = useState(input);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedInput(input), 150);
    return () => clearTimeout(t);
  }, [input]);

  // ─── Validation ────────────────────────────────────────────────────────────

  const validation = useMemo(() => {
    const trimmed = debouncedInput.trim();
    if (!trimmed) return { ok: null, value: null, error: null, summary: "" };
    const result = parseJsonSafe(debouncedInput);
    if (!result.ok) return { ok: false, value: null, error: result.error, summary: "" };
    let kind = "value";
    let count = 0;
    if (Array.isArray(result.value)) {
      kind = "array";
      count = result.value.length;
    } else if (result.value && typeof result.value === "object") {
      kind = "object";
      count = Object.keys(result.value).length;
    }
    const summary = `${kind} · ${count} ${kind === "array" ? "items" : kind === "object" ? "keys" : ""}`;
    return { ok: true, value: result.value, error: null, summary };
  }, [debouncedInput]);

  // ─── Auto-detect fields when JSON changes ──────────────────────────────────
  // Uses useEffect (not useMemo) because it's a side effect — calling
  // setDetectedList from inside useMemo was an anti-pattern that ran on
  // every render where validation identity shifted, not only when the value
  // actually changed.
  useEffect(() => {
    if (!validation.ok) {
      setDetectedList([]);
      setShowAllDetected(false);
      return;
    }
    setDetectedList(detectFieldsList(validation.value));
    // A new document means a new field list — don't carry an expanded
    // disclosure over from the previous one.
    setShowAllDetected(false);
  }, [validation.value, validation.ok]);

  // ─── Detected-field search ─────────────────────────────────────────────────
  // Case-insensitive substring match against the detected paths. When the
  // user is searching, the visible pill list shrinks and "Add all" targets
  // only the filtered subset.
  const filteredDetected = useMemo(() => {
    const q = detectedSearch.trim().toLowerCase();
    if (!q) return detectedList;
    return detectedList.filter((p) => p.toLowerCase().includes(q));
  }, [detectedList, detectedSearch]);

  // Cap the pill cloud so a document with hundreds of leaf paths doesn't push
  // the rest of the panel off-screen. This is a disclosure ("Show all"), not a
  // scrollbox — nothing is ever trapped behind an inner scrollbar.
  const visibleDetected = useMemo(
    () => (showAllDetected ? filteredDetected : filteredDetected.slice(0, DETECTED_CAP)),
    [filteredDetected, showAllDetected],
  );
  const hiddenDetectedCount = filteredDetected.length - visibleDetected.length;

  // ─── File / drop handlers ──────────────────────────────────────────────────

  const ingestFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      addToast?.("Only .json files are supported.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setInput(ev.target.result);
      setFileName(file.name);
      setFileSize(file.size);
      addToast?.(`Loaded ${file.name}.`, "success");
    };
    reader.onerror = () => addToast?.("Failed to read file.", "error");
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) ingestFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) ingestFile(file);
    e.target.value = "";
  };

  // ─── Field list management ─────────────────────────────────────────────────

  const updateField = (idx, value) => {
    setFields((p) => p.map((f, i) => (i === idx ? value : f)));
  };

  const removeField = (idx) => {
    setFields((p) => p.filter((_, i) => i !== idx));
  };

  const addField = (path = "") => {
    setFields((p) => [...p, path]);
  };

  const toggleDetected = (path) => {
    // Single click on a detected chip toggles its presence in the fields list.
    setFields((prev) => {
      if (prev.includes(path)) {
        addToast?.(`Removed "${path}".`, "info", 1200);
        return prev.filter((f) => f !== path);
      }
      addToast?.(`Added "${path}".`, "success", 1200);
      return [...prev, path];
    });
  };

  const addAllDetected = () => {
    // If the user has typed a search query, "Add all" should add only the
    // visible (filtered) subset — otherwise the button would silently add
    // dozens of paths the user can't see.
    const source = detectedSearch.trim()
      ? filteredDetected
      : detectedList;
    const toAdd = source.filter((p) => !fields.includes(p));
    if (toAdd.length === 0) {
      addToast?.(
        detectedSearch.trim()
          ? "All matching fields already added."
          : "All detected fields already added.",
        "info",
      );
      return;
    }
    setFields((p) => [...p, ...toAdd]);
    addToast?.(
      `Added ${toAdd.length} field${toAdd.length !== 1 ? "s" : ""}.`,
      "success",
    );
  };

  const clearAllFields = () => {
    if (fields.length === 0) return;
    setFields([]);
    addToast?.("Fields cleared.", "info", 1200);
  };

  // ─── Options ──────────────────────────────────────────────────────────────

  const setOpt = (key, value) => {
    setOptions((prev) => {
      const next = { ...prev, [key]: value };
      // Mutual exclusion: caseSensitive ↔ caseInsensitive
      if (key === "caseSensitive" && value) next.caseInsensitive = false;
      if (key === "caseInsensitive" && value) next.caseSensitive = false;
      return next;
    });
  };

  // ─── Extract ──────────────────────────────────────────────────────────────

  const handleExtract = () => {
    // Every run produces a fresh result set, so start back on page 1 rather
    // than leaving the user stranded on a page that may no longer exist.
    setResultsPage(1);
    const trimmed = input.trim();
    if (!trimmed) {
      addToast?.("Paste JSON first.", "error");
      setResults(null);
      return;
    }
    if (!validation.ok) {
      addToast?.(`Cannot extract: ${validation.error}`, "error", 5000);
      setResults(null);
      return;
    }
    const cleanedFields = fields.map((f) => f.trim()).filter(Boolean);
    if (cleanedFields.length === 0) {
      addToast?.("Add at least one field to extract.", "error");
      // Drop any stale result so the UI doesn't keep reporting "missing
      // field X" from a prior extraction.
      setResults(null);
      return;
    }
    const result = runExtraction(validation.value, cleanedFields, options);
    setResults(result);
    if (result.missing.length > 0) {
      addToast?.(
        `Missing: ${result.missing.join(", ")}`,
        "info",
        4000,
      );
    }
    if (result.total === 0) {
      addToast?.("No values matched.", "info");
    } else {
      addToast?.(`Extracted ${result.total} value${result.total !== 1 ? "s" : ""}.`, "success");
    }
  };

  // ─── Result export ─────────────────────────────────────────────────────────

  const buildCsvFromResults = () => {
    if (!results) return "";
    if (results.mode === "list") {
      return results.items
        .map((v) => (v === null || v === undefined ? "" : String(v)))
        .join("\n");
    }
    return toCsv(results.columns, results.rows);
  };

  const buildJsonFromResults = () => {
    if (!results) return "[]";
    if (results.mode === "list") return JSON.stringify(results.items, null, 2);
    const cols = results.columns;
    const arr = results.rows.map((row) => {
      const obj = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
      return obj;
    });
    return JSON.stringify(arr, null, 2);
  };

  const buildTxtFromResults = () => {
    if (!results) return "";
    if (results.mode === "list") {
      return results.items
        .map((v) => (v === null || v === undefined ? "" : String(v)))
        .join("\n");
    }
    // For tables, tab-separated is the practical plaintext.
    return [
      results.columns.join("\t"),
      ...results.rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))).join("\t")),
    ].join("\n");
  };

  const handleExportCsv = () => downloadBlob(buildCsvFromResults(), "csv", "text/csv", "CSV");
  const handleExportJson = () => downloadBlob(buildJsonFromResults(), "json", "application/json", "JSON");

  const downloadBlob = (text, ext, mime, label) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extract-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    addToast?.(`Downloaded ${label}.`, "success");
  };

  const handleClearResults = () => {
    setResults(null);
    setResultsPage(1);
    addToast?.("Results cleared.", "info", 1500);
  };

  const handleClearAll = () => {
    setInput("");
    setFields([]);
    setFileName(null);
    setFileSize(null);
    setResults(null);
    setResultsPage(1);
    addToast?.("Cleared.", "info", 1500);
  };

  const handleSample = () => {
    setInput(SAMPLE);
    setFileName(null);
    setFileSize(null);
    addToast?.("Sample JSON loaded.", "info", 1500);
  };

  // ─── Layout ────────────────────────────────────────────────────────────────

  // Clamp the page in case a re-extraction shrinks the result set while the
  // user is sitting on a later page. handleExtract resets to 1, but option and
  // field edits can change the count without going through it.
  const resultCount = !results
    ? 0
    : results.mode === "list"
      ? (results.items?.length ?? 0)
      : (results.rows?.length ?? 0);
  const resultPageCount = Math.max(1, Math.ceil(resultCount / PAGE_SIZE));
  const safePage = Math.min(resultsPage, resultPageCount);

  return (
    <div className="space-y-4">
      {/* ── Top row: input (left) + fields/options (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── JSON Input ── */}
        <section className="flex flex-col gap-2">
          <SectionHeader label="JSON Input" />
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
                <Upload size={20} className="text-fg/50 mb-1" />
                <p className="text-sm text-fg/50">Drop .json file</p>
              </div>
            )}
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (fileName) {
                  setFileName(null);
                  setFileSize(null);
                }
              }}
              spellCheck={false}
              autoComplete="off"
              placeholder='Paste JSON, drop a .json file, or click "Upload".'
              className="w-full h-[160px] bg-transparent rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none transition leading-relaxed"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised text-fg hover:bg-surface-overlay text-xs font-medium transition"
            >
              <Document size={12} /> Upload
            </button>
            <button
              onClick={handleSample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-dashed border-line bg-transparent text-fg-subtle hover:text-fg hover:border-line-strong text-xs font-medium transition"
              title="Reload sample data"
            >
              <Refresh size={12} /> Sample
            </button>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised text-fg-muted hover:text-danger hover:border-danger/30 text-xs font-medium transition"
            >
              <Trash size={12} /> Clear all
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex-1 min-w-0">
              <FileMeta fileName={fileName} fileSize={fileSize} validation={validation} />
            </div>
            {validation.ok && (
              <span className="text-xs text-fg-subtle font-mono shrink-0">
                {validation.summary}
              </span>
            )}
          </div>
        </section>

        {/* ── Right column: fields + options ── */}
        <div className="flex flex-col gap-3 min-w-0">
          <section className="min-w-0">
            <SectionHeader
              label="Fields to Extract"
              right={
                <span className="flex items-center gap-3">
                  <span className="text-2xs text-fg-subtle font-mono">
                    supports dot paths · users[].email
                  </span>
                  {fields.length > 0 && (
                    <button
                      onClick={clearAllFields}
                      className="text-xs font-medium px-2 py-0.5 rounded-chip border border-line bg-surface-raised hover:bg-surface-overlay text-fg hover:text-danger hover:border-danger/30 transition"
                    >
                      Clear all
                    </button>
                  )}
                </span>
              }
            />
            <div className="space-y-1.5">
              {fields.length === 0 && (
                <p className="text-xs text-fg-subtle italic">
                  No fields yet. Add one below or pick from detected.
                </p>
              )}
              {fields.map((field, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Hashtag size={12} className="text-fg-subtle shrink-0" />
                  <input
                    value={field}
                    onChange={(e) => updateField(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addField();
                      }
                      if (
                        e.key === "Backspace" &&
                        field === "" &&
                        fields.length > 1
                      ) {
                        e.preventDefault();
                        removeField(idx);
                      }
                    }}
                    placeholder="e.g. users[].email"
                    className="flex-1 min-w-0 bg-surface border border-line rounded-control px-3 py-1.5 text-sm font-mono text-fg placeholder-fg-subtle focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => removeField(idx)}
                    className="p-1.5 rounded-control border border-line bg-surface-raised text-fg-subtle hover:text-danger transition shrink-0"
                    title="Remove field"
                  >
                    <Xmark size={11} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => addField("")}
                className="flex items-center gap-1 text-xs text-fg-subtle hover:text-fg mt-1 transition"
              >
                <Plus size={12} /> Add field
              </button>
            </div>
          </section>

          {/* ── Options (compact) ── */}
          <section className="min-w-0">
            <SectionHeader label="Options" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <Toggle
                checked={options.unique}
                onChange={(v) => setOpt("unique", v)}
                label="Unique values"
              />
              <Toggle
                checked={options.removeEmpty}
                onChange={(v) => setOpt("removeEmpty", v)}
                label="Remove empty"
              />
              <Toggle
                checked={options.removeDuplicates}
                onChange={(v) => setOpt("removeDuplicates", v)}
                label="Remove duplicates (deep)"
              />
              <Toggle
                checked={options.caseSensitive}
                onChange={(v) => setOpt("caseSensitive", v)}
                label="Case sensitive"
              />
              <Toggle
                checked={options.caseInsensitive}
                onChange={(v) => setOpt("caseInsensitive", v)}
                label="Case insensitive"
              />
              <Toggle
                checked={options.flatten}
                onChange={(v) => setOpt("flatten", v)}
                label="Flatten nested"
              />
              <Toggle
                checked={options.preserveStructure}
                onChange={(v) => setOpt("preserveStructure", v)}
                label="Preserve row alignment"
              />
              <Toggle
                checked={options.onePerLine}
                onChange={(v) => setOpt("onePerLine", v)}
                label="One value per line"
              />
            </div>
          </section>
        </div>
      </div>

      {/* ── Detected fields (inline pill row) ── */}
      {detectedList.length > 0 && (
        <section>
          <SectionHeader
            label="Detected Fields"
            right={
              <span className="flex items-center gap-2">
                <span className="text-2xs text-fg-subtle font-mono">
                  {detectedSearch.trim()
                    ? `${filteredDetected.length} of ${detectedList.length} match`
                    : "click to add · click again to remove"}
                </span>
                <button
                  onClick={addAllDetected}
                  disabled={
                    detectedSearch.trim()
                      ? filteredDetected.length === 0
                      : false
                  }
                  className="text-xs font-medium px-2 py-0.5 rounded-chip border border-line bg-surface-raised hover:bg-surface-overlay text-fg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {detectedSearch.trim() ? "Add matches" : "Add all"}
                </button>
              </span>
            }
          />
          {/* Search row sits just above the pill list so users with many
              detected fields can narrow them down without losing context. */}
          <div className="relative mb-2">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
            />
            <input
              value={detectedSearch}
              onChange={(e) => setDetectedSearch(e.target.value)}
              placeholder="Filter detected fields… (e.g. manager)"
              className="w-full pl-7 pr-8 py-1.5 bg-surface border border-line rounded-control text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-accent"
            />
            {detectedSearch && (
              <button
                onClick={() => setDetectedSearch("")}
                title="Clear filter"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg transition"
              >
                <Xmark size={12} />
              </button>
            )}
          </div>
          <div className="rounded-card border border-line bg-surface p-2">
            {filteredDetected.length === 0 ? (
              <p className="text-xs text-fg-subtle italic px-1 py-1">
                No detected fields match "{detectedSearch}".
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {visibleDetected.map((path) => {
                  const active = fields.includes(path);
                  return (
                    <button
                      key={path}
                      onClick={() => toggleDetected(path)}
                      title={active ? `Remove "${path}"` : `Add "${path}"`}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-control border text-xs font-mono transition ${
                        active
                          ? "border-success/30 bg-success/10 text-success"
                          : "border-line bg-surface text-fg-muted hover:text-fg hover:border-line-strong"
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-chip border flex items-center justify-center ${
                          active
                            ? "bg-success/80 border-success"
                            : "border-line"
                        }`}
                      >
                        {active && <Check size={8} className="text-white" />}
                      </span>
                      {path}
                    </button>
                  );
                })}
              </div>
            )}
            {(hiddenDetectedCount > 0 || showAllDetected) && (
              <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-line">
                <span className="text-2xs text-fg-subtle font-mono tabular-nums">
                  showing {visibleDetected.length} of {filteredDetected.length}
                </span>
                <button
                  onClick={() => setShowAllDetected((v) => !v)}
                  className="text-xs font-medium text-accent-text hover:text-fg transition"
                >
                  {showAllDetected ? "Show fewer" : `Show all ${filteredDetected.length}`}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Extract + Results (full width) ── */}
      <section className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleExtract}
          disabled={!validation.ok}
          className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2 px-5 rounded-card transition active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <MagicWand size={13} /> Extract
        </button>
        {results && (
          <span className="text-xs text-fg-subtle font-mono">
            <span className="text-success font-medium">{results.total}</span>{" "}
            value{results.total !== 1 ? "s" : ""}
            {results.missing.length > 0 && (
              <span className="text-warning ml-2">
                · {results.missing.length} missing
              </span>
            )}
          </span>
        )}
      </section>

      <section>
        {!results ? (
          <div className="rounded-card border border-dashed border-line bg-surface p-6 text-center">
            <Data size={18} className="mx-auto text-fg-subtle mb-1" />
            <p className="text-xs text-fg-subtle">
              Run an extraction to see results here.
            </p>
          </div>
        ) : results.total === 0 ? (
          <div className="rounded-card border border-warning/20 bg-warning/[0.04] p-5 text-center">
            <Filter size={16} className="mx-auto text-warning/70 mb-1" />
            <p className="text-sm text-warning/80 font-medium">No values</p>
            {results.missing.length > 0 && (
              <p className="text-xs text-fg-subtle mt-1">
                Missing fields: {results.missing.join(", ")}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {results.mode === "list" ? (
              <ResultsList
                items={results.items}
                page={safePage}
                pageSize={PAGE_SIZE}
                onPageChange={setResultsPage}
              />
            ) : (
              <ResultsTable
                columns={results.columns}
                rows={results.rows}
                page={safePage}
                pageSize={PAGE_SIZE}
                onPageChange={setResultsPage}
              />
            )}

            {/* Export bar */}
            <div className="flex flex-wrap gap-2 pt-1">
              <CopyDropdown
                size={13}
                className="h-7"
                options={[
                  {
                    label: "Copy as plain list",
                    getText: () =>
                      results.mode === "list"
                        ? results.items.map((v) => String(v ?? "")).join("\n")
                        : results.rows
                            .map((r) =>
                              r
                                .map((c) =>
                                  c === null || c === undefined ? "" : String(c),
                                )
                                .join("\t"),
                            )
                            .join("\n"),
                  },
                  { label: "Copy as TXT", getText: () => buildTxtFromResults() },
                  { label: "Copy as CSV", getText: () => buildCsvFromResults() },
                  { label: "Copy as JSON", getText: () => buildJsonFromResults() },
                ]}
              />
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised hover:bg-surface-overlay text-fg hover:text-fg text-xs font-medium transition"
              >
                <Download size={11} /> CSV
              </button>
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised hover:bg-surface-overlay text-fg hover:text-fg text-xs font-medium transition"
              >
                <Download size={11} /> JSON
              </button>
              <button
                onClick={handleClearResults}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised text-fg-muted hover:text-danger hover:border-danger/30 text-xs font-medium transition"
              >
                <Trash size={11} /> Clear
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Results presentation ──────────────────────────────────────────────────────

// A pager rather than a fixed-height scrollbox. Rendering the whole set inside
// `max-h-96 overflow-auto` meant scrolling *inside* the panel, and 3500 values
// became an endless inner viewport. Paging keeps the panel a single continuous
// column: nothing is clipped and there is no nested scrollbar.
//
// The footer pager is `sticky bottom-0`, so it stays visible at the bottom of
// the viewport while the page scrolls the rows past it — the content moves,
// the controls do not. (The table keeps a horizontal `overflow-x-auto` escape
// hatch so a very wide result set scrolls inside the card rather than pushing
// the page sideways.)
function ResultsPager({ page, total, pageSize, onChange }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn =
    "flex items-center gap-1 px-2 py-1 rounded-control border border-line bg-surface-raised " +
    "text-fg-muted hover:text-fg hover:border-line-strong text-xs font-medium transition " +
    "disabled:opacity-40 disabled:cursor-not-allowed";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-2xs text-fg-subtle font-mono tabular-nums">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className={btn}
        >
          <ChevronLeft size={11} /> Prev
        </button>
        <span className="text-xs text-fg-muted font-mono tabular-nums px-1">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className={btn}
        >
          Next <ChevronRight size={11} />
        </button>
      </div>
    </div>
  );
}

function ResultsList({ items = [], page, pageSize, onPageChange }) {
  const start = (page - 1) * pageSize;
  const visible = items.slice(start, start + pageSize);
  return (
    // NOTE: no `overflow-hidden` here. It would make this card a scroll
    // container and trap the sticky footer below, pinning it to the card
    // instead of the page scrollport. The header/footer carry the rounding
    // instead so the card still reads as one rounded box.
    <div className="rounded-card border border-line bg-surface">
      <div className="px-4 py-2 border-b border-line bg-surface-raised rounded-t-card">
        <ResultsPager
          page={page}
          total={items.length}
          pageSize={pageSize}
          onChange={onPageChange}
        />
      </div>
      <ul className="p-4 space-y-1 font-mono text-sm">
        {visible.map((value, i) => (
          <li
            key={start + i}
            className="flex items-start gap-3 text-fg py-0.5 border-b border-line last:border-b-0"
          >
            <span className="text-fg-subtle text-2xs tabular-nums w-8 shrink-0">
              {start + i + 1}
            </span>
            <span className="break-all">
              {value === null || value === undefined
                ? <span className="text-fg-subtle italic">null</span>
                : typeof value === "string"
                  ? value
                  : JSON.stringify(value)}
            </span>
          </li>
        ))}
      </ul>
      <div className="sticky bottom-0 z-10 px-4 py-2 border-t border-line bg-surface-raised rounded-b-card">
        <ResultsPager
          page={page}
          total={items.length}
          pageSize={pageSize}
          onChange={onPageChange}
        />
      </div>
    </div>
  );
}

function ResultsTable({ columns = [], rows = [], page, pageSize, onPageChange }) {
  const start = (page - 1) * pageSize;
  const visible = rows.slice(start, start + pageSize);
  return (
    <div className="rounded-card border border-line bg-surface">
      <div className="px-3 py-2 border-b border-line bg-surface-raised rounded-t-card">
        <ResultsPager
          page={page}
          total={rows.length}
          pageSize={pageSize}
          onChange={onPageChange}
        />
      </div>
      {/* `overflow-x-auto` keeps a very wide table inside the card instead of
          pushing the page sideways now that the card no longer clips. */}
      <div className="overflow-x-auto pane-scroll-x">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-raised">
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="px-3 py-2 text-left text-xs font-medium text-fg-subtle border-b border-line tracking-label"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line font-mono">
            {visible.map((row, i) => (
              <tr key={start + i} className="hover:bg-surface-raised transition">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-3 py-2 align-top text-fg border-r border-line last:border-r-0 break-all"
                  >
                    {cell === null || cell === undefined
                      ? <span className="text-fg-subtle italic">—</span>
                      : typeof cell === "string"
                        ? cell
                        : JSON.stringify(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sticky bottom-0 z-10 px-3 py-2 border-t border-line bg-surface-raised rounded-b-card">
        <ResultsPager
          page={page}
          total={rows.length}
          pageSize={pageSize}
          onChange={onPageChange}
        />
      </div>
    </div>
  );
}