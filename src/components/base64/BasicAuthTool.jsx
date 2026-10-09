import { useMemo, useState } from "react";
import { Eye, EyeOff, Refresh, Trash } from "reicon-react";
import {
  CopyTextButton,
  FieldLabel,
  OutputBox,
  downloadText,
  DownloadButton,
} from "./Shared.jsx";
import { decodeBasicAuth, encodeBasicAuth } from "../../utils/base64Ops";

// Basic Auth Decode. Accepts a bare Base64 blob or a full header line
// (`Authorization: Basic <blob>`) and splits it into username / password.
// A compact encode row is included so the tool works in both directions.

function stripHeaderPrefix(input) {
  let s = input.trim();
  s = s.replace(/^authorization\s*:\s*/i, "");
  s = s.replace(/^basic\s+/i, "");
  return s;
}

export default function BasicAuthTool() {
  const [raw, setRaw] = useState("");
  const [reveal, setReveal] = useState(false);

  // Encode side
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [revealEncoded, setRevealEncoded] = useState(false);

  const decoded = useMemo(() => {
    const cleaned = stripHeaderPrefix(raw);
    if (!cleaned) return { ok: false, empty: true, username: "", password: "" };
    try {
      return { ...decodeBasicAuth(cleaned), empty: false };
    } catch (e) {
      return { ok: false, empty: false, error: e?.message ?? "Invalid base64." };
    }
  }, [raw]);

  const encoded = useMemo(
    () => (user || pass ? encodeBasicAuth(user, pass) : ""),
    [user, pass],
  );

  return (
    <div className="space-y-5">
      {/* ══ Decode ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="min-w-0">
          <FieldLabel
            right={
              <span className="text-2xs text-fg-subtle font-mono">
                {raw.length.toLocaleString()} chars
              </span>
            }
          >
            Base64 / header value
          </FieldLabel>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder={"dXNlcjpwYXNzd29yZA==\n\nor: Authorization: Basic dXNlcjpwYXNzd29yZA=="}
            className="w-full h-40 bg-surface border border-line rounded-card p-3 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none leading-relaxed pane-scroll"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => setRaw("Basic dXNlcjpwYXNzd29yZA==")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-dashed border-line bg-transparent text-fg-subtle hover:text-fg hover:border-line-strong text-xs font-medium transition"
            >
              <Refresh size={11} /> Sample
            </button>
            <button
              onClick={() => setRaw("")}
              disabled={!raw}
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
                <button
                  onClick={() => setReveal((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 h-6 rounded-control border border-line bg-surface-raised text-2xs font-medium text-fg-muted hover:text-fg hover:border-line-strong transition"
                >
                  {reveal ? <Eye size={10} /> : <EyeOff size={10} />}
                  {reveal ? "Hide" : "Reveal"}
                </button>
                <CopyTextButton
                  getText={() =>
                    decoded.ok ? `${decoded.username}:${decoded.password}` : ""
                  }
                  label="Copy pair"
                />
              </span>
            }
          >
            Credentials
          </FieldLabel>

          {decoded.empty ? (
            <OutputBox text="" empty="Paste a Basic auth value to decode." maxH="max-h-40" />
          ) : !decoded.ok ? (
            <OutputBox text="" empty={decoded.error} maxH="max-h-40" tone="error" />
          ) : (
            <div className="rounded-card border border-line bg-surface divide-y divide-line overflow-hidden">
              <CredRow label="username" value={decoded.username} reveal={reveal} />
              <CredRow label="password" value={decoded.password} reveal={reveal} />
              {!decoded.ok && decoded.raw && (
                <CredRow label="raw" value={decoded.raw} reveal />
              )}
            </div>
          )}
        </section>
      </div>

      {/* ══ Encode ══ */}
      <section>
        <FieldLabel
          right={
            <span className="flex items-center gap-2">
              <CopyTextButton getText={() => encoded} label="Copy Base64" />
              <DownloadButton
                disabled={!encoded}
                onClick={() => downloadText(encoded, `basic-${Date.now()}.txt`)}
              />
            </span>
          }
        >
          Encode credentials
        </FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="username"
            spellCheck={false}
            className="bg-surface border border-line rounded-control px-3 py-2 text-sm font-mono text-fg placeholder-fg-subtle focus:outline-none focus:border-accent"
          />
          <input
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="password"
            type={revealEncoded ? "text" : "password"}
            spellCheck={false}
            className="bg-surface border border-line rounded-control px-3 py-2 text-sm font-mono text-fg placeholder-fg-subtle focus:outline-none focus:border-accent"
          />
        </div>
        <div className="mt-3">
          <OutputBox
            text={encoded}
            empty="Type a username and password to generate the Base64."
            maxH="max-h-24"
          />
        </div>
      </section>
    </div>
  );
}

function CredRow({ label, value, reveal }) {
  const shown = reveal ? value : "•".repeat(Math.min(value.length, 24));
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 px-3 py-2.5 items-center">
      <span className="text-2xs uppercase tracking-label text-fg-subtle font-medium">
        {label}
      </span>
      <span className="font-mono text-sm text-fg break-all min-w-0">
        {value ? shown : <span className="text-fg-subtle italic">empty</span>}
      </span>
    </div>
  );
}
