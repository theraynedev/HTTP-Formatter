import { useMemo, useState } from "react";
import { Refresh } from "reicon-react";

import { CopyTextButton, FieldLabel } from "../base64/Shared.jsx";
import { generateUuids, parseUuid } from "../../utils/uuidOps.js";

// Two jobs in one panel: mint new UUIDs, and tell you what an existing one is.

const SUB_TABS = [
  { id: "generate", label: "Generate" },
  { id: "validate", label: "Validate" },
];

function GeneratePanel() {
  const [version, setVersion] = useState(4);
  const [count, setCount] = useState(5);
  const [seed, setSeed] = useState(0);

  const ids = useMemo(
    () => generateUuids(version, count),
    [version, count, seed], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {[4, 7].map((v) => (
            <button
              key={v}
              onClick={() => setVersion(v)}
              className={`h-6 px-2.5 rounded-control border text-2xs font-medium transition ${
                version === v
                  ? "border-line bg-surface-raised text-fg"
                  : "border-line bg-surface text-fg-subtle hover:text-fg"
              }`}
            >
              v{v}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-label font-medium text-fg-subtle">Count</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
            className="w-20 bg-surface border border-line rounded-control px-2 py-1 text-xs font-mono text-fg focus:outline-none focus:border-accent"
          />
        </label>
        <button
          onClick={() => setSeed((s) => s + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-dashed border-line text-fg-subtle hover:text-fg hover:border-line-strong text-xs font-medium transition"
        >
          <Refresh size={11} /> Regenerate
        </button>
        <CopyTextButton getText={() => ids.join("\n")} label="Copy all" />
      </div>

      <p className="text-2xs text-fg-subtle px-1">
        {version === 4
          ? "v4 is fully random (122 random bits)."
          : "v7 leads with a millisecond timestamp, so the values sort in creation order."}
      </p>

      <ul className="space-y-1">
        {ids.map((id, i) => (
          <li
            key={`${id}-${i}`}
            className="flex items-center gap-2 rounded-card border border-line bg-surface px-3 py-1.5"
          >
            <code className="font-mono text-xs text-fg flex-1 min-w-0 truncate">{id}</code>
            <CopyTextButton getText={() => id} label="" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ValidatePanel() {
  const [input, setInput] = useState("");
  const result = useMemo(() => (input.trim() ? parseUuid(input) : null), [input]);

  return (
    <div className="space-y-4">
      <section className="min-w-0">
        <FieldLabel>UUID</FieldLabel>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="550e8400-e29b-41d4-a716-446655440000"
          className="w-full bg-surface border border-line rounded-card px-3 py-2 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15"
        />
      </section>

      {result && (
        <div
          className={`rounded-card border px-3 py-2.5 ${
            result.valid ? "border-success/30 bg-success/[0.04]" : "border-warning/30 bg-warning/[0.04]"
          }`}
        >
          {result.valid ? (
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <dt className="text-2xs uppercase tracking-label text-fg-subtle">Version</dt>
                <dd className="text-sm font-mono text-fg mt-0.5">v{result.version}</dd>
              </div>
              <div>
                <dt className="text-2xs uppercase tracking-label text-fg-subtle">Variant</dt>
                <dd className="text-sm font-mono text-fg mt-0.5">{result.variant}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-2xs uppercase tracking-label text-fg-subtle">Canonical</dt>
                <dd className="text-xs font-mono text-fg mt-0.5 break-all">{result.canonical}</dd>
              </div>
              {result.timestampIso && (
                <div className="col-span-2 sm:col-span-4">
                  <dt className="text-2xs uppercase tracking-label text-fg-subtle">
                    Embedded timestamp (v7)
                  </dt>
                  <dd className="text-xs font-mono text-fg mt-0.5">{result.timestampIso}</dd>
                </div>
              )}
              {(result.nil || result.max) && (
                <div className="col-span-2 sm:col-span-4">
                  <dd className="text-2xs text-warning">
                    This is the {result.nil ? "nil" : "max"} UUID — a sentinel, not a real identifier.
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-xs text-fg">{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function UuidTool() {
  const [tab, setTab] = useState("generate");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`h-6 px-2.5 rounded-control border text-2xs font-medium transition ${
              tab === t.id
                ? "border-line bg-surface-raised text-fg"
                : "border-line bg-surface text-fg-subtle hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Rendered, not unmounted, so each side keeps its state. */}
      <div style={{ display: tab === "generate" ? "block" : "none" }}>
        <GeneratePanel />
      </div>
      <div style={{ display: tab === "validate" ? "block" : "none" }}>
        <ValidatePanel />
      </div>
    </div>
  );
}
