import { useMemo, useState } from "react";

import { CopyTextButton, FieldLabel } from "../base64/Shared.jsx";
import { checkSecurityHeaders, formatSecurityReport } from "../../utils/secHeadersOps.js";

// Paste a response header block (curl -I, DevTools, a HAR export) and get a
// pass/weak/missing checklist. Audits *response* headers; the Formatter's
// linter audits *requests*.

const STATUS = {
  ok: { label: "present", cls: "border-success/30 bg-success/10 text-success", icon: "✓" },
  weak: { label: "weak", cls: "border-warning/30 bg-warning/10 text-warning", icon: "!" },
  missing: { label: "missing", cls: "border-danger/30 bg-danger/10 text-danger", icon: "✕" },
};

const SAMPLE = `HTTP/1.1 200 OK
Content-Type: text/html
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin`;

export default function SecHeadersTool() {
  const [input, setInput] = useState("");

  const report = useMemo(() => checkSecurityHeaders(input), [input]);
  const hasInput = input.trim().length > 0;

  return (
    <div className="space-y-4">
      <section className="min-w-0">
        <FieldLabel
          right={
            <button
              onClick={() => setInput(SAMPLE)}
              className="text-2xs font-medium text-fg-subtle hover:text-fg transition"
            >
              Sample
            </button>
          }
        >
          Response headers
        </FieldLabel>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder={"HTTP/1.1 200 OK\nContent-Type: text/html\nX-Content-Type-Options: nosniff"}
          className="w-full h-40 bg-surface border border-line rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll"
        />
      </section>

      {hasInput && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
            <span className="text-2xs font-mono text-success">{report.summary.ok} present</span>
            <span className="text-2xs font-mono text-warning">{report.summary.weak} weak</span>
            <span className="text-2xs font-mono text-danger">{report.summary.missing} missing</span>
            <CopyTextButton
              getText={() => formatSecurityReport(report)}
              label="Copy report"
            />
          </div>

          <ul className="space-y-1.5">
            {report.checks.map((c) => {
              const s = STATUS[c.status];
              return (
                <li
                  key={c.name}
                  className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-card border border-line bg-surface px-3 py-2"
                >
                  <span
                    className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center text-2xs font-bold mt-0.5 ${s.cls}`}
                    title={s.label}
                  >
                    {s.icon}
                  </span>
                  <span className="text-xs font-medium text-fg font-mono whitespace-nowrap">
                    {c.name}
                  </span>
                  <span className="text-2xs text-fg-subtle min-w-0 flex-1">{c.note}</span>
                  {c.value && (
                    <code className="text-2xs font-mono text-fg-muted bg-surface-raised border border-line rounded-chip px-1.5 py-0.5 max-w-full truncate">
                      {c.value}
                    </code>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
