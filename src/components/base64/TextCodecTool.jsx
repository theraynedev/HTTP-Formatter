import { useMemo, useState } from "react";
import { Refresh, Trash } from "reicon-react";
import {
  CopyTextButton,
  DownloadButton,
  FieldLabel,
  OutputBox,
  PillToggle,
  downloadText,
} from "./Shared.jsx";

// Generic text ⇄ base64 workspace. Drives:
//   Text → Base64 · CSS → Base64 · HTML → Base64 · URL → Base64
//   Base64 → Text
//
// The transform, labels, placeholder and optional toggles all come from the
// tool registry, so each entry is just a config object — no bespoke UI.

function initialOpts(tool) {
  const out = {};
  for (const t of tool.toggles ?? []) out[t.key] = t.default ?? false;
  return out;
}

export default function TextCodecTool({ tool }) {
  const [input, setInput] = useState("");
  const [opts, setOpts] = useState(() => initialOpts(tool));

  const result = useMemo(() => {
    if (!input) return { ok: true, text: "" };
    try {
      return tool.transform(input, opts);
    } catch (e) {
      return { ok: false, text: "", error: e?.message ?? "Transform failed." };
    }
  }, [input, opts, tool]);

  const toggle = (key) => setOpts((p) => ({ ...p, [key]: !p[key] }));
  const hasToggles = (tool.toggles ?? []).length > 0;

  const lineCount = input ? input.split("\n").length : 0;

  return (
    <div className="space-y-4">
      {/* ── Options ── */}
      {hasToggles && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-2xs tracking-label uppercase text-fg-subtle font-medium mr-1">
            Options
          </span>
          {tool.toggles.map((t) => (
            <PillToggle
              key={t.key}
              active={!!opts[t.key]}
              onClick={() => toggle(t.key)}
              title={t.hint}
            >
              {t.label}
            </PillToggle>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Input ── */}
        <section className="min-w-0">
          <FieldLabel
            right={
              <span className="text-2xs text-fg-subtle font-mono">
                {input.length.toLocaleString()} chars
                {lineCount > 1 ? ` · ${lineCount} lines` : ""}
              </span>
            }
          >
            {tool.inputLabel}
          </FieldLabel>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder={tool.placeholder}
            className="w-full h-64 bg-surface border border-line rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setInput(tool.sample ?? "")}
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

        {/* ── Output ── */}
        <section className="min-w-0">
          <FieldLabel
            right={
              <span className="flex items-center gap-2">
                {result.ok && result.text && (
                  <span className="text-2xs text-fg-subtle font-mono">
                    {result.text.length.toLocaleString()} chars
                  </span>
                )}
                <CopyTextButton getText={() => result.text} />
                <DownloadButton
                  disabled={!result.text}
                  onClick={() =>
                    downloadText(
                      result.text,
                      `${tool.id}-${Date.now()}.txt`,
                      "text/plain",
                    )
                  }
                />
              </span>
            }
          >
            {tool.outputLabel}
          </FieldLabel>
          {result.ok ? (
            <OutputBox
              text={result.text}
              maxH="max-h-64"
              empty="Output appears as you type."
            />
          ) : (
            <OutputBox text="" empty={result.error} maxH="max-h-64" tone="error" />
          )}
          {!result.ok && (
            <p className="text-xs text-warning/90 mt-1.5 px-1">{result.error}</p>
          )}
        </section>
      </div>
    </div>
  );
}
