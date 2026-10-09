import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy3,
  Document,
  Download,
  Trash,
  Upload,
} from "reicon-react";
import { formatBytes } from "../../utils/base64Ops";

// ─── Accents ──────────────────────────────────────────────────────────────────
// Semantic colour per group, following the app's design language: blue reads
// as "parse / safe", orange as "transform / mutating" (same mapping the
// Formatter uses for GET vs POST).

export const ACCENTS = {
  decode: {
    key: "decode",
    label: "Decoders",
    hint: "Base64 → readable",
    text: "text-info",
    iconBox: "border-info/30 bg-info/10",
    chip: "border-info/30 bg-info/10 text-info",
    bar: "bg-info/50",
  },
  encode: {
    key: "encode",
    label: "Encoders",
    hint: "readable → Base64",
    text: "text-mutation",
    iconBox: "border-mutation/30 bg-mutation/10",
    chip: "border-mutation/30 bg-mutation/10 text-mutation",
    bar: "bg-mutation/50",
  },
};

// ─── Field label ──────────────────────────────────────────────────────────────

export function FieldLabel({ children, right }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-2xs tracking-label uppercase text-fg-subtle font-medium">
        {children}
      </span>
      <span className="flex-1 h-px bg-surface" />
      {right}
    </div>
  );
}

// ─── Copy button (local, tiny) ────────────────────────────────────────────────

export function CopyTextButton({ getText, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    try {
      const text = typeof getText === "function" ? getText() : getText;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };
  return (
    <button
      onClick={handle}
      className="inline-flex items-center gap-1 px-2 h-6 rounded-control border border-line bg-surface-raised text-2xs font-medium text-fg-muted hover:text-fg hover:border-line-strong transition"
    >
      {copied ? (
        <Check size={10} className="text-success" />
      ) : (
        <Copy3 size={10} />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}

// ─── Download helper ──────────────────────────────────────────────────────────

export function downloadText(text, filename, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  triggerDownload(blob, filename);
}

export function downloadBytes(bytes, filename, mime = "application/octet-stream") {
  const blob = new Blob([bytes], { type: mime });
  triggerDownload(blob, filename);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Output panel ─────────────────────────────────────────────────────────────

export function OutputBox({ text, empty, maxH = "max-h-72", tone = "default" }) {
  const has = typeof text === "string" && text.length > 0;
  const border =
    tone === "error"
      ? "border-warning/30 bg-warning/[0.04]"
      : "border-line bg-surface";
  return (
    <div
      className={`rounded-card border ${border} p-3 font-mono text-sm overflow-auto pane-scroll ${maxH}`}
    >
      {has ? (
        <pre className="whitespace-pre-wrap break-all text-fg leading-6">
          {text}
        </pre>
      ) : (
        <p className="text-fg-subtle text-xs italic">{empty ?? "Nothing yet."}</p>
      )}
    </div>
  );
}

// ─── Option toggle (pill) ─────────────────────────────────────────────────────

export function PillToggle({ active, onClick, children, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1 px-2.5 h-6 rounded-control border text-2xs font-medium transition ${
        active
          ? "border-line bg-surface-raised text-fg"
          : "border-line bg-surface text-fg-subtle hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

// ─── File drop zone ───────────────────────────────────────────────────────────

export function FileDrop({
  accept,
  onFile,
  hint = "Drop a file here",
  sub = "or click to browse",
  file,
  onClear,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handle = (f) => {
    if (f) onFile?.(f);
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-card border border-line bg-surface">
        <span className="w-7 h-7 rounded-control bg-surface-raised border border-line flex items-center justify-center shrink-0">
          <Document size={12} className="text-fg-muted" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-fg truncate">{file.name}</p>
          <p className="text-2xs text-fg-subtle font-mono">
            {formatBytes(file.size)} · {file.type || "unknown type"}
          </p>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 px-2 py-1 rounded-control border border-line bg-surface-raised hover:bg-surface-overlay text-fg-muted hover:text-danger text-2xs font-medium transition shrink-0"
        >
          <Trash size={11} /> Clear
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handle(e.dataTransfer.files?.[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-1.5 py-8 rounded-card border-2 border-dashed cursor-pointer transition ${
        dragging
          ? "border-line bg-surface"
          : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <span className="w-10 h-10 rounded-card bg-surface-raised border border-line flex items-center justify-center mb-1">
        <Upload size={16} className="text-fg-subtle" />
      </span>
      <p className="text-sm font-medium text-fg">{hint}</p>
      <p className="text-xs text-fg-subtle">{sub}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ─── Blob URL hook ────────────────────────────────────────────────────────────
// Creates (and revokes) an object URL for a byte buffer so media previews
// stream from a blob rather than a giant data: URI in the DOM.

export function useBlobUrl(bytes, mime) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!bytes || bytes.length === 0 || !mime) {
      setUrl(null);
      return;
    }
    const blob = new Blob([bytes], { type: mime });
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [bytes, mime]);
  return url;
}

// ─── Download button ──────────────────────────────────────────────────────────

export function DownloadButton({ onClick, children = "Download", disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised hover:bg-surface-overlay text-fg hover:text-fg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Download size={11} /> {children}
    </button>
  );
}

// ─── Stat strip ───────────────────────────────────────────────────────────────

export function StatStrip({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs font-mono text-fg-subtle px-1">
      {items
        .filter((it) => it && it.value != null && it.value !== "")
        .map((it, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="text-fg-subtle">{it.label}</span>
            <span className={it.accent ?? "text-fg"}>{it.value}</span>
          </span>
        ))}
    </div>
  );
}
