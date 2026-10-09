import { useState } from "react";
import {
  Send,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Hashtag,
} from "reicon-react";
import CopyButton from "./CopyButton.jsx";
import SchemaPanel from "./SchemaPanel.jsx";
import { Skeleton, SkeletonGroup, SkeletonText } from "./Skeleton.jsx";
import { highlightJson } from "../utils/highlight.js";

const STATUS_COLOR = (code) => {
  if (code >= 500) return "text-danger bg-danger/10 border-danger/30";
  if (code >= 400) return "text-warning bg-warning/10 border-warning/30";
  if (code >= 300) return "text-info bg-info/10 border-info/30";
  if (code >= 200)
    return "text-success bg-success/10 border-success/30";
  return "text-fg-muted bg-surface-raised/10 border-line/30";
};

export default function RequestTester({ parsed }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showRespHeaders, setShowRespHeaders] = useState(false);

  if (!parsed) {
    return (
      <div className="text-center text-fg-subtle py-12 text-sm">
        Format a request first to send it.
      </div>
    );
  }

  const sendRequest = async () => {
    setLoading(true);
    setResult(null);
    const start = performance.now();

    try {
      const headersObj = {};
      for (const h of parsed.headers) {
        const idx = h.indexOf(":");
        if (idx !== -1)
          headersObj[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
      }

      let finalUrl = parsed.baseUrl;
      const enabledParams = (parsed.queryParams ?? []).filter((p) => p.enabled);
      if (enabledParams.length) {
        const qs = enabledParams
          .map(
            (p) =>
              `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`,
          )
          .join("&");
        finalUrl += "?" + qs;
      }

      const opts = { method: parsed.method, headers: headersObj };
      if (
        parsed.payload &&
        parsed.method !== "GET" &&
        parsed.method !== "HEAD"
      ) {
        opts.body = parsed.payload;
      }

      const response = await fetch(finalUrl, opts);
      const elapsed = Math.round(performance.now() - start);
      const respText = await response.text();
      const respHeaders = [];
      response.headers.forEach((v, k) => respHeaders.push(`${k}: ${v}`));

      let bodyIsJson = false;
      let displayBody = respText;
      try {
        const p2 = JSON.parse(respText);
        displayBody = JSON.stringify(p2, null, 2);
        bodyIsJson = true;
      } catch (_) {}

      setResult({
        status: response.status,
        statusText: response.statusText,
        elapsed,
        headers: respHeaders,
        body: respText,
        displayBody,
        bodyIsJson,
        size: new TextEncoder().encode(respText).length,
      });
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setResult({ error: err.message, elapsed });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* CORS warning */}
      <div className="flex items-start gap-2 p-3 rounded-card border border-warning/20 bg-warning/5 text-warning text-xs">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>
          Cross-origin requests may be blocked by CORS. If a request fails, try
          a browser extension like <strong>CORS Unblock</strong> or route
          through a proxy.
        </span>
      </div>

      <button
        onClick={sendRequest}
        disabled={loading}
        className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-medium rounded-card transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send size={15} className={loading ? "animate-pulse" : ""} />
        {loading ? "Sending…" : "Send Request"}
      </button>

      {/* While the request is in flight, hold the shape of the result so the
          layout doesn't jump when the response lands. */}
      {loading && (
        <SkeletonGroup label="Sending request…">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-4 w-44" />
            <div className="rounded-card border border-line bg-surface p-4">
              <SkeletonText lines={7} />
            </div>
          </div>
        </SkeletonGroup>
      )}

      {!loading && result && (
        <div className="space-y-3">
          {result.error ? (
            <div className="p-4 rounded-card border border-danger/30 bg-danger/5 text-danger text-sm font-mono">
              Error: {result.error}
            </div>
          ) : (
            <>
              {/* Status bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-control border text-sm font-mono font-medium ${STATUS_COLOR(result.status)}`}
                >
                  {result.status} {result.statusText}
                </span>
                <span className="flex items-center gap-1 text-xs text-fg-subtle">
                  <Clock size={11} /> {result.elapsed}ms
                </span>
                <span className="flex items-center gap-1 text-xs text-fg-subtle">
                  <Hashtag size={11} /> {(result.size / 1024).toFixed(1)} KB
                </span>
              </div>

              {/* Response headers */}
              <div>
                <button
                  onClick={() => setShowRespHeaders((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg transition mb-1"
                >
                  {showRespHeaders ? (
                    <ChevronUp size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  Response headers ({result.headers.length})
                </button>
                {showRespHeaders && (
                  <div className="bg-surface border border-line rounded-card p-3 font-mono text-xs text-fg-muted max-h-40 overflow-auto">
                    {result.headers.map((h, i) => (
                      <div key={i}>{h}</div>
                    ))}
                  </div>
                )}
              </div>

              {/* Response body */}
              <div className="relative">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xs font-semibold tracking-label uppercase text-fg-subtle">
                    Response Body
                  </h3>
                  <span className="flex-1 h-px bg-surface-raised" />
                  <CopyButton
                    getText={() => result.body}
                    size={13}
                    className="w-6 h-6"
                  />
                </div>
                <div className="bg-surface border border-line rounded-card p-4 max-h-80 overflow-auto font-mono text-xs">
                  {result.bodyIsJson ? (
                    <pre
                      className="whitespace-pre-wrap break-all leading-5"
                      dangerouslySetInnerHTML={{
                        __html: highlightJson(result.body),
                      }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap break-all leading-5 text-fg">
                      {result.displayBody}
                    </pre>
                  )}
                </div>

                {/* Schema inference — only shown for JSON responses */}
                {result.bodyIsJson && <SchemaPanel jsonBody={result.body} />}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
