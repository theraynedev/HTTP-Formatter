import { useState, useMemo } from "react";
import {
  Search,
  SortDownUp,
  EyeOff,
  Eye,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash,
  AlertTriangle,
  AlertCircle,
  InfoCircle,
  Refresh,
  Edit2,
  X,
} from "reicon-react";
import CopyDropdown from "./CopyDropdown.jsx";
import MethodBadge from "./MethodBadge.jsx";
import JwtPanel from "./JwtPanel.jsx";
import {
  highlightJson,
  highlightUrl,
  highlightHeaderLine,
} from "../utils/highlight.js";
import { reconstructCurl } from "../utils/parser.js";
import { lintHeaders, lintIndex } from "../utils/linter.js";
import {
  parseBody,
  fieldsToJson,
  fieldsToFormEncoded,
} from "../utils/multipart.js";

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ label, children, copyOptions, badge }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xs font-semibold tracking-label uppercase text-fg-subtle">
          {label}
        </h2>
        {badge}
        <span className="flex-1 h-px bg-surface-raised" />
        {copyOptions?.length > 0 && (
          <CopyDropdown options={copyOptions} size={13} className="h-7" />
        )}
      </div>
      {children}
    </section>
  );
}

// ─── Lint badge ───────────────────────────────────────────────────────────────
function LintBadge({ issues, onClick }) {
  if (!issues?.length) return null;
  const hasError = issues.some((i) => i.level === "error");
  const hasWarn = issues.some((i) => i.level === "warn");
  const color = hasError
    ? "text-danger border-danger/30 bg-danger/10"
    : hasWarn
      ? "text-warning border-warning/30 bg-warning/10"
      : "text-info border-info/30 bg-info/10";
  const Icon = hasError ? AlertCircle : hasWarn ? AlertTriangle : InfoCircle;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-chip border text-2xs font-medium transition hover:opacity-80 ${color}`}
    >
      <Icon size={10} />
      {issues.length}
    </button>
  );
}

// ─── Linter panel ─────────────────────────────────────────────────────────────
function LintPanel({ issues }) {
  if (!issues?.length) return null;
  const LEVEL_STYLE = {
    error: {
      icon: AlertCircle,
      color: "text-danger",
      bg: "bg-danger/5 border-danger/20",
    },
    warn: {
      icon: AlertTriangle,
      color: "text-warning",
      bg: "bg-warning/5 border-warning/20",
    },
    info: {
      icon: InfoCircle,
      color: "text-info",
      bg: "bg-info/5 border-info/20",
    },
  };
  return (
    <div className="mt-2 space-y-1.5">
      {issues.map((issue, i) => {
        const {
          icon: Icon,
          color,
          bg,
        } = LEVEL_STYLE[issue.level] ?? LEVEL_STYLE.info;
        return (
          <div
            key={i}
            className={`flex items-start gap-2 px-3 py-2 rounded-control border text-xs ${bg}`}
          >
            <Icon size={13} className={`${color} mt-0.5 shrink-0`} />
            <span className="text-fg leading-relaxed">
              {issue.header && (
                <span className={`font-mono ${color} mr-1`}>
                  {issue.header}:
                </span>
              )}
              {issue.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── URL Section ──────────────────────────────────────────────────────────────
function UrlSection({ parsed, onQueryChange, onCurlUpdate }) {
  const [showParams, setShowParams] = useState(false);
  const { url, method, queryParams = [], baseUrl } = parsed;

  const buildUrl = (params) => {
    if (!params.length) return baseUrl;
    const qs = params
      .filter((p) => p.enabled)
      .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join("&");
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  };

  const apply = (next) => {
    const newUrl = buildUrl(next);
    onQueryChange(next, newUrl);
    onCurlUpdate?.({ ...parsed, queryParams: next, url: newUrl });
  };

  const handleParamToggle = (idx) =>
    apply(
      queryParams.map((p, i) =>
        i === idx ? { ...p, enabled: !p.enabled } : p,
      ),
    );
  const handleParamEdit = (idx, field, val) =>
    apply(queryParams.map((p, i) => (i === idx ? { ...p, [field]: val } : p)));
  const handleParamAdd = () =>
    apply([...queryParams, { key: "", value: "", enabled: true }]);
  const handleParamDelete = (idx) =>
    apply(queryParams.filter((_, i) => i !== idx));

  const copyOptions = [
    { label: "Copy URL", getText: () => url },
    {
      label: "Copy path only",
      getText: () => {
        try {
          return new URL(url).pathname;
        } catch (_) {
          return url;
        }
      },
    },
    { label: "Copy as curl (GET)", getText: () => `curl '${url}'` },
    {
      label: "Copy origin",
      getText: () => {
        try {
          return new URL(url).origin;
        } catch (_) {
          return url;
        }
      },
    },
  ];

  return (
    <Section label="URL" copyOptions={copyOptions}>
      <div className="min-w-0 max-w-full bg-surface border border-line rounded-card p-4 font-mono text-sm break-all">
        <div className="flex items-center gap-2 flex-wrap">
          <MethodBadge method={method} />
          <span
            className="min-w-0 flex-1 break-all"
            dangerouslySetInnerHTML={{ __html: highlightUrl(url) }}
          />
        </div>

        {queryParams.length > 0 && (
          <button
            onClick={() => setShowParams((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs text-fg-subtle hover:text-fg transition"
          >
            {showParams ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {queryParams.length} query param
            {queryParams.length !== 1 ? "s" : ""}
          </button>
        )}

        {showParams && (
          <div className="mt-3 space-y-2">
            {queryParams.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={() => handleParamToggle(i)}
                  className="accent-accent"
                />
                <input
                  value={p.key}
                  onChange={(e) => handleParamEdit(i, "key", e.target.value)}
                  placeholder="key"
                  className="w-1/3 bg-surface-raised border border-line rounded-chip px-2 py-1 text-xs font-mono text-success focus:outline-none focus:border-accent"
                />
                <span className="text-fg-subtle">=</span>
                <input
                  value={p.value}
                  onChange={(e) => handleParamEdit(i, "value", e.target.value)}
                  placeholder="value"
                  className="flex-1 bg-surface-raised border border-line rounded-chip px-2 py-1 text-xs font-mono text-danger focus:outline-none focus:border-accent"
                />
                <button
                  onClick={() => handleParamDelete(i)}
                  className="text-fg-subtle hover:text-danger transition"
                >
                  <Trash size={12} />
                </button>
              </div>
            ))}
            <button
              onClick={handleParamAdd}
              className="flex items-center gap-1 text-xs text-fg-subtle hover:text-fg mt-1 transition"
            >
              <Plus size={12} /> Add param
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}

// ─── Headers Section ──────────────────────────────────────────────────────────
function HeadersSection({ headers, lintIssues, onHeadersChange }) {
  const [search, setSearch] = useState("");
  const [sortAlpha, setSortAlpha] = useState(false);
  const [maskSensitive, setMaskSensitive] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showLint, setShowLint] = useState(true);

  // Track original index alongside each header so we can remove the right
  // line even after the array has been filtered and/or sorted. Without this,
  // duplicate header strings would be ambiguous to remove. Memoized so the
  // map+filter doesn't re-run on every render (it would re-run whenever any
  // other piece of state — mask, edit mode, search, lint toggle — flipped).
  const indexed = useMemo(
    () =>
      headers
        .map((h, i) => ({ h, i }))
        .filter(({ h }) =>
          h.toLowerCase().includes(search.toLowerCase()),
        ),
    [headers, search],
  );
  const sorted = useMemo(
    () => (sortAlpha ? [...indexed].sort((a, b) => a.h.localeCompare(b.h)) : indexed),
    [indexed, sortAlpha],
  );

  const handleRemove = (origIdx) => {
    if (!onHeadersChange) return;
    onHeadersChange(headers.filter((_, i) => i !== origIdx));
  };

  const headersToObj = () => {
    const obj = {};
    for (const h of headers) {
      const idx = h.indexOf(":");
      if (idx !== -1) obj[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
    }
    return obj;
  };

  const copyOptions = useMemo(
    () => [
      { label: "Copy as text", getText: () => headers.join("\n") },
      {
        label: "Copy as JSON",
        getText: () => JSON.stringify(headersToObj(), null, 2),
      },
      {
        label: "Copy as -H flags",
        getText: () => headers.map((h) => `-H '${h}'`).join(" \\\n"),
      },
      {
        label: "Copy as .env",
        getText: () =>
          headers
            .map((h) => {
              const idx = h.indexOf(":");
              if (idx === -1) return "";
              return `${h.slice(0, idx).trim().toUpperCase().replace(/-/g, "_")}=${h.slice(idx + 1).trim()}`;
            })
            .filter(Boolean)
            .join("\n"),
      },
    ],
    [headers],
  );

  const lintBadge =
    lintIssues?.length > 0 ? (
      <LintBadge issues={lintIssues} onClick={() => setShowLint((v) => !v)} />
    ) : null;

  return (
    <Section label="Headers" copyOptions={copyOptions} badge={lintBadge}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter headers…"
            className="w-full pl-7 pr-3 py-1.5 bg-surface-raised border border-line rounded-control text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-accent"
          />
        </div>
        <button
          onClick={() => setSortAlpha((v) => !v)}
          title={sortAlpha ? "Original order" : "Sort A–Z"}
          className={`p-1.5 rounded-control border transition ${sortAlpha ? "border-line bg-surface-raised text-fg" : "border-line bg-surface-raised text-fg-subtle hover:text-fg"}`}
        >
          <SortDownUp size={12} />
        </button>
        <button
          onClick={() => setMaskSensitive((v) => !v)}
          title={maskSensitive ? "Show sensitive" : "Mask sensitive"}
          className={`p-1.5 rounded-control border transition ${maskSensitive ? "border-line bg-surface-raised text-fg" : "border-line bg-surface-raised text-fg-subtle hover:text-fg"}`}
        >
          {maskSensitive ? <Eye size={12} /> : <EyeOff size={12} />}
        </button>
        <button
          onClick={() => setEditMode((v) => !v)}
          title={editMode ? "Done editing headers" : "Edit headers (remove lines)"}
          className={`p-1.5 rounded-control border transition ${editMode ? "border-warning/40 bg-warning/10 text-warning" : "border-line bg-surface-raised text-fg-subtle hover:text-fg"}`}
        >
          <Edit2 size={12} />
        </button>
      </div>

      <div className="bg-surface border border-line rounded-card p-4 font-mono text-sm">
        {sorted.length === 0 ? (
          <p className="text-fg-subtle text-xs">
            {search ? "No headers match your filter." : "No headers."}
          </p>
        ) : (
          <div className="min-w-0 max-w-full leading-6 space-y-0.5">
            {sorted.map(({ h, i: origIdx }) => (
              <div
                key={`${origIdx}-${h}`}
                className={`group flex items-start gap-2 ${editMode ? "pl-1 -ml-1 pr-1 -mr-1 rounded-chip hover:bg-surface-raised" : ""}`}
              >
                <span
                  className="min-w-0 flex-1 break-all"
                  dangerouslySetInnerHTML={{
                    __html: highlightHeaderLine(h, maskSensitive),
                  }}
                />
                {editMode && (
                  <button
                    onClick={() => handleRemove(origIdx)}
                    title="Remove this header"
                    aria-label="Remove header"
                    className="shrink-0 text-fg-subtle hover:text-danger transition mt-0.5"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lint issues */}
      {showLint && lintIssues?.length > 0 && <LintPanel issues={lintIssues} />}

      {search && indexed.length !== headers.length && (
        <p className="text-xs text-fg-subtle mt-1">
          {indexed.length} of {headers.length} headers
        </p>
      )}
    </Section>
  );
}

// ─── Multipart / form-encoded body editor ─────────────────────────────────────
function MultipartEditor({
  fields: initialFields,
  isMultipart,
  onConvertToJson,
  onConvertToForm,
  onUpdateFields,
}) {
  const [fields, setFields] = useState(initialFields);

  const handleEdit = (idx, key, val) => {
    const next = fields.map((f, i) => (i === idx ? { ...f, [key]: val } : f));
    setFields(next);
    onUpdateFields?.(next);
  };
  const handleAdd = () => {
    const next = [
      ...fields,
      { key: "", value: "", filename: null, contentType: null },
    ];
    setFields(next);
    onUpdateFields?.(next);
  };
  const handleDelete = (idx) => {
    const next = fields.filter((_, i) => i !== idx);
    setFields(next);
    onUpdateFields?.(next);
  };

  const typeLabel = isMultipart
    ? "multipart/form-data"
    : "application/x-www-form-urlencoded";

  return (
    <div className="mt-2 space-y-2">
      {/* Type label + convert buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-2xs font-mono text-fg-subtle border border-line px-2 py-0.5 rounded-chip">
          {typeLabel}
        </span>
        <button
          onClick={onConvertToJson}
          className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-control border border-line bg-surface-raised text-fg-muted hover:text-fg hover:border-line-strong transition"
        >
          <Refresh size={10} /> Convert to JSON
        </button>
        {isMultipart && (
          <button
            onClick={onConvertToForm}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-control border border-line bg-surface-raised text-fg-muted hover:text-fg hover:border-line-strong transition"
          >
            <Refresh size={10} /> Convert to form-encoded
          </button>
        )}
      </div>

      {/* Field rows */}
      <div className="space-y-1.5">
        {fields.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={f.key}
              onChange={(e) => handleEdit(i, "key", e.target.value)}
              placeholder="name"
              className="w-1/4 bg-surface-raised border border-line rounded-chip px-2 py-1 text-xs font-mono text-success focus:outline-none focus:border-accent"
            />
            {f.filename ? (
              <span className="flex-1 text-xs font-mono text-fg-subtle truncate border border-line rounded-chip px-2 py-1 bg-surface">
                📎 {f.filename}
              </span>
            ) : (
              <input
                value={f.value}
                onChange={(e) => handleEdit(i, "value", e.target.value)}
                placeholder="value"
                className="flex-1 bg-surface-raised border border-line rounded-chip px-2 py-1 text-xs font-mono text-danger focus:outline-none focus:border-accent"
              />
            )}
            {f.contentType && (
              <span className="text-2xs text-fg-subtle font-mono shrink-0 max-w-[80px] truncate">
                {f.contentType}
              </span>
            )}
            <button
              onClick={() => handleDelete(i)}
              className="text-fg-subtle hover:text-danger transition shrink-0"
            >
              <Trash size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={handleAdd}
        className="flex items-center gap-1 text-xs text-fg-subtle hover:text-fg mt-1 transition"
      >
        <Plus size={12} /> Add field
      </button>
    </div>
  );
}

// ─── Payload Section ──────────────────────────────────────────────────────────
function PayloadSection({ payload, bodyIsJson, headers, onPayloadChange }) {
  const [pretty, setPretty] = useState(true);
  const [viewMode, setViewMode] = useState("raw"); // 'raw' | 'form'

  // Detect content-type from headers
  const ct = useMemo(() => {
    for (const h of headers) {
      if (h.toLowerCase().startsWith("content-type:"))
        return h.slice("content-type:".length).trim().toLowerCase();
    }
    return "";
  }, [headers]);

  // Try to parse as form/multipart
  const formData = useMemo(
    () => (payload ? parseBody(payload, ct) : null),
    [payload, ct],
  );
  const canShowForm = !!formData;

  const prettyText = () => {
    try {
      return JSON.stringify(JSON.parse(payload), null, 2);
    } catch (_) {
      return payload;
    }
  };
  const compactText = () => {
    try {
      return JSON.stringify(JSON.parse(payload));
    } catch (_) {
      return payload;
    }
  };
  const formEncoded = () => {
    try {
      const obj = JSON.parse(payload);
      return Object.entries(obj)
        .map(
          ([k, v]) =>
            `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
        )
        .join("&");
    } catch (_) {
      return payload;
    }
  };

  const displayText = bodyIsJson && pretty ? prettyText() : compactText();

  // Default copy always mirrors the active view mode so clicking the copy
  // button once gives you exactly what you're looking at.
  const copyOptions = bodyIsJson
    ? pretty
      ? [
          { label: "Copy pretty JSON", getText: prettyText },
          { label: "Copy compact JSON", getText: compactText },
          { label: "Copy form-encoded", getText: formEncoded },
        ]
      : [
          { label: "Copy compact JSON", getText: compactText },
          { label: "Copy pretty JSON", getText: prettyText },
          { label: "Copy form-encoded", getText: formEncoded },
        ]
    : [{ label: "Copy payload", getText: () => payload }];

  const handleConvertToJson = () => {
    if (!formData) return;
    const json = fieldsToJson(formData.fields);
    onPayloadChange?.(json, true);
    setViewMode("raw");
  };

  const handleConvertToFormEncoded = () => {
    if (!formData) return;
    const encoded = fieldsToFormEncoded(formData.fields);
    onPayloadChange?.(encoded, false);
    setViewMode("raw");
  };

  return (
    <Section label="Payload" copyOptions={copyOptions}>
      {/* Toggle bar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {bodyIsJson && (
          <>
            <button
              onClick={() => setPretty(true)}
              className={`text-xs px-3 py-1 rounded-control border transition ${pretty ? "border-line bg-surface-raised text-fg" : "border-line bg-surface-raised text-fg-subtle hover:text-fg"}`}
            >
              Pretty
            </button>
            <button
              onClick={() => setPretty(false)}
              className={`text-xs px-3 py-1 rounded-control border transition ${!pretty ? "border-line bg-surface-raised text-fg" : "border-line bg-surface-raised text-fg-subtle hover:text-fg"}`}
            >
              Compact
            </button>
          </>
        )}
        {canShowForm && (
          <>
            <button
              onClick={() => setViewMode("raw")}
              className={`text-xs px-3 py-1 rounded-control border transition ${viewMode === "raw" ? "border-line bg-surface-raised text-fg" : "border-line bg-surface-raised text-fg-subtle hover:text-fg"}`}
            >
              Raw
            </button>
            <button
              onClick={() => setViewMode("form")}
              className={`text-xs px-3 py-1 rounded-control border transition ${viewMode === "form" ? "border-line bg-surface-raised text-fg" : "border-line bg-surface-raised text-fg-subtle hover:text-fg"}`}
            >
              Fields
            </button>
          </>
        )}
      </div>

      {viewMode === "form" && formData ? (
        <div className="bg-surface border border-line rounded-card p-4">
          <MultipartEditor
            fields={formData.fields}
            isMultipart={formData.isMultipart}
            onConvertToJson={handleConvertToJson}
            onConvertToFormEncoded={handleConvertToFormEncoded}
          />
        </div>
      ) : (
        <div className="min-w-0 max-w-full bg-surface border border-line rounded-card p-4 max-h-72 overflow-y-auto font-mono text-xs">
          {payload ? (
            bodyIsJson && pretty ? (
              <pre
                className="min-w-0 max-w-full whitespace-pre-wrap break-all leading-5"
                dangerouslySetInnerHTML={{ __html: highlightJson(payload) }}
              />
            ) : (
              <pre className="min-w-0 max-w-full whitespace-pre-wrap break-all leading-5 text-fg">
                {displayText}
              </pre>
            )
          ) : (
            <p className="text-fg-subtle">No payload.</p>
          )}
        </div>
      )}
    </Section>
  );
}

// ─── Master copy-as-curl bar ──────────────────────────────────────────────────
function MasterCurlBar({ parsed }) {
  const curlOptions = [
    { label: "Copy full curl command", getText: () => reconstructCurl(parsed) },
    { label: "Copy URL only", getText: () => parsed.url },
    {
      label: "Copy method + URL",
      getText: () => `${parsed.method} ${parsed.url}`,
    },
  ];
  return (
    <div className="flex min-w-0 items-center justify-between px-4 py-2.5 rounded-card border border-line bg-surface">
      <span className="min-w-0 flex-1 text-xs text-fg-subtle font-mono truncate mr-3">
        <span className="text-fg-subtle">{parsed.method}</span> {parsed.url}
      </span>
      <CopyDropdown options={curlOptions} size={13} className="h-7 shrink-0" />
    </div>
  );
}

// ─── Main OutputPanel ─────────────────────────────────────────────────────────
export default function OutputPanel({
  parsed,
  onQueryChange,
  onCurlUpdate,
  onParsedChange,
}) {
  if (!parsed) return null;

  // Compute lint issues once per render
  const allLintIssues = lintHeaders(parsed.headers, parsed.method, parsed.url);
  const lintIdx = lintIndex(allLintIssues);

  const handlePayloadChange = (newPayload, newBodyIsJson) => {
    onParsedChange?.({
      ...parsed,
      payload: newPayload,
      bodyIsJson: newBodyIsJson,
    });
  };

  const handleHeadersChange = (newHeaders) => {
    onParsedChange?.({ ...parsed, headers: newHeaders });
  };

  return (
    <div className="space-y-7">
      <MasterCurlBar parsed={parsed} />
      <UrlSection
        parsed={parsed}
        onQueryChange={onQueryChange}
        onCurlUpdate={onCurlUpdate}
      />
      <HeadersSection
        headers={parsed.headers}
        lintIssues={allLintIssues}
        onHeadersChange={handleHeadersChange}
      />
      <JwtPanel headers={parsed.headers} />
      {(parsed.payload || parsed.bodyIsJson) && (
        <PayloadSection
          payload={parsed.payload}
          bodyIsJson={parsed.bodyIsJson}
          headers={parsed.headers}
          onPayloadChange={handlePayloadChange}
        />
      )}
    </div>
  );
}
