import { useMemo, useState } from "react";

import { CopyTextButton, FieldLabel } from "../base64/Shared.jsx";
import { formatHashCandidates, identifyHash } from "../../utils/hashIdOps.js";

// Ranked guesses, never a single answer: several algorithms share a shape, so
// the UI says so out loud instead of pretending to be certain.

const CONFIDENCE = {
  high: { label: "likely", cls: "border-success/30 bg-success/10 text-success" },
  medium: { label: "possible", cls: "border-warning/30 bg-warning/10 text-warning" },
  low: { label: "unlikely", cls: "border-line bg-surface-raised text-fg-subtle" },
};

export default function HashIdTool() {
  const [input, setInput] = useState("");

  const candidates = useMemo(() => identifyHash(input), [input]);
  const trimmed = input.trim();

  return (
    <div className="space-y-4">
      <section className="min-w-0">
        <FieldLabel
          right={
            trimmed && (
              <span className="text-2xs text-fg-subtle font-mono">
                {trimmed.length} chars · {/^[0-9a-f]+$/i.test(trimmed) ? "hex" : "non-hex"}
              </span>
            )
          }
        >
          Hash
        </FieldLabel>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="5d41402abc4b2a76b9719d911017c592"
          className="w-full h-28 bg-surface border border-line rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll"
        />
      </section>

      <section>
        <FieldLabel
          right={
            candidates.length > 0 && (
              <CopyTextButton getText={() => formatHashCandidates(candidates)} label="Copy all" />
            )
          }
        >
          Candidates
        </FieldLabel>

        {!trimmed ? (
          <p className="text-xs text-fg-subtle italic px-1 py-3">
            Paste a hash — length, charset and prefix narrow it down.
          </p>
        ) : candidates.length === 0 ? (
          <div className="rounded-card border border-warning/30 bg-warning/[0.04] px-3 py-2.5">
            <p className="text-xs text-fg">
              No match — this length and charset don't line up with a known digest.
            </p>
            <p className="text-2xs text-fg-subtle mt-1">
              It may be salted, truncated, or a custom format.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {candidates.map((c, i) => {
              const conf = CONFIDENCE[c.confidence] ?? CONFIDENCE.low;
              return (
                <li
                  key={`${c.algo}-${i}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-line bg-surface px-3 py-2"
                >
                  <span className="text-sm font-medium text-fg whitespace-nowrap">{c.algo}</span>
                  <span
                    className={`text-2xs font-medium uppercase tracking-label px-1.5 py-0.5 rounded-chip border whitespace-nowrap ${conf.cls}`}
                  >
                    {conf.label}
                  </span>
                  <span className="text-2xs text-fg-subtle min-w-0">{c.note}</span>
                </li>
              );
            })}
          </ul>
        )}

        {candidates.length > 1 && (
          <p className="text-2xs text-fg-subtle mt-2 px-1">
            Several algorithms share this shape — the hash alone can't tell them apart.
          </p>
        )}
      </section>
    </div>
  );
}
