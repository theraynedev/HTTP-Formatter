import { useMemo, useState } from "react";
import {
  Code,
  Code2,
  CodeSquare,
  File,
  FilePdf,
  Hashtag,
  Image,
  Key,
  Link,
  Music,
  Search,
  Text,
  Video,
  Xmark,
} from "reicon-react";
import { ACCENTS } from "./base64/Shared.jsx";
import TextCodecTool from "./base64/TextCodecTool.jsx";
import AsciiDecodeTool from "./base64/AsciiDecodeTool.jsx";
import BasicAuthTool from "./base64/BasicAuthTool.jsx";
import FileToBase64Tool from "./base64/FileToBase64Tool.jsx";
import Base64ToMediaTool from "./base64/Base64ToMediaTool.jsx";
import {
  base64ToHex,
  base64ToText,
  hexToBase64,
  textToBase64,
  toBase64Url,
  wrapBase64,
} from "../utils/base64Ops";

// ─── Registry ─────────────────────────────────────────────────────────────────
// Every tool is a config object. `kind` selects the workspace component;
// the rest (labels, placeholder, transform, toggles) is consumed generically.
// Group `decode` = blue accent, `encode` = orange accent.

const TOOLS = [
  // ── Decoders ───────────────────────────────────────────────────────────────
  {
    id: "base64-to-text",
    label: "Base64 → Text",
    blurb: "Decode to UTF-8 text",
    group: "decode",
    kind: "text-codec",
    icon: Text,
    inputLabel: "Base64",
    outputLabel: "Text",
    placeholder: "Paste Base64…",
    sample: "SGVsbG8sIHdvcmxkISDwn5iK",
    transform: (input) => ({ ok: true, text: base64ToText(input) }),
  },
  {
    id: "base64-to-ascii",
    label: "Base64 → ASCII",
    blurb: "Decode + byte breakdown",
    group: "decode",
    kind: "ascii",
    icon: Hashtag,
  },
  {
    id: "basic-auth",
    label: "Basic Auth Decode",
    blurb: "Split a Basic header value",
    group: "decode",
    kind: "basic-auth",
    icon: Key,
  },
  {
    id: "base64-to-file",
    label: "Base64 → File",
    blurb: "Any blob, save to disk",
    group: "decode",
    kind: "media",
    icon: File,
    expectedKind: "any",
  },
  {
    id: "base64-to-hex",
    label: "Base64 → Hex",
    blurb: "Bytes as hexadecimal",
    group: "decode",
    kind: "text-codec",
    icon: Code2,
    inputLabel: "Base64",
    outputLabel: "Hex",
    placeholder: "Paste Base64…",
    sample: "SGVsbG8h",
    toggles: [
      { key: "upper", label: "Uppercase", hint: "A-F instead of a-f" },
      { key: "spaced", label: "Spaced", hint: "Separate bytes with spaces" },
    ],
    transform: (input, opts) => ({
      ok: true,
      text: base64ToHex(input, { upper: opts.upper, spaced: opts.spaced }),
    }),
  },
  {
    id: "base64-to-image",
    label: "Base64 → Image",
    blurb: "Render a PNG / JPEG / GIF / WebP",
    group: "decode",
    kind: "media",
    icon: Image,
    expectedKind: "image",
  },
  {
    id: "base64-to-pdf",
    label: "Base64 → PDF",
    blurb: "Preview and save a PDF",
    group: "decode",
    kind: "media",
    icon: FilePdf,
    expectedKind: "pdf",
  },
  {
    id: "base64-to-audio",
    label: "Base64 → Audio",
    blurb: "Play MP3 / WAV / OGG",
    group: "decode",
    kind: "media",
    icon: Music,
    expectedKind: "audio",
  },
  {
    id: "base64-to-video",
    label: "Base64 → Video",
    blurb: "Play MP4 / WebM / MOV",
    group: "decode",
    kind: "media",
    icon: Video,
    expectedKind: "video",
  },

  // ── Encoders ───────────────────────────────────────────────────────────────
  {
    id: "text-to-base64",
    label: "Text → Base64",
    blurb: "UTF-8 text to Base64",
    group: "encode",
    kind: "text-codec",
    icon: Text,
    inputLabel: "Text",
    outputLabel: "Base64",
    placeholder: "Type or paste text…",
    sample: "Hello, world! 👋",
    toggles: [
      { key: "wrap", label: "Wrap 76", hint: "Line-wrap for PEM-style output" },
      { key: "urlSafe", label: "URL-safe", hint: "Use - and _ instead of + and /" },
    ],
    transform: (input, opts) => {
      const b64 = textToBase64(input);
      return { ok: true, text: opts.urlSafe ? toBase64Url(b64) : opts.wrap ? wrapBase64(b64, 76) : b64 };
    },
  },
  {
    id: "css-to-base64",
    label: "CSS → Base64",
    blurb: "Inline CSS as a data: URI",
    group: "encode",
    kind: "text-codec",
    icon: Code,
    inputLabel: "CSS",
    outputLabel: "Base64",
    placeholder: "body { margin: 0; }",
    sample: "body { margin: 0; font-family: system-ui; }",
    toggles: [{ key: "dataUri", label: "data: URI", default: true }],
    transform: (input, opts) => {
      const b64 = textToBase64(input);
      return { ok: true, text: opts.dataUri ? `data:text/css;base64,${b64}` : b64 };
    },
  },
  {
    id: "html-to-base64",
    label: "HTML → Base64",
    blurb: "Embed HTML as a data: URI",
    group: "encode",
    kind: "text-codec",
    icon: CodeSquare,
    inputLabel: "HTML",
    outputLabel: "Base64",
    placeholder: "<h1>Hello</h1>",
    sample: '<h1>Hello</h1>\n<p>Encoded by HTTP Formatter.</p>',
    toggles: [{ key: "dataUri", label: "data: URI", default: true }],
    transform: (input, opts) => {
      const b64 = textToBase64(input);
      return { ok: true, text: opts.dataUri ? `data:text/html;base64,${b64}` : b64 };
    },
  },
  {
    id: "url-to-base64",
    label: "URL → Base64",
    blurb: "Encode a link",
    group: "encode",
    kind: "text-codec",
    icon: Link,
    inputLabel: "URL",
    outputLabel: "Base64",
    placeholder: "https://example.com/path?q=1",
    sample: "https://example.com/path?q=1&lang=en",
    toggles: [{ key: "urlSafe", label: "URL-safe", hint: "Use - and _ instead of + and /" }],
    transform: (input, opts) => {
      const b64 = textToBase64(input.trim());
      return { ok: true, text: opts.urlSafe ? toBase64Url(b64) : b64 };
    },
  },
  {
    id: "hex-to-base64",
    label: "Hex → Base64",
    blurb: "Hexadecimal bytes to Base64",
    group: "encode",
    kind: "text-codec",
    icon: Code2,
    inputLabel: "Hex",
    outputLabel: "Base64",
    placeholder: "48 65 6c 6c 6f",
    sample: "48 65 6c 6c 6f 21",
    toggles: [{ key: "wrap", label: "Wrap 76" }],
    transform: (input, opts) => {
      const b64 = hexToBase64(input);
      return { ok: true, text: opts.wrap ? wrapBase64(b64, 76) : b64 };
    },
  },
  {
    id: "file-to-base64",
    label: "File → Base64",
    blurb: "Any file, any size",
    group: "encode",
    kind: "file-encode",
    icon: File,
    dropHint: "Drop any file here",
  },
  {
    id: "image-to-base64",
    label: "Image → Base64",
    blurb: "PNG / JPEG / GIF / WebP / SVG",
    group: "encode",
    kind: "file-encode",
    icon: Image,
    accept: "image/*",
    dropHint: "Drop an image here",
    dataUriDefault: true,
  },
  {
    id: "pdf-to-base64",
    label: "PDF → Base64",
    blurb: "Inline a PDF document",
    group: "encode",
    kind: "file-encode",
    icon: FilePdf,
    accept: ".pdf,application/pdf",
    dropHint: "Drop a PDF here",
    dataUriDefault: true,
  },
  {
    id: "audio-to-base64",
    label: "Audio → Base64",
    blurb: "MP3 / WAV / OGG / FLAC",
    group: "encode",
    kind: "file-encode",
    icon: Music,
    accept: "audio/*",
    dropHint: "Drop an audio file here",
    dataUriDefault: true,
  },
  {
    id: "video-to-base64",
    label: "Video → Base64",
    blurb: "MP4 / WebM / MOV",
    group: "encode",
    kind: "file-encode",
    icon: Video,
    accept: "video/*",
    dropHint: "Drop a video here",
    dataUriDefault: true,
  },
];

const WORKSPACES = {
  "text-codec": TextCodecTool,
  ascii: AsciiDecodeTool,
  "basic-auth": BasicAuthTool,
  "file-encode": FileToBase64Tool,
  media: Base64ToMediaTool,
};

const DEFAULT_TOOL = "base64-to-text";

// ─── Sidebar group ────────────────────────────────────────────────────────────

function SidebarGroup({ label, accent, tools, activeId, onSelect }) {
  if (tools.length === 0) return null;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 px-2 mb-1">
        <span className={`w-1.5 h-1.5 rounded-full ${accent.bar}`} />
        <span className="text-2xs uppercase tracking-label font-medium text-fg-subtle">
          {label}
        </span>
        <span className="text-2xs font-mono text-fg-subtle ml-auto">
          {tools.length}
        </span>
      </div>
      <div className="space-y-0.5">
        {tools.map((t) => {
          const Icon = t.icon;
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              title={t.blurb}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-control text-left transition ${
                active
                  ? "bg-surface-raised text-fg ring-1 ring-line"
                  : "text-fg-muted hover:bg-surface-raised hover:text-fg"
              }`}
            >
              <Icon
                size={12}
                className={`shrink-0 ${active ? accent.text : "text-fg-subtle"}`}
              />
              <span className="text-xs font-medium truncate flex-1">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────
// Two-pane layout: a persistent tool sidebar on the left, the active
// workspace on the right. Below `md` the sidebar collapses into a native
// <select> so the workspace keeps the full width on phones.

export default function Base64Toolkit({ addToast }) {
  const [activeId, setActiveId] = useState(DEFAULT_TOOL);
  const [visitedIds, setVisitedIds] = useState(() => new Set([DEFAULT_TOOL]));
  const [query, setQuery] = useState("");

  const selectTool = (id) => {
    setActiveId(id);
    setVisitedIds((visited) => {
      if (visited.has(id)) return visited;
      return new Set(visited).add(id);
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOOLS;
    return TOOLS.filter(
      (t) =>
        t.label.toLowerCase().includes(q) || t.blurb.toLowerCase().includes(q),
    );
  }, [query]);

  const decoders = filtered.filter((t) => t.group === "decode");
  const encoders = filtered.filter((t) => t.group === "encode");

  const active = TOOLS.find((t) => t.id === activeId) ?? TOOLS[0];
  const accent = ACCENTS[active.group];
  const ActiveIcon = active.icon;

  return (
    <div className="flex-1 flex overflow-hidden min-w-0">
      {/* ══ Sidebar ══ */}
      <aside className="hidden md:flex flex-col w-[248px] xl:w-[272px] shrink-0 border-r border-line">
        {/* Brand + filter */}
        <div className="shrink-0 p-3 border-b border-line">
          <div className="flex items-center justify-between mb-2.5">
            <h1 className="text-sm font-semibold text-fg">Base64</h1>
            <span className="text-2xs font-mono text-fg-subtle">
              {TOOLS.length} tools
            </span>
          </div>
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter tools…"
              className="w-full pl-7 pr-7 py-1.5 bg-surface border border-line rounded-control text-xs text-fg placeholder-fg-subtle focus:outline-none focus:border-accent"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                title="Clear filter"
                aria-label="Clear filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg transition"
              >
                <Xmark size={11} />
              </button>
            )}
          </div>
        </div>

        {/* Tool list */}
        <nav className="flex-1 overflow-y-auto pane-scroll p-2">
          {filtered.length === 0 ? (
            <p className="text-xs text-fg-subtle italic px-2 py-3">
              No tools match “{query}”.
            </p>
          ) : (
            <>
              <SidebarGroup
                label="Decoders"
                accent={ACCENTS.decode}
                tools={decoders}
                activeId={activeId}
                onSelect={selectTool}
              />
              <SidebarGroup
                label="Encoders"
                accent={ACCENTS.encode}
                tools={encoders}
                activeId={activeId}
                onSelect={selectTool}
              />
            </>
          )}
        </nav>

        <div className="shrink-0 px-3 py-2 border-t border-line">
          <p className="text-2xs text-fg-subtle leading-relaxed">
            Runs entirely in your browser — nothing is uploaded.
          </p>
        </div>
      </aside>

      {/* ══ Workspace ══ */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
        {/* Mobile picker — the sidebar is hidden below md */}
        <div className="md:hidden shrink-0 p-3 border-b border-line">
          <select
            value={activeId}
            onChange={(e) => selectTool(e.target.value)}
            className="w-full bg-surface border border-line rounded-control px-3 py-2 text-sm font-medium text-fg focus:outline-none focus:border-accent"
          >
            <optgroup label="Decoders">
              {TOOLS.filter((t) => t.group === "decode").map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Encoders">
              {TOOLS.filter((t) => t.group === "encode").map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Tool header */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-line">
          <span
            className={`w-8 h-8 rounded-control border flex items-center justify-center shrink-0 ${accent.iconBox}`}
          >
            <ActiveIcon size={14} className={accent.text} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-fg truncate">
                {active.label}
              </h2>
              <span
                className={`text-2xs font-medium uppercase tracking-label px-1.5 py-0.5 rounded-chip border shrink-0 ${accent.chip}`}
              >
                {accent.label.replace(/s$/, "")}
              </span>
            </div>
            <p className="text-2xs text-fg-subtle truncate mt-0.5">
              {active.blurb}
            </p>
          </div>
        </div>

        {/* Tool body */}
        <div className="flex-1 min-h-0 flex flex-col pane-scroll px-5 py-5">
          {TOOLS.filter((tool) => visitedIds.has(tool.id)).map((tool) => {
            const Workspace = WORKSPACES[tool.kind];
            return (
              <div
                key={tool.id}
                className={`flex-1 min-h-0 ${activeId === tool.id ? "" : "hidden"}`}
              >
                <Workspace tool={tool} addToast={addToast} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
