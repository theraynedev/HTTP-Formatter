import { useMemo, useState } from "react";

import { CopyTextButton, FieldLabel } from "../base64/Shared.jsx";
import { TIMEZONES, convertBatch, convertTimestamp } from "../../utils/timeOps.js";

const MAX_ROWS = 500;

export default function TimestampTool() {
  const [input, setInput] = useState("");
  const [timeZone, setTimeZone] = useState("UTC");

  const rows = useMemo(() => convertBatch(input, { timeZone }), [input, timeZone]);
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-2xs uppercase tracking-label font-medium text-fg-subtle">
            Timezone
          </span>
          <select
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            className="bg-surface border border-line rounded-control px-2 py-1 text-xs font-medium text-fg focus:outline-none focus:border-accent"
          >
            {TIMEZONES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {rows.length > 0 && (
          <CopyTextButton
            getText={() => rows.filter((r) => r.ok).map((r) => r.iso).join("\n")}
            label="Copy ISO"
          />
        )}
      </div>

      <section className="min-w-0">
        <FieldLabel
          right={
            <span className="text-2xs text-fg-subtle font-mono">
              one per line · s / ms / µs / ns auto-detected
            </span>
          }
        >
          Timestamps
        </FieldLabel>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder={"1700000000\n1700000000000\nnow"}
          className="w-full h-32 bg-surface border border-line rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll"
        />
      </section>

      {rows.length > 0 && (
        <section className="min-w-0">
          <FieldLabel
            right={
              <span className="text-2xs text-fg-subtle font-mono">
                {rows.length} row{rows.length === 1 ? "" : "s"}
              </span>
            }
          >
            Converted
          </FieldLabel>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-2xs uppercase tracking-label text-fg-subtle">
                  <th className="font-medium py-1.5 pr-3 whitespace-nowrap">Input</th>
                  <th className="font-medium py-1.5 pr-3 whitespace-nowrap">Unit</th>
                  <th className="font-medium py-1.5 pr-3 whitespace-nowrap">ISO 8601</th>
                  <th className="font-medium py-1.5 pr-3 whitespace-nowrap">Human</th>
                  <th className="font-medium py-1.5 whitespace-nowrap">Relative</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {shown.map((r, i) => (
                  <tr key={i} className="border-t border-line align-top">
                    <td className="py-1.5 pr-3 text-fg-muted whitespace-nowrap">{r.input}</td>
                    {r.ok ? (
                      <>
                        <td className="py-1.5 pr-3 text-fg-subtle whitespace-nowrap">{r.unit}</td>
                        <td className="py-1.5 pr-3 text-fg whitespace-nowrap">{r.iso}</td>
                        <td className="py-1.5 pr-3 text-fg-muted">{r.custom ?? r.utc}</td>
                        <td className="py-1.5 text-fg-subtle whitespace-nowrap">{r.relative}</td>
                      </>
                    ) : (
                      <td colSpan={4} className="py-1.5 text-warning/90">
                        {r.error}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > MAX_ROWS && (
            <p className="text-2xs text-fg-subtle mt-2">
              Showing the first {MAX_ROWS} of {rows.length} rows.
            </p>
          )}
        </section>
      )}

      {!input.trim() && (
        <p className="text-xs text-fg-subtle italic px-1">
          Paste one or many timestamps. The unit is inferred from the digit count.
        </p>
      )}
    </div>
  );
}
