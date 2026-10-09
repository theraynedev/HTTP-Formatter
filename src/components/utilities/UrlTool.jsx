import { useMemo, useState } from "react";

import { CopyTextButton, FieldLabel, OutputBox } from "../base64/Shared.jsx";
import { decodeUntilStable, urlDecode, urlEncode, urlEncodeTwice } from "../../utils/urlOps.js";

const MODES = [
  { id: "encode", label: "Encode" },
  { id: "decode", label: "Decode" },
  { id: "double", label: "Double encode" },
  { id: "stable", label: "Decode until stable" },
];

export default function UrlTool() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("encode");
  const [keepReserved, setKeepReserved] = useState(false);

  const result = useMemo(() => {
    if (!input) return { ok: true, text: "" };
    try {
      if (mode === "encode") return { ok: true, text: urlEncode(input, { keepReserved }) };
      if (mode === "double") return { ok: true, text: urlEncodeTwice(input, { keepReserved }) };
      if (mode === "decode") {
        const r = urlDecode(input);
        return r.ok ? { ok: true, text: r.text } : { ok: false, text: "", error: r.error };
      }
      const r = decodeUntilStable(input);
      return r.ok
        ? { ok: true, text: r.text, note: `${r.passes} pass${r.passes === 1 ? "" : "es"}${r.capped ? " · hit the iteration guard" : ""}` }
        : { ok: false, text: "", error: r.error };
    } catch (e) {
      return { ok: false, text: "", error: e?.message ?? "Transform failed." };
    }
  }, [input, mode, keepReserved]);

  const isEncode = mode === "encode" || mode === "double";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs uppercase tracking-label font-medium text-fg-subtle mr-1">
          Mode
        </span>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`h-6 px-2.5 rounded-control border text-2xs font-medium transition ${
              mode === m.id
                ? "border-line bg-surface-raised text-fg"
                : "border-line bg-surface text-fg-subtle hover:text-fg"
            }`}
          >
            {m.label}
          </button>
        ))}
        {isEncode && (
          <button
            onClick={() => setKeepReserved((v) => !v)}
            title="Leave :/?#[]@ etc. intact (encodeURI instead of encodeURIComponent)"
            className={`h-6 px-2.5 rounded-control border text-2xs font-medium transition ml-auto ${
              keepReserved
                ? "border-line bg-surface-raised text-fg"
                : "border-line bg-surface text-fg-subtle hover:text-fg"
            }`}
          >
            Keep URL structure
          </button>
        )}
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
            Input
          </FieldLabel>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder={isEncode ? "a b&c=d" : "a%20b%26c%3Dd"}
            className="w-full h-64 bg-surface border border-line rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll"
          />
        </section>

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
              </span>
            }
          >
            Output
          </FieldLabel>
          {result.ok ? (
            <OutputBox text={result.text} maxH="max-h-64" empty="Output appears as you type." />
          ) : (
            <OutputBox text="" empty={result.error} maxH="max-h-64" tone="error" />
          )}
          {result.ok && result.note && (
            <p className="text-2xs text-fg-subtle mt-2 px-1">{result.note}</p>
          )}
          {!result.ok && (
            <p className="text-xs text-warning/90 mt-1.5 px-1">{result.error}</p>
          )}
        </section>
      </div>
    </div>
  );
}
