import { useMemo, useState } from "react";

import { CopyTextButton, FieldLabel, OutputBox } from "../base64/Shared.jsx";
import { parseJsonSafe } from "../../utils/jsonOps.js";
import {
  JWT_ALGS,
  encodeJwt,
  formatDuration,
  inspectJwt,
  verifyJwt,
} from "../../utils/jwt.js";

// Decode / sign / verify. Decoding reuses `inspectJwt`; signing and verifying
// go through Web Crypto and are therefore async, so those two tabs are
// button-driven rather than live.

const SUB_TABS = [
  { id: "decode", label: "Decode" },
  { id: "encode", label: "Encode" },
  { id: "verify", label: "Verify" },
];

const FLAG_STYLE = {
  error: "border-danger/30 bg-danger/10 text-danger",
  warn: "border-warning/30 bg-warning/10 text-warning",
  info: "border-line bg-surface-raised text-fg-subtle",
};

const SAMPLE_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ." +
  "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const textareaCls =
  "w-full bg-surface border border-line rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll";

// ─── Decode ───────────────────────────────────────────────────────────────────

function DecodePanel() {
  const [token, setToken] = useState("");
  const result = useMemo(() => (token.trim() ? inspectJwt(token) : null), [token]);

  return (
    <div className="space-y-4">
      <section className="min-w-0">
        <FieldLabel
          right={
            <button
              onClick={() => setToken(SAMPLE_TOKEN)}
              className="text-2xs font-medium text-fg-subtle hover:text-fg transition"
            >
              Sample
            </button>
          }
        >
          Token
        </FieldLabel>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
          className={`${textareaCls} h-24`}
        />
      </section>

      {result && !result.ok && (
        <div className="rounded-card border border-warning/30 bg-warning/[0.04] px-3 py-2.5">
          <p className="text-xs text-fg">{result.error}</p>
        </div>
      )}

      {result?.ok && (
        <>
          {result.flags.length > 0 && (
            <ul className="space-y-1.5">
              {result.flags.map((f, i) => (
                <li
                  key={i}
                  className={`rounded-card border px-3 py-2 text-xs ${FLAG_STYLE[f.level] ?? FLAG_STYLE.info}`}
                >
                  {f.message}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-x-5 gap-y-1 px-1 text-2xs font-mono">
            <span className="text-fg-subtle">
              alg <span className="text-fg">{result.alg ?? "—"}</span>
            </span>
            {result.exp != null && (
              <span className="text-fg-subtle">
                exp <span className="text-fg">{new Date(result.exp * 1000).toISOString()}</span>
                {result.secondsLeft != null && (
                  <span className={result.secondsLeft > 0 ? "text-success" : "text-danger"}>
                    {" "}
                    ({result.secondsLeft > 0 ? `in ${formatDuration(result.secondsLeft)}` : `expired ${formatDuration(Math.abs(result.secondsLeft))} ago`})
                  </span>
                )}
              </span>
            )}
            {result.iat != null && (
              <span className="text-fg-subtle">
                iat <span className="text-fg">{new Date(result.iat * 1000).toISOString()}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="min-w-0">
              <FieldLabel right={<CopyTextButton getText={() => JSON.stringify(result.header, null, 2)} />}>
                Header
              </FieldLabel>
              <OutputBox text={JSON.stringify(result.header, null, 2)} maxH="max-h-72" />
            </section>
            <section className="min-w-0">
              <FieldLabel right={<CopyTextButton getText={() => JSON.stringify(result.payload, null, 2)} />}>
                Payload
              </FieldLabel>
              <OutputBox text={JSON.stringify(result.payload, null, 2)} maxH="max-h-72" />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Encode ───────────────────────────────────────────────────────────────────

function EncodePanel() {
  const [headerText, setHeaderText] = useState('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
  const [payloadText, setPayloadText] = useState('{\n  "sub": "1234567890",\n  "name": "John Doe"\n}');
  const [secret, setSecret] = useState("");
  const [alg, setAlg] = useState("HS256");
  const [out, setOut] = useState(null);

  const sign = async () => {
    const h = parseJsonSafe(headerText);
    const p = parseJsonSafe(payloadText);
    if (!h.ok) return setOut({ ok: false, error: `Header is not valid JSON: ${h.error}` });
    if (!p.ok) return setOut({ ok: false, error: `Payload is not valid JSON: ${p.error}` });
    const res = await encodeJwt({ header: h.value, payload: p.value, secret, alg });
    setOut(res);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="min-w-0">
          <FieldLabel>Header (JSON)</FieldLabel>
          <textarea
            value={headerText}
            onChange={(e) => setHeaderText(e.target.value)}
            spellCheck={false}
            className={`${textareaCls} h-28`}
          />
        </section>
        <section className="min-w-0">
          <FieldLabel>Payload (JSON)</FieldLabel>
          <textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            spellCheck={false}
            className={`${textareaCls} h-28`}
          />
        </section>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-2xs uppercase tracking-label font-medium text-fg-subtle">Algorithm</span>
          <select
            value={alg}
            onChange={(e) => setAlg(e.target.value)}
            className="bg-surface border border-line rounded-control px-2 py-1.5 text-xs font-medium text-fg focus:outline-none focus:border-accent"
          >
            {JWT_ALGS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="text-2xs uppercase tracking-label font-medium text-fg-subtle">Secret</span>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="your-256-bit-secret"
            className="bg-surface border border-line rounded-control px-3 py-1.5 font-mono text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-accent"
          />
        </label>
        <button
          onClick={sign}
          className="h-[30px] px-4 rounded-control border border-accent/40 bg-accent/15 text-accent-text text-xs font-medium hover:bg-accent/25 transition"
        >
          Sign
        </button>
      </div>

      {out && (
        <section className="min-w-0">
          <FieldLabel right={out.ok && <CopyTextButton getText={() => out.token} />}>
            Signed token
          </FieldLabel>
          {out.ok ? (
            <OutputBox text={out.token} maxH="max-h-40" />
          ) : (
            <OutputBox text="" empty={out.error} maxH="max-h-40" tone="error" />
          )}
        </section>
      )}
    </div>
  );
}

// ─── Verify ───────────────────────────────────────────────────────────────────

function VerifyPanel() {
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [out, setOut] = useState(null);

  const check = async () => {
    setOut(await verifyJwt(token, secret));
  };

  return (
    <div className="space-y-4">
      <section className="min-w-0">
        <FieldLabel>Token</FieldLabel>
        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
          className={`${textareaCls} h-24`}
        />
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <span className="text-2xs uppercase tracking-label font-medium text-fg-subtle">Secret</span>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="your-256-bit-secret"
            className="bg-surface border border-line rounded-control px-3 py-1.5 font-mono text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-accent"
          />
        </label>
        <button
          onClick={check}
          disabled={!token.trim()}
          className="h-[30px] px-4 rounded-control border border-accent/40 bg-accent/15 text-accent-text text-xs font-medium hover:bg-accent/25 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Verify
        </button>
      </div>

      {out && (
        <div
          className={`rounded-card border px-3 py-2.5 ${
            out.valid ? "border-success/30 bg-success/[0.04]" : "border-danger/30 bg-danger/[0.04]"
          }`}
        >
          <p className={`text-sm font-medium ${out.valid ? "text-success" : "text-danger"}`}>
            {out.valid ? "Signature valid" : "Not verified"}
          </p>
          <p className="text-xs text-fg-subtle mt-0.5">{out.reason}</p>
          {out.alg && (
            <p className="text-2xs font-mono text-fg-subtle mt-1">
              alg {out.alg}
              {out.freshness ? ` · exp ${out.freshness}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function JwtTool() {
  const [tab, setTab] = useState("decode");

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

      {/* Rendered, not unmounted, so each tab keeps its state. */}
      <div style={{ display: tab === "decode" ? "block" : "none" }}>
        <DecodePanel />
      </div>
      <div style={{ display: tab === "encode" ? "block" : "none" }}>
        <EncodePanel />
      </div>
      <div style={{ display: tab === "verify" ? "block" : "none" }}>
        <VerifyPanel />
      </div>
    </div>
  );
}
