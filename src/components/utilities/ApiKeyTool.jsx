import { useMemo, useState } from "react";
import { EyeOff } from "reicon-react";

import { CopyTextButton, FieldLabel, OutputBox } from "../base64/Shared.jsx";
import { maskToken } from "../../utils/redactOps.js";

// Redact a secret so it can be shared. Shows the tail (and optionally a
// non-secret type prefix like "sk_live_") and hides everything between.

function NumberField({ label, value, onChange, min = 0, max = 64 }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-2xs uppercase tracking-label font-medium text-fg-subtle">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className="w-16 bg-surface border border-line rounded-control px-2 py-1 text-xs font-mono text-fg focus:outline-none focus:border-accent"
      />
    </label>
  );
}

export default function ApiKeyTool() {
  const [input, setInput] = useState("");
  const [visible, setVisible] = useState(4);
  const [keepStart, setKeepStart] = useState(0);

  const output = useMemo(
    () => maskToken(input, { visible, keepStart }),
    [input, visible, keepStart],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <NumberField label="Visible tail" value={visible} onChange={setVisible} max={32} />
        <NumberField label="Keep prefix" value={keepStart} onChange={setKeepStart} max={32} />
        <span className="text-2xs text-fg-subtle">
          Set “Keep prefix” to 8 for <span className="font-mono">sk_live_</span>-style keys.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="min-w-0">
          <FieldLabel
            right={
              <span className="text-2xs text-fg-subtle font-mono">
                {input.length.toLocaleString()} chars
              </span>
            }
          >
            Secret
          </FieldLabel>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="sk_live_abcd1234efgh5678"
            className="w-full h-64 bg-surface border border-line rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll"
          />
          <p className="text-2xs text-fg-subtle mt-2 leading-relaxed">
            Everything is masked except the last {visible} character
            {visible === 1 ? "" : "s"}
            {keepStart > 0 ? ` and the first ${keepStart}` : ""}.
          </p>
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
              </span>
            }
          >
            Redacted
          </FieldLabel>
          <OutputBox text={output} maxH="max-h-64" empty="Output appears as you type." />
          {output && (
            <p className="text-2xs text-fg-subtle mt-2 flex items-center gap-1.5">
              <EyeOff size={11} className="shrink-0" />
              Not reversible — the hidden characters are gone from this output.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
