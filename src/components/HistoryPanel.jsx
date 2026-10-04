import { useState, useRef } from "react";
import {
  Trash2,
  GitCompare,
  Pencil,
  Check,
  X,
  FolderOpen,
  Search,
  Star,
  Download,
  Upload,
} from "lucide-react";
import MethodBadge from "./MethodBadge.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import {
  deleteEntry,
  clearHistory,
  updateEntry,
  pinEntry,
  exportHistory,
  importHistory,
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

function HistoryCard({
  entry,
  onLoad,
  onDelete,
  onRename,
  onPin,
  compareMode,
  compareSelected,
  onToggleCompare,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(entry.customName ?? entry.name);
    setEditing(true);
  };
  const commitEdit = () => {
    onRename(entry.id, draft.trim() || entry.name);
    setEditing(false);
  };
  const cancelEdit = () => setEditing(false);

  const isSelected = compareSelected.includes(entry.id);

  return (
    <div
      className={`group bg-white/[0.03] border rounded-xl p-4 transition ${
        isSelected
          ? "border-white/40 bg-white/[0.06]"
          : entry.pinned
            ? "border-amber-500/25 bg-amber-500/[0.03] hover:bg-amber-500/[0.06]"
            : "border-white/10 hover:bg-white/[0.05]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <MethodBadge method={entry.method ?? "GET"} size="xs" />
            {entry.pinned && (
              <Star
                size={10}
                className="text-amber-400 fill-amber-400 shrink-0"
              />
            )}
            {editing ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitEdit();
                    if (e.key === "Escape") cancelEdit();
                  }}
                  className="flex-1 min-w-0 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm font-mono text-white focus:outline-none"
                />
                <button
                  onClick={commitEdit}
                  className="text-green-400 hover:text-green-300"
                >
                  <Check size={13} />
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-gray-500 hover:text-gray-300"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <span className="font-mono text-sm text-white truncate max-w-[220px]">
                {entry.customName ?? entry.name}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-1 truncate font-mono">
            {entry.url}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {formatTime(entry.timestamp)}
          </p>
          {entry.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {entry.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/10"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          {entry.folder && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
              <FolderOpen size={10} /> {entry.folder}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {compareMode ? (
            <button
              onClick={() => onToggleCompare(entry.id)}
              className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition ${
                isSelected
                  ? "border-white/30 bg-white/15 text-white"
                  : "border-white/10 bg-white/5 text-gray-400 hover:text-white"
              }`}
            >
              {isSelected ? "Selected" : "Select"}
            </button>
          ) : (
            <>
              <button
                onClick={() => onLoad(entry)}
                className="text-xs font-medium bg-white text-black px-3 py-1.5 rounded-lg hover:bg-gray-200 transition"
              >
                Load
              </button>
              <button
                onClick={() => onPin(entry.id)}
                title={entry.pinned ? "Unpin" : "Pin to top"}
                className={`p-1.5 rounded-lg border transition ${entry.pinned ? "border-amber-500/40 bg-amber-500/10 text-amber-400" : "border-white/10 bg-white/5 text-gray-500 hover:text-amber-400"}`}
              >
                <Star
                  size={12}
                  className={entry.pinned ? "fill-amber-400" : ""}
                />
              </button>
              <button
                onClick={startEdit}
                className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-500 hover:text-white transition"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={() => onDelete(entry.id)}
                className="p-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-500 hover:text-red-400 transition"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoryPanel({
  history,
  onLoad,
  onHistoryChange,
  onCompare,
}) {
  const [search, setSearch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState([]);
  const [folderFilter, setFolderFilter] = useState(null);
  const importRef = useRef(null);

  const folders = [
    ...new Set(history.filter((h) => h.folder).map((h) => h.folder)),
  ];

  // Pinned entries always float first
  const pinned = history.filter((h) => h.pinned);
  const unpinned = history.filter((h) => !h.pinned);
  const sorted = [...pinned, ...unpinned];

  const filtered = sorted.filter((h) => {
    const term = search.toLowerCase();
    const name = (h.customName ?? h.name).toLowerCase();
    const matchSearch =
      !term || name.includes(term) || h.url.toLowerCase().includes(term);
    const matchFolder = !folderFilter || h.folder === folderFilter;
    return matchSearch && matchFolder;
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

  // Export
  const handleExport = () => {
    const json = exportHistory();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `curl-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const count = importHistory(ev.target.result);
        onHistoryChange(`Imported history — ${count} total entries.`);
      } catch (_) {
        onHistoryChange();
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-0">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search history…"
            className="w-full pl-8 pr-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-white/30"
          />
        </div>

        <button
          onClick={() => {
            setCompareMode((v) => !v);
            setCompareSelected([]);
          }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition ${compareMode ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-white/5 text-gray-400 hover:text-white"}`}
        >
          <GitCompare size={14} /> Compare
        </button>

        {/* Export */}
        {history.length > 0 && (
          <button
            onClick={handleExport}
            title="Export history as JSON"
            className="p-2 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white transition"
          >
            <Download size={15} />
          </button>
        )}

        {/* Import */}
        <button
          onClick={() => importRef.current?.click()}
          title="Import history from JSON"
          className="p-2 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white transition"
        >
          <Upload size={15} />
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportFile}
        />

        {history.length > 0 && (
          <button
            onClick={() => setConfirmClear(true)}
            className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-gray-500 hover:text-red-400 text-sm transition"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Folder filter */}
      {folders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFolderFilter(null)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${!folderFilter ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-gray-500 hover:text-white"}`}
          >
            All
          </button>
          {folders.map((f) => (
            <button
              key={f}
              onClick={() => setFolderFilter(f === folderFilter ? null : f)}
              className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1 ${folderFilter === f ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-gray-500 hover:text-white"}`}
            >
              <FolderOpen size={10} /> {f}
            </button>
          ))}
        </div>
      )}

      {/* Compare action bar */}
      {compareMode && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5">
          <span className="text-sm text-gray-400 flex-1">
            {compareSelected.length === 0 && "Select 2 requests to compare"}
            {compareSelected.length === 1 && "Select 1 more request"}
            {compareSelected.length === 2 && "Ready to compare"}
          </span>
          <button
            disabled={compareSelected.length !== 2}
            onClick={handleCompare}
            className="px-4 py-1.5 bg-white text-black text-sm font-semibold rounded-lg transition disabled:opacity-40"
          >
            Compare
          </button>
        </div>
      )}

      {/* Pinned section label */}
      {pinned.length > 0 && !search && !folderFilter && (
        <div className="flex items-center gap-2">
          <Star size={11} className="text-amber-400 fill-amber-400" />
          <p className="text-xs text-amber-500/70 tracking-wide">Pinned</p>
          <span className="flex-1 h-px bg-amber-500/10" />
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-xs text-gray-600 tracking-wide">
          {filtered.length} {filtered.length === 1 ? "request" : "requests"}
          {search && ` matching "${search}"`}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-gray-600 text-center mt-16 text-sm">
          {history.length === 0
            ? "No history yet — format a request to save it."
            : "No results match your search."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              onLoad={onLoad}
              onDelete={(id) => setConfirmDeleteId(id)}
              onRename={handleRename}
              onPin={handlePin}
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
          message="All saved requests will be permanently removed. This cannot be undone."
          confirmLabel="Clear all"
          onConfirm={handleClearAll}
          onCancel={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
