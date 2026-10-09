import { useMemo, useState } from "react";
import { Fingerprint, Refresh, Trash } from "reicon-react";

import { MASKIFY_DESCRIPTION, MASKIFY_TOKENS, maskify } from "../utils/maskify.js";
import {
  CopyTextButton,
  DownloadButton,
  FieldLabel,
  OutputBox,
  downloadText,
} from "./base64/Shared.jsx";

// ─── Maskify ──────────────────────────────────────────────────────────────────
// A single-purpose page for `utils/maskify.js`. Deliberately not a multi-tool
// shell: the Base64 tab already covers the encoding codecs, so this page does
// exactly one thing — turn a string into a ?d/?l/?u mask.

const LEGEND = [
  { token: MASKIFY_TOKENS.digit, label: "digit · 0-9" },
  { token: MASKIFY_TOKENS.lower, label: "lowercase · a-z" },
  { token: MASKIFY_TOKENS.upper, label: "uppercase · A-Z" },
];

export default function MaskifyTool() {
  const [input, setInput] = useState("");

  const output = useMemo(() => maskify(input), [input]);
  const lineCount = input ? input.split("\n").length : 0;

  return (
    <div className="max-w-5xl w-full mx-auto space-y-5">
      {/* ── Page header ── */}
      <header className="flex items-start gap-3">
        <span className="w-9 h-9 shrink-0 rounded-card bg-accent/10 border border-accent/30 flex items-center justify-center">
          <Fingerprint size={16} className="text-accent-text" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-fg">Maskify</h1>
          <p className="text-xs text-fg-subtle mt-0.5 max-w-2xl">
            {MASKIFY_DESCRIPTION}
          </p>
        </div>
      </header>

      {/* ── Token legend ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
        <span className="text-2xs uppercase tracking-label font-medium text-fg-subtle">
          Tokens
        </span>
        {LEGEND.map((l) => (
          <span key={l.token} className="inline-flex items-center gap-1.5">
            <code className="font-mono text-2xs px-1.5 py-0.5 rounded-chip border border-line bg-surface-raised text-accent-text">
              {l.token}
            </code>
            <span className="text-2xs text-fg-muted">{l.label}</span>
          </span>
        ))}
        <span className="text-2xs text-fg-subtle">
          everything else is kept verbatim
        </span>
      </div>

      {/* ── Input ⇄ output ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="min-w-0">
          <FieldLabel
            right={
              <span className="text-2xs text-fg-subtle font-mono">
                {input.length.toLocaleString()} chars
                {lineCount > 1 ? ` · ${lineCount} lines` : ""}
              </span>
            }
          >
            Input string
          </FieldLabel>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="1ad48fdf34741318af03a706fe72a42d"
            className="w-full h-64 bg-surface border border-line rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setInput("feac42ff-ca8a-4747-a0a2-9802df7888cc")}
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

        <section className="min-w-0">
          <FieldLabel
            right={
              <span className="flex items-center gap-2">
                {output && (
                  <span className="text-2xs text-fg-subtle font-mono">
                    {output.length.toLocaleString()} chars
                  </span>
                )}
                <CopyTextButton getText={() => output} />
                <DownloadButton
                  disabled={!output}
                  onClick={() =>
                    downloadText(
                      output,
                      `maskify-${Date.now()}.txt`,
                      "text/plain",
                    )
                  }
                />
              </span>
            }
          >
            Mask pattern
          </FieldLabel>
          <OutputBox
            text={output}
            maxH="max-h-64"
            empty="Output appears as you type."
          />
        </section>
      </div>
    </div>
  );
}
