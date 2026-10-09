import { useMemo, useState } from "react";
import { Refresh, Trash } from "reicon-react";
import {
  CopyTextButton,
  DownloadButton,
  FieldLabel,
  OutputBox,
  PillToggle,
  StatStrip,
  downloadText,
} from "./Shared.jsx";
import { base64ToBytes, bytesToAsciiTable, formatBytes } from "../../utils/base64Ops";

// Base64 → ASCII. Decodes the blob to bytes, shows the UTF-8 text, and can
// additionally break every byte down into dec / hex / oct / bin / glyph —
// the "ASCII" view the classic converter sites expose.

const PAGE = 256;

export default function AsciiDecodeTool() {
  const [input, setInput] = useState("");
  const [showTable, setShowTable] = useState(true);
  const [limit, setLimit] = useState(PAGE);

  const decoded = useMemo(() => {
    if (!input.trim()) {
      return { ok: true, bytes: new Uint8Array(0), text: "", error: null };
    }
    try {
      const bytes = base64ToBytes(input);
      const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      return { ok: true, bytes, text, error: null };
    } catch (e) {
      return {
        ok: false,
        bytes: new Uint8Array(0),
        text: "",
        error: e?.message ?? "Invalid base64.",
      };
    }
  }, [input]);

  const rows = useMemo(
    () => (showTable && decoded.ok ? bytesToAsciiTable(decoded.bytes, limit) : []),
    [showTable, decoded, limit],
  );

  const tableText = () =>
    ["idx\tdec\thex\toct\tbin\tchar"]
      .concat(
        rows.map(
          (r) => `${r.index}\t${r.dec}\t${r.hex}\t${r.oct}\t${r.bin}\t${r.char}`,
        ),
      )
      .join("\n");

  const truncated = decoded.ok && decoded.bytes.length > rows.length;

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
            Base64
          </FieldLabel>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="Paste Base64 (data: URIs are accepted too)…"
            className="w-full h-64 bg-surface border border-line rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setInput("SGVsbG8sIHdvcmxkIQ==")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-dashed border-line bg-transparent text-fg-subtle hover:text-fg hover:border-line-strong text-xs font-medium transition"
            >
              <Refresh size={11} /> Sample
            </button>
            <button
              onClick={() => setInput("")}
              disabled={!input}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-line bg-surface-raised text-fg-muted hover:text-danger hover:border-danger/30 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash size={11} /> Clear
            </button>
          </div>
        </section>

        {/* ── Decoded text ── */}
        <section className="min-w-0">
          <FieldLabel
            right={
              <span className="flex items-center gap-2">
                <CopyTextButton getText={() => decoded.text} />
                <DownloadButton
                  disabled={!decoded.text}
                  onClick={() =>
                    downloadText(decoded.text, `ascii-${Date.now()}.txt`)
                  }
                />
              </span>
            }
          >
            Decoded text
          </FieldLabel>
          {decoded.ok ? (
            <OutputBox
              text={decoded.text}
              maxH="max-h-64"
              empty="Decoded text appears here."
            />
          ) : (
            <OutputBox text="" empty={decoded.error} maxH="max-h-64" tone="error" />
          )}
          <div className="mt-2">
            <StatStrip
              items={[
                { label: "bytes", value: decoded.ok ? decoded.bytes.length : null },
                {
                  label: "size",
                  value: decoded.ok ? formatBytes(decoded.bytes.length) : null,
                },
              ]}
            />
          </div>
        </section>
      </div>

      {/* ── Char-code table ── */}
      <section>
        <FieldLabel
          right={
            <span className="flex items-center gap-2">
              <PillToggle
                active={showTable}
                onClick={() => setShowTable((v) => !v)}
                title="Toggle the byte breakdown"
              >
                {showTable ? "Hide table" : "Show table"}
              </PillToggle>
              {showTable && rows.length > 0 && (
                <CopyTextButton getText={tableText} label="Copy TSV" />
              )}
            </span>
          }
        >
          Byte breakdown
        </FieldLabel>

        {!decoded.ok ? (
          <p className="text-xs text-fg-subtle italic px-1">
            Fix the Base64 above to see the byte breakdown.
          </p>
        ) : !showTable ? null : rows.length === 0 ? (
          <p className="text-xs text-fg-subtle italic px-1">
            No bytes to show yet.
          </p>
        ) : (
          <>
            <div className="rounded-card border border-line bg-surface overflow-hidden max-h-80 overflow-auto pane-scroll">
              <table className="w-full text-xs font-mono border-collapse">
                <thead className="sticky top-0 bg-canvas/80 backdrop-blur-sm">
                  <tr>
                    {["#", "dec", "hex", "oct", "bin", "char"].map((h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left text-2xs uppercase tracking-label font-medium text-fg-subtle border-b border-line"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.index} className="hover:bg-surface-raised transition">
                      <td className="px-3 py-1 text-fg-subtle tabular-nums">
                        {r.index}
                      </td>
                      <td className="px-3 py-1 text-fg tabular-nums">
                        {r.dec}
                      </td>
                      <td className="px-3 py-1 text-info tabular-nums">
                        {r.hex}
                      </td>
                      <td className="px-3 py-1 text-fg-subtle tabular-nums">
                        {r.oct}
                      </td>
                      <td className="px-3 py-1 text-fg-subtle tabular-nums">
                        {r.bin}
                      </td>
                      <td
                        className={`px-3 py-1 ${r.printable ? "text-success" : "text-fg-subtle"}`}
                      >
                        {r.char}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {truncated && (
              <button
                onClick={() => setLimit((n) => n + PAGE)}
                className="mt-2 text-xs font-medium text-fg-subtle hover:text-fg transition"
              >
                Showing {rows.length} of {decoded.bytes.length} bytes · show{" "}
                {Math.min(PAGE, decoded.bytes.length - rows.length)} more
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
