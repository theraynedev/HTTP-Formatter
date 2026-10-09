import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Refresh, Trash } from "reicon-react";
import {
  CopyTextButton,
  DownloadButton,
  FieldLabel,
  OutputBox,
  StatStrip,
  downloadBytes,
  useBlobUrl,
} from "./Shared.jsx";
import { formatBytes, inspectBase64 } from "../../utils/base64Ops";

// Base64 → media. Drives: Image / Audio / Video / PDF / File decoders.
// Decoding is debounced so pasting a multi-MB blob doesn't block typing.
// Whatever the bytes actually are decides the preview — a "Base64 → Image"
// tool will happily preview a PDF if that's what the user pasted, and just
// flags the mismatch.

const DEBOUNCE_MS = 250;

export default function Base64ToMediaTool({ tool }) {
  const [input, setInput] = useState("");
  const [filename, setFilename] = useState("");
  const [debounced, setDebounced] = useState(input);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const result = useMemo(() => {
    if (!debounced.trim()) return { empty: true };
    try {
      const info = inspectBase64(debounced);
      return { empty: false, ok: true, ...info };
    } catch (e) {
      return { empty: false, ok: false, error: e?.message ?? "Invalid base64." };
    }
  }, [debounced]);

  const bytes = result.ok ? result.bytes : null;
  const mime = result.ok ? result.mime : null;
  const blobUrl = useBlobUrl(bytes, mime);

  // Suggest a filename when a new blob lands.
  useEffect(() => {
    if (result.ok) {
      setFilename(`decoded-${Date.now()}.${result.ext}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.ok, result.ext, result.byteLength]);

  const mismatch =
    result.ok &&
    tool.expectedKind &&
    tool.expectedKind !== "any" &&
    result.kind !== tool.expectedKind;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Input ── */}
        <section className="min-w-0">
          <FieldLabel
            right={
              <span className="text-2xs text-fg-subtle font-mono">
                {input.length.toLocaleString()} chars
              </span>
            }
          >
            Base64 input
          </FieldLabel>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder={"Paste Base64 or a data: URI…\ndata:image/png;base64,iVBORw0KGgo…"}
            className="w-full h-64 bg-surface border border-line rounded-card p-3 font-mono text-xs text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll"
          />
          <div className="flex items-center gap-2 mt-2">
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-dashed border-line bg-transparent text-fg-subtle hover:text-fg hover:border-line-strong text-xs font-medium transition cursor-pointer">
              <Refresh size={11} /> Load file as Base64
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const buf = new Uint8Array(ev.target.result);
                    let bin = "";
                    for (let i = 0; i < buf.length; i += 0x8000) {
                      bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
                    }
                    setInput(btoa(bin));
                  };
                  reader.readAsArrayBuffer(f);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              onClick={() => setInput("")}
              disabled={!input}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised text-fg-muted hover:text-danger hover:border-danger/30 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash size={11} /> Clear
            </button>
          </div>
        </section>

        {/* ── Preview ── */}
        <section className="min-w-0">
          <FieldLabel
            right={
              result.ok && (
                <span className="flex items-center gap-2">
                  <CopyTextButton getText={() => input} label="Copy input" />
                  <DownloadButton
                    disabled={!bytes}
                    onClick={() => downloadBytes(bytes, filename, mime)}
                  >
                    Save file
                  </DownloadButton>
                </span>
              )
            }
          >
            Preview
          </FieldLabel>

          {result.empty ? (
            <OutputBox text="" empty="Paste Base64 to see the preview." maxH="max-h-64" />
          ) : !result.ok ? (
            <OutputBox text="" empty={result.error} maxH="max-h-64" tone="error" />
          ) : (
            <div className="rounded-card border border-line bg-surface p-3">
              <MediaPreview kind={result.kind} url={blobUrl} mime={mime} filename={filename} />
            </div>
          )}
        </section>
      </div>

      {/* ── Details ── */}
      {result.ok && (
        <>
          {mismatch && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-control border border-warning/30 bg-warning/[0.05] text-xs text-warning/90">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <span>
                This tool expects a {tool.expectedKind}, but the bytes look like{" "}
                <span className="font-mono">{result.kind}</span> (
                <span className="font-mono">{mime}</span>). The preview below
                reflects what the data actually is.
              </span>
            </div>
          )}

          <StatStrip
            items={[
              { label: "decoded", value: formatBytes(result.byteLength) },
              { label: "bytes", value: result.byteLength.toLocaleString() },
              { label: "type", value: mime, accent: "text-info" },
              { label: "kind", value: result.kind },
              {
                label: "detected via",
                value: result.source,
                accent: "text-fg-muted",
              },
            ]}
          />

          <section className="min-w-0">
            <FieldLabel>Filename for download</FieldLabel>
            <input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              spellCheck={false}
              className="w-full sm:max-w-md bg-surface border border-line rounded-control px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-accent"
            />
          </section>
        </>
      )}
    </div>
  );
}

// ─── Preview by kind ──────────────────────────────────────────────────────────

function MediaPreview({ kind, url, mime, filename }) {
  if (!url) {
    return (
      <p className="text-xs text-fg-subtle italic text-center py-8">
        Decoding…
      </p>
    );
  }

  if (kind === "image") {
    return (
      <img
        src={url}
        alt={filename}
        className="w-full max-h-[360px] rounded-control object-contain bg-canvas/40"
      />
    );
  }

  if (kind === "audio") {
    return (
      <div className="space-y-2 py-2">
        <div className="flex items-center justify-center py-6">
          <div className="w-16 h-16 rounded-panel bg-surface-raised border border-line flex items-center justify-center">
            <span className="text-2xl">♪</span>
          </div>
        </div>
        <audio src={url} controls className="w-full" />
      </div>
    );
  }

  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        className="w-full max-h-[360px] rounded-control bg-canvas/40"
      />
    );
  }

  if (kind === "pdf") {
    return (
      <div className="space-y-2">
        <iframe
          src={url}
          title="PDF preview"
          className="w-full h-[360px] rounded-card border border-line bg-[#fff]"
        />
        <p className="text-2xs text-fg-subtle">
          If the preview is blank, your browser blocks inline PDFs — use “Save
          file”.
        </p>
      </div>
    );
  }

  if (kind === "text") {
    return (
      <pre className="text-xs font-mono text-fg whitespace-pre-wrap break-all max-h-[360px] overflow-auto pane-scroll">
        <TextPeek url={url} />
      </pre>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="w-12 h-12 rounded-card bg-surface-raised border border-line flex items-center justify-center text-fg-subtle text-lg">
        ⌘
      </span>
      <p className="text-sm font-medium text-fg">Binary file</p>
      <p className="text-xs text-fg-subtle font-mono">{mime}</p>
      <p className="text-xs text-fg-subtle">Use “Save file” to download it.</p>
    </div>
  );
}

// Fetches a blob URL and renders the first chunk as text.
function TextPeek({ url }) {
  const [text, setText] = useState("Loading…");
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then((r) => r.text())
      .then((t) => {
        if (alive) setText(t.slice(0, 20000));
      })
      .catch(() => {
        if (alive) setText("Could not read as text.");
      });
    return () => {
      alive = false;
    };
  }, [url]);
  return <>{text}</>;
}
