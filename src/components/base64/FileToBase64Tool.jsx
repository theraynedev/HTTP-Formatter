import { useMemo, useState } from "react";
import {
  CopyTextButton,
  DownloadButton,
  FieldLabel,
  FileDrop,
  OutputBox,
  PillToggle,
  StatStrip,
  downloadText,
  useBlobUrl,
} from "./Shared.jsx";
import {
  bytesToBase64,
  cleanBase64,
  formatBytes,
  kindForMime,
  wrapBase64,
} from "../../utils/base64Ops";
import { Skeleton, SkeletonGroup, SkeletonText } from "../Skeleton.jsx";

// File → Base64. Drives: File / Image / Audio / Video / PDF → Base64.
// The accept filter and default options come from the registry entry.

export default function FileToBase64Tool({ tool }) {
  const [file, setFile] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [error, setError] = useState(null);
  const [reading, setReading] = useState(false);
  const [dataUriOn, setDataUriOn] = useState(!!tool.dataUriDefault);
  const [wrapOn, setWrapOn] = useState(false);

  const handleFile = (f) => {
    setError(null);
    setBytes(null);
    setFile(f);
    setReading(true);
    const reader = new FileReader();
    // `reading` is cleared on BOTH paths — a file that fails to read must not
    // leave the skeleton up forever.
    reader.onload = (ev) => {
      try {
        setBytes(new Uint8Array(ev.target.result));
      } catch (e) {
        setError(e?.message ?? "Could not read file.");
      } finally {
        setReading(false);
      }
    };
    reader.onerror = () => {
      setError("Failed to read file.");
      setReading(false);
    };
    reader.readAsArrayBuffer(f);
  };

  const base64 = useMemo(
    () => (bytes ? bytesToBase64(bytes) : ""),
    [bytes],
  );

  const mime = file?.type || "application/octet-stream";
  const output = useMemo(() => {
    if (!base64) return "";
    const body = wrapOn ? wrapBase64(base64, 76) : base64;
    return dataUriOn ? `data:${mime};base64,${cleanBase64(base64)}` : body;
  }, [base64, dataUriOn, wrapOn, mime]);

  const previewUrl = useBlobUrl(
    kindForMime(mime) === "image" ? bytes : null,
    mime,
  );

  const clear = () => {
    setFile(null);
    setBytes(null);
    setError(null);
    setReading(false);
  };

  const copyDataUri = () => `data:${mime};base64,${cleanBase64(base64)}`;

  return (
    <div className="space-y-4">
      <FileDrop
        accept={tool.accept}
        hint={tool.dropHint ?? "Drop a file here"}
        sub={tool.dropSub ?? "or click to browse"}
        file={file}
        onFile={handleFile}
        onClear={clear}
      />

      {error && (
        <p className="text-xs text-warning/90 px-1">{error}</p>
      )}

      {/* A large file takes a visible moment to read; without this the panel
          showed a bare "…" for the base64 length and an "Encoding…" box. */}
      {reading && (
        <SkeletonGroup label="Reading file…">
          <div className="flex items-center gap-2 flex-wrap">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-7 w-20 rounded-chip" />
            <Skeleton className="h-7 w-20 rounded-chip" />
          </div>
          <div className="rounded-card border border-line bg-surface px-3 py-2">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-2.5 w-10" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <div className="rounded-card border border-line bg-surface p-3">
                <SkeletonText lines={6} />
              </div>
            </div>
            <div className="shrink-0 space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-[160px] w-[220px] max-w-full rounded-card" />
            </div>
          </div>
        </SkeletonGroup>
      )}

      {file && !reading && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xs tracking-label uppercase text-fg-subtle font-medium mr-1">
              Options
            </span>
            <PillToggle
              active={dataUriOn}
              onClick={() => setDataUriOn((v) => !v)}
              title="Prefix with data:<mime>;base64,"
            >
              Data URI
            </PillToggle>
            <PillToggle
              active={wrapOn}
              onClick={() => setWrapOn((v) => !v)}
              title="Insert line breaks every 76 characters"
            >
              Wrap 76
            </PillToggle>
          </div>

          <StatStrip
            items={[
              { label: "file", value: formatBytes(file.size) },
              { label: "type", value: mime },
              { label: "base64", value: base64 ? `${base64.length.toLocaleString()} chars` : "…" },
              {
                label: "overhead",
                value:
                  base64 && file.size
                    ? `+${(((base64.length - file.size) / file.size) * 100).toFixed(0)}%`
                    : null,
              },
            ]}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-start">
            <section className="min-w-0">
              <FieldLabel
                right={
                  <span className="flex items-center gap-2">
                    <CopyTextButton getText={() => output} label="Copy" />
                    {dataUriOn && (
                      <CopyTextButton
                        getText={copyDataUri}
                        label="Copy data URI"
                      />
                    )}
                    <DownloadButton
                      disabled={!base64}
                      onClick={() =>
                        downloadText(
                          output,
                          `${file.name.replace(/\.[^.]+$/, "")}-base64.txt`,
                        )
                      }
                    />
                  </span>
                }
              >
                Base64
              </FieldLabel>
              <OutputBox
                text={base64 ? output : ""}
                empty="Encoding…"
                maxH="max-h-80"
              />
            </section>

            {previewUrl && (
              <section className="shrink-0">
                <FieldLabel>Preview</FieldLabel>
                <div className="rounded-card border border-line bg-surface p-2">
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="max-w-[220px] max-h-[220px] rounded-control object-contain"
                  />
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
