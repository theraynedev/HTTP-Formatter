import { useState, useRef, useEffect } from "react";
import {
  Trash,
  ArrowSwapHorizontal,
  ArrowRight,
  ChevronDown,
  Chart2,
  DocumentText,
  Edit,
  Check,
  Xmark,
  FolderOpen,
  Search,
  Star,
  Download,
  Upload,
  Tag,
  UnorderedList,
  Widget,
} from "reicon-react";
import MethodBadge from "./MethodBadge.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import { SkeletonCards, SkeletonGroup } from "./Skeleton.jsx";
import { formatBytes, historyToHar } from "../utils/harOps.js";
import { parseHar } from "../utils/parser.js";
import {
  deleteEntry,
  clearHistory,
  updateEntry,
  pinEntry,
  saveEntry,
  normalizeMethod,
} from "../utils/storage.js";

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return iso;
  }
}

// ─── Load menu ────────────────────────────────────────────────────────────────
// The whole control opens the menu — an earlier split button put the
// destinations behind a 23px caret next to a 62px "Load" button, and clicking
// the big half silently went to the Formatter, so "Send to Analyzer" was easy
// to miss entirely. One target, two labelled destinations, no silent paths.
function LoadMenu({ entry, onLoad, onSendToAnalyzer }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const actions = [
    {
      label: "Send to Formatter",
      hint: "Open the request in the Formatter",
      icon: DocumentText,
      run: () => onLoad(entry),
    },
    {
      label: "Send to Analyzer",
      hint: "Open the request in the HAR Analyzer",
      icon: Chart2,
      run: () => onSendToAnalyzer(entry),
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Load this request into the Formatter or the HAR Analyzer"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-control bg-accent text-white text-xs font-medium hover:bg-accent-hover transition"
      >
        <ArrowRight size={12} /> Load
        <ChevronDown
          size={10}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 z-50 min-w-[196px] bg-surface-overlay border border-line rounded-card shadow-pop overflow-hidden"
        >
          {actions.map(({ label, hint, icon: Icon, run }) => (
            <button
              key={label}
              role="menuitem"
              title={hint}
              onClick={() => {
                setOpen(false);
                run();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-fg hover:bg-surface-raised transition text-left"
            >
              <Icon size={12} className="shrink-0 text-fg-subtle" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── History row / card ───────────────────────────────────────────────────────
// viewMode="list"  → compact single-line row inside a divided list container
// viewMode="grid"  → taller card with method, name, URL, meta, tags all visible
function HistoryCard({
  entry,
  onLoad,
  onSendToAnalyzer,
  onDelete,
  onRename,
  onPin,
  onTagsChange,
  compareMode,
  compareSelected,
  onToggleCompare,
  viewMode,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const tagInputRef = useRef(null);

  const startEdit = () => {
    setDraft(entry.customName ?? entry.name);
    setEditing(true);
  };
  const commitEdit = () => {
    onRename(entry.id, draft.trim() || entry.name);
    setEditing(false);
  };
  const cancelEdit = () => setEditing(false);

  const addTag = () => {
    const t = tagDraft.trim().toLowerCase().replace(/\s+/g, "-");
    const current = entry.tags ?? [];
    if (!t || current.includes(t)) {
      setTagDraft("");
      return;
    }
    onTagsChange(entry.id, [...current, t]);
    setTagDraft("");
  };
  const removeTag = (tag) => {
    onTagsChange(
      entry.id,
      (entry.tags ?? []).filter((t) => t !== tag),
    );
  };

  const isSelected = compareSelected.includes(entry.id);
  const hasSize = typeof entry.size === "number";
  const tags = entry.tags ?? [];

  // ── Shared sub-components ──────────────────────────────────────────────────

  const NameField = () =>
    editing ? (
      <div className="flex items-center gap-1 min-w-0">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          className="flex-1 min-w-0 bg-surface-raised border border-line rounded-chip px-2 py-0.5 text-xs font-mono text-fg focus:outline-none focus:border-accent"
        />
        <button onClick={commitEdit} className="text-success p-0.5 shrink-0">
          <Check size={11} />
        </button>
        <button
          onClick={cancelEdit}
          className="text-fg-subtle hover:text-fg p-0.5 shrink-0"
        >
          <Xmark size={11} />
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-1.5 min-w-0">
        {entry.pinned && (
          <Star size={9} className="text-warning fill-warning shrink-0" />
        )}
        <span
          title={entry.customName ?? entry.name}
          className="font-mono text-xs font-medium text-fg truncate"
        >
          {entry.customName ?? entry.name}
        </span>
      </div>
    );

  const TagsField = ({ className = "" }) => (
    <div className={`flex items-center gap-1 flex-wrap ${className}`}>
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-0.5 text-2xs px-1.5 py-px rounded-full bg-surface-raised text-fg-subtle border border-line"
        >
          {t}
          <button
            onClick={() => removeTag(t)}
            className="hover:text-danger transition leading-none"
          >
            <Xmark size={8} />
          </button>
        </span>
      ))}
      {tagOpen ? (
        <div className="flex items-center gap-1">
          <input
            ref={tagInputRef}
            value={tagDraft}
            autoFocus
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTag();
              if (e.key === "Escape") {
                setTagOpen(false);
                setTagDraft("");
              }
            }}
            placeholder="tag…"
            className="w-16 bg-surface-raised border border-line rounded-chip px-1.5 py-px text-2xs font-mono text-fg focus:outline-none focus:border-accent"
          />
          <button onClick={addTag} className="text-success p-px">
            <Check size={10} />
          </button>
          <button
            onClick={() => {
              setTagOpen(false);
              setTagDraft("");
            }}
            className="text-fg-subtle hover:text-fg p-px"
          >
            <Xmark size={10} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setTagOpen(true)}
          className="inline-flex items-center gap-0.5 text-2xs px-1.5 py-px rounded-full border border-dashed border-line text-fg-subtle hover:text-fg hover:border-line-strong transition opacity-0 group-hover:opacity-100"
        >
          <Tag size={8} /> tag
        </button>
      )}
    </div>
  );

  const Actions = () =>
    compareMode ? (
      <button
        onClick={() => onToggleCompare(entry.id)}
        className={`text-2xs px-2 py-1 rounded-control border font-medium transition ${
          isSelected
            ? "border-accent/40 bg-accent/10 text-accent-text"
            : "border-line bg-surface-raised text-fg hover:bg-surface-overlay"
        }`}
      >
        {isSelected ? "✓ Selected" : "Select"}
      </button>
    ) : (
      <>
        <LoadMenu
          entry={entry}
          onLoad={onLoad}
          onSendToAnalyzer={onSendToAnalyzer}
        />
        <button
          onClick={() => onPin(entry.id)}
          title={entry.pinned ? "Unpin" : "Pin to top"}
          className={`p-1.5 rounded-control border transition ${
            entry.pinned
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-line bg-surface-raised text-fg-subtle hover:text-warning"
          }`}
        >
          <Star size={11} className={entry.pinned ? "fill-warning" : ""} />
        </button>
        <button
          onClick={startEdit}
          title="Rename"
          className="p-1.5 rounded-control border border-line bg-surface-raised text-fg-subtle hover:text-fg transition"
        >
          <Edit size={11} />
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          title="Delete"
          className="p-1.5 rounded-control border border-line bg-surface-raised text-fg-subtle hover:text-danger transition"
        >
          <Trash size={11} />
        </button>
      </>
    );

  // ── LIST row ──────────────────────────────────────────────────────────────
  if (viewMode === "list") {
    return (
      <div
        className={`group relative flex items-center gap-3 px-4 py-2.5 min-w-0 transition ${
          isSelected
            ? "bg-accent/5"
            : entry.pinned
              ? "bg-warning/[0.03] hover:bg-warning/[0.05]"
              : "hover:bg-surface-raised"
        }`}
      >
        <div className="shrink-0">
          <MethodBadge method={entry.method ?? "GET"} size="xs" />
        </div>
        <div className="flex-1 min-w-0">
          <NameField />
          <p
            title={entry.url}
            className="font-mono text-2xs text-fg-subtle truncate leading-tight mt-0.5"
          >
            {entry.url}
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end shrink-0 gap-0.5 min-w-[80px]">
          <span className="text-2xs text-fg-subtle tabular-nums whitespace-nowrap">
            {formatTime(entry.timestamp)}
          </span>
          {hasSize && (
            <span className="font-mono text-2xs text-fg-subtle tabular-nums whitespace-nowrap">
              {formatBytes(entry.size)}
            </span>
          )}
        </div>
        {!editing && (
          <TagsField className="hidden md:flex shrink-0 max-w-[160px]" />
        )}
        <div
          className={`shrink-0 flex items-center gap-1 transition ${compareMode ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}
        >
          <Actions />
        </div>
      </div>
    );
  }

  // ── GRID card ─────────────────────────────────────────────────────────────
  return (
    <div
      className={`group flex flex-col gap-2.5 p-4 min-w-0 transition bg-surface border border-line rounded-card ${
        isSelected
          ? "ring-1 ring-inset ring-accent/30"
          : entry.pinned
            ? "bg-warning/[0.03] border-warning/25 hover:bg-warning/[0.05]"
            : "hover:bg-surface-raised"
      }`}
    >
      {/* Header row: method · name · actions */}
      <div className="flex items-center gap-2 min-w-0">
        <MethodBadge method={entry.method ?? "GET"} size="xs" />
        {entry.pinned && (
          <Star size={9} className="text-warning fill-warning shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <NameField />
        </div>
        <div
          className={`shrink-0 flex items-center gap-1 transition ${
            compareMode
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          }`}
        >
          <Actions />
        </div>
      </div>

      {/* URL */}
      <p
        title={entry.url}
        className="font-mono text-2xs text-fg-subtle truncate leading-tight"
      >
        {entry.url}
      </p>

      {/* Meta: time · size */}
      <div className="flex items-center gap-2 text-2xs text-fg-subtle">
        <span className="tabular-nums whitespace-nowrap">
          {formatTime(entry.timestamp)}
        </span>
        {hasSize && (
          <>
            <span>·</span>
            <span className="font-mono tabular-nums whitespace-nowrap">
              {formatBytes(entry.size)}
            </span>
          </>
        )}
      </div>

      {/* Tags */}
      {!editing && <TagsField />}
    </div>
  );
}

// ─── Main HistoryPanel ────────────────────────────────────────────────────────
export default function HistoryPanel({
  history,
  onLoad,
  onSendToAnalyzer,
  onHistoryChange,
  onCompare,
}) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list"); // "list" | "grid"
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState([]);
  const [folderFilter, setFolderFilter] = useState(null);
  const [tagFilter, setTagFilter] = useState(null);
  const [methodFilter, setMethodFilter] = useState(null); // e.g. "GET"
  const [statusFilter, setStatusFilter] = useState(null); // e.g. "2xx"
  const [importing, setImporting] = useState(false);
  const importHarRef = useRef(null);

  const folders = [
    ...new Set(history.filter((h) => h.folder).map((h) => h.folder)),
  ];
  const allTags = [...new Set(history.flatMap((h) => h.tags ?? []))];

  // Unique methods present in history (sorted by frequency)
  const allMethods = [...new Set(history.map((h) => normalizeMethod(h.method)))].sort();

  // Status groups present in history — only show groups that have entries
  const STATUS_GROUPS = ["1xx", "2xx", "3xx", "4xx", "5xx"];
  const presentStatusGroups = STATUS_GROUPS.filter((g) =>
    history.some((h) => {
      const s = h.status;
      if (!s) return false;
      const code = typeof s === "number" ? s : parseInt(s, 10);
      return !isNaN(code) && Math.floor(code / 100) === parseInt(g[0], 10);
    }),
  );

  const statusGroupColor = (g) => {
    if (g === "2xx")
      return {
        active: "border-success/40 bg-success/10 text-success",
        dot: "bg-success",
      };
    if (g === "3xx")
      return {
        active: "border-accent/40 bg-accent/10 text-accent-text",
        dot: "bg-accent",
      };
    if (g === "4xx")
      return {
        active: "border-warning/40 bg-warning/10 text-warning",
        dot: "bg-warning",
      };
    if (g === "5xx")
      return {
        active: "border-danger/40 bg-danger/10 text-danger",
        dot: "bg-danger",
      };
    return {
      active: "border-line bg-surface-raised text-fg",
      dot: "bg-fg-subtle",
    };
  };

  // Pinned entries float first
  const sortedHistory = [
    ...history.filter((h) => h.pinned),
    ...history.filter((h) => !h.pinned),
  ];

  const filtered = sortedHistory.filter((h) => {
    const term = search.toLowerCase();
    const name = (h.customName ?? h.name).toLowerCase();
    const matchSearch =
      !term ||
      name.includes(term) ||
      h.url.toLowerCase().includes(term) ||
      (h.tags ?? []).some((t) => t.includes(term));
    const matchFolder = !folderFilter || h.folder === folderFilter;
    const matchTag = !tagFilter || (h.tags ?? []).includes(tagFilter);
    const matchMethod =
      !methodFilter || normalizeMethod(h.method) === normalizeMethod(methodFilter);
    const matchStatus =
      !statusFilter ||
      (() => {
        const s = h.status;
        if (!s) return false;
        const code = typeof s === "number" ? s : parseInt(s, 10);
        return (
          !isNaN(code) &&
          Math.floor(code / 100) === parseInt(statusFilter[0], 10)
        );
      })();
    return matchSearch && matchFolder && matchTag && matchMethod && matchStatus;
  });

  const handleDelete = (id) => {
    deleteEntry(id);
    onHistoryChange();
    setConfirmDeleteId(null);
  };
  const handleClearAll = () => {
    clearHistory();
    onHistoryChange();
    setConfirmClear(false);
  };
  const handleRename = (id, name) => {
    updateEntry(id, { customName: name });
    onHistoryChange();
  };
  const handlePin = (id) => {
    pinEntry(id);
    onHistoryChange();
  };
  const handleTagsChange = (id, tags) => {
    updateEntry(id, { tags });
    onHistoryChange();
  };

  const handleToggleCompare = (id) => {
    setCompareSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };
  const handleCompare = () => {
    if (compareSelected.length === 2) {
      const a = history.find((h) => h.id === compareSelected[0]);
      const b = history.find((h) => h.id === compareSelected[1]);
      if (a && b) onCompare(a, b);
    }
  };

  const downloadJson = (text, filename, mime = "application/json") => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stamp = () => new Date().toISOString().slice(0, 10);

  const handleExportHar = () => {
    const doc = historyToHar(history);
    if (!doc) {
      onHistoryChange();
      return;
    }
    downloadJson(
      JSON.stringify(doc, null, 2),
      `devOrbit-history-${stamp()}.har`,
    );
    onHistoryChange(
      `Exported ${doc.log.entries.length} request${doc.log.entries.length !== 1 ? "s" : ""} as HAR.`,
    );
  };

  const handleImportHar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setImporting(false);
      onHistoryChange();
    };
    reader.onload = (ev) => {
      const text = String(ev.target.result ?? "");
      setTimeout(() => {
        try {
          const entries = parseHar(text);
          entries.forEach((en) => {
            if (en.url) saveEntry(en);
          });
          onHistoryChange(
            entries.length
              ? `Imported ${entries.length} request${entries.length !== 1 ? "s" : ""} from HAR.`
              : "No requests found in HAR.",
          );
        } catch (_) {
          onHistoryChange();
        }
        setImporting(false);
      }, 0);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const pinnedCount = history.filter((h) => h.pinned).length;
  const hasActiveFilter =
    folderFilter || tagFilter || methodFilter || statusFilter;

  // Method badge colours — matches MethodBadge palette
  const methodChipClass = (m) => {
    const active = {
      GET: "border-accent/40 bg-accent/10 text-accent-text",
      POST: "border-orange-500/40 bg-orange-500/10 text-orange-400",
      PUT: "border-orange-500/40 bg-orange-500/10 text-orange-400",
      PATCH: "border-orange-500/40 bg-orange-500/10 text-orange-400",
      DELETE: "border-danger/40 bg-danger/10 text-danger",
      HEAD: "border-line bg-surface-raised text-fg",
      OPTIONS: "border-accent/40 bg-accent/10 text-accent-text",
    };
    return active[m] ?? "border-line bg-surface-raised text-fg";
  };

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history, tags…"
            className="w-full pl-8 pr-3 py-2 bg-surface-raised border border-line rounded-card text-sm text-fg placeholder-fg-subtle focus:outline-none focus:border-accent"
          />
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-line rounded-card overflow-hidden shrink-0">
          <button
            onClick={() => setViewMode("list")}
            title="List view"
            className={`p-2 transition ${viewMode === "list" ? "bg-surface-overlay text-fg" : "bg-surface-raised text-fg-subtle hover:text-fg"}`}
          >
            <UnorderedList size={15} />
          </button>
          <div className="w-px h-5 bg-line" />
          <button
            onClick={() => setViewMode("grid")}
            title="Grid view"
            className={`p-2 transition ${viewMode === "grid" ? "bg-surface-overlay text-fg" : "bg-surface-raised text-fg-subtle hover:text-fg"}`}
          >
            <Widget size={15} />
          </button>
        </div>

        {/* Compare */}
        <button
          onClick={() => {
            setCompareMode((v) => !v);
            setCompareSelected([]);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-card border text-sm font-medium transition ${
            compareMode
              ? "border-accent/40 bg-accent/10 text-accent-text"
              : "border-line bg-surface-raised text-fg hover:bg-surface-overlay"
          }`}
        >
          <ArrowSwapHorizontal size={14} /> Compare
        </button>

        {history.length > 0 && (
          <button
            onClick={handleExportHar}
            title="Export history as a HAR file"
            className="flex items-center gap-1.5 px-3 py-2 rounded-card border border-line bg-surface-raised text-fg text-sm font-medium hover:bg-surface-overlay transition"
          >
            <Download size={14} /> Export HAR
          </button>
        )}
        <button
          onClick={() => importHarRef.current?.click()}
          title="Import a HAR file into history"
          className="flex items-center gap-1.5 px-3 py-2 rounded-card border border-line bg-surface-raised text-fg text-sm font-medium hover:bg-surface-overlay transition"
        >
          <Upload size={14} /> Import HAR
        </button>
        <input
          ref={importHarRef}
          type="file"
          accept=".har"
          className="hidden"
          onChange={handleImportHar}
        />
        {history.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-card border border-line bg-surface-raised text-fg text-sm font-medium hover:text-danger hover:border-danger/30 transition"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ── Filter bar: method + status + folders + tags ── */}
      {(allMethods.length > 1 ||
        presentStatusGroups.length > 0 ||
        folders.length > 0 ||
        allTags.length > 0) && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {/* Method chips */}
          {allMethods.map((m) => (
            <button
              key={`method-${m}`}
              onClick={() => setMethodFilter(methodFilter === m ? null : m)}
              className={`font-mono text-2xs px-2 py-0.5 rounded-full border font-bold tracking-wide transition ${
                methodFilter === m
                  ? methodChipClass(m)
                  : "border-line text-fg-subtle hover:text-fg"
              }`}
            >
              {m}
            </button>
          ))}

          {/* Divider between method + status groups */}
          {allMethods.length > 1 && presentStatusGroups.length > 0 && (
            <span className="w-px h-4 bg-line mx-0.5 shrink-0" />
          )}

          {/* Status group chips */}
          {presentStatusGroups.map((g) => {
            const { active, dot } = statusGroupColor(g);
            return (
              <button
                key={`status-${g}`}
                onClick={() => setStatusFilter(statusFilter === g ? null : g)}
                className={`flex items-center gap-1 text-2xs px-2 py-0.5 rounded-full border font-medium transition ${
                  statusFilter === g
                    ? active
                    : "border-line text-fg-subtle hover:text-fg"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusFilter === g ? dot : "bg-fg-subtle"}`}
                />
                {g}
              </button>
            );
          })}

          {/* Divider before folder / tag chips */}
          {(allMethods.length > 1 || presentStatusGroups.length > 0) &&
            (folders.length > 0 || allTags.length > 0) && (
              <span className="w-px h-4 bg-line mx-0.5 shrink-0" />
            )}

          {/* Folder chips */}
          {folders.map((f) => (
            <button
              key={`folder-${f}`}
              onClick={() => setFolderFilter(f === folderFilter ? null : f)}
              className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${
                folderFilter === f
                  ? "border-line bg-surface-raised text-fg"
                  : "border-line text-fg-subtle hover:text-fg"
              }`}
            >
              <FolderOpen size={10} /> {f}
            </button>
          ))}

          {/* Tag chips */}
          {allTags.map((t) => (
            <button
              key={`tag-${t}`}
              onClick={() => setTagFilter(t === tagFilter ? null : t)}
              className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${
                tagFilter === t
                  ? "border-accent/40 bg-accent/10 text-accent-text"
                  : "border-line text-fg-subtle hover:text-fg"
              }`}
            >
              <Tag size={9} /> {t}
            </button>
          ))}

          {/* Clear all filters */}
          {hasActiveFilter && (
            <button
              onClick={() => {
                setFolderFilter(null);
                setTagFilter(null);
                setMethodFilter(null);
                setStatusFilter(null);
              }}
              className="text-xs px-2.5 py-1 rounded-full border border-line text-fg-subtle hover:text-fg transition"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Compare bar ── */}
      {compareMode && (
        <div className="flex items-center gap-3 p-3 rounded-card border border-line bg-surface-raised">
          <span className="text-sm text-fg-subtle flex-1">
            {compareSelected.length === 0 && "Select 2 requests to compare"}
            {compareSelected.length === 1 && "Select 1 more request"}
            {compareSelected.length === 2 && "Ready to compare"}
          </span>
          <button
            disabled={compareSelected.length !== 2}
            onClick={handleCompare}
            className="px-4 py-1.5 bg-accent text-white text-sm font-medium rounded-control transition disabled:opacity-40"
          >
            Compare
          </button>
        </div>
      )}

      {/* ── Pinned label ── */}
      {pinnedCount > 0 && !search && !hasActiveFilter && (
        <div className="flex items-center gap-2">
          <Star size={11} className="text-warning fill-warning" />
          <p className="text-xs text-warning/70 tracking-wide">Pinned</p>
          <span className="flex-1 h-px bg-warning/10" />
        </div>
      )}

      {/* ── Count ── */}
      {filtered.length > 0 && !importing && (
        <p className="text-xs text-fg-subtle tracking-wide">
          {filtered.length} {filtered.length === 1 ? "request" : "requests"}
          {search && ` matching "${search}"`}
          {tagFilter && ` tagged "${tagFilter}"`}
          {methodFilter && ` · ${methodFilter}`}
          {statusFilter && ` · ${statusFilter}`}
        </p>
      )}

      {/* ── List / Grid ── */}
      {importing ? (
        <SkeletonGroup label="Importing requests…">
          <SkeletonCards count={6} />
        </SkeletonGroup>
      ) : filtered.length === 0 ? (
        <p className="text-fg-subtle text-center mt-16 text-sm">
          {history.length === 0
            ? "No history yet — format a request to save it."
            : "No results match your filters."}
        </p>
      ) : viewMode === "list" ? (
        <div className="border border-line rounded-card overflow-hidden divide-y divide-line">
          {filtered.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              viewMode="list"
              onLoad={onLoad}
              onSendToAnalyzer={onSendToAnalyzer}
              onDelete={(id) => setConfirmDeleteId(id)}
              onRename={handleRename}
              onPin={handlePin}
              onTagsChange={handleTagsChange}
              compareMode={compareMode}
              compareSelected={compareSelected}
              onToggleCompare={handleToggleCompare}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              viewMode="grid"
              onLoad={onLoad}
              onSendToAnalyzer={onSendToAnalyzer}
              onDelete={(id) => setConfirmDeleteId(id)}
              onRename={handleRename}
              onPin={handlePin}
              onTagsChange={handleTagsChange}
              compareMode={compareMode}
              compareSelected={compareSelected}
              onToggleCompare={handleToggleCompare}
            />
          ))}
        </div>
      )}

      {confirmDeleteId && (
        <ConfirmModal
          title="Delete this request?"
          message="This saved request will be permanently removed."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
      {confirmClear && (
        <ConfirmModal
          title="Clear all history?"
          message="All saved requests will be permanently removed."
          confirmLabel="Clear all"
          onConfirm={handleClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
