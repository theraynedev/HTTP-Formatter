import { Clock, EyeOff, Fingerprint, Hashtag, Key, Link, ShieldCheck } from "reicon-react";

import { REDACT_DESCRIPTION } from "../../utils/redactOps.js";
import { URL_DESCRIPTION } from "../../utils/urlOps.js";
import { HASHID_DESCRIPTION } from "../../utils/hashIdOps.js";
import { UUID_DESCRIPTION } from "../../utils/uuidOps.js";
import { TIME_DESCRIPTION } from "../../utils/timeOps.js";
import { SECHEADERS_DESCRIPTION } from "../../utils/secHeadersOps.js";
import { JWT_DESCRIPTION } from "../../utils/jwt.js";

import JwtTool from "./JwtTool.jsx";
import ApiKeyTool from "./ApiKeyTool.jsx";
import HashIdTool from "./HashIdTool.jsx";
import TimestampTool from "./TimestampTool.jsx";
import UuidTool from "./UuidTool.jsx";
import UrlTool from "./UrlTool.jsx";
import SecHeadersTool from "./SecHeadersTool.jsx";

// ─── Utilities registry ───────────────────────────────────────────────────────
// Every developer utility that doesn't belong to an existing tab. Each one is
// promoted to its own entry in the main nav, so this module is the single source
// of truth for both the nav list (App.jsx) and the page bodies (UtilityPage).
//
// The Base64 tab already owns the encoding codecs and the Formatter owns
// cURL → code, so nothing here duplicates those.

export const ACCENTS = {
  tokens: {
    label: "Tokens & Secrets",
    text: "text-accent-text",
    iconBox: "border-accent/30 bg-accent/10",
    chip: "border-accent/30 bg-accent/10 text-accent-text",
    dot: "bg-accent/60",
  },
  time: {
    label: "Time & IDs",
    text: "text-info",
    iconBox: "border-info/30 bg-info/10",
    chip: "border-info/30 bg-info/10 text-info",
    dot: "bg-info/50",
  },
  web: {
    label: "Web",
    text: "text-mutation",
    iconBox: "border-mutation/30 bg-mutation/10",
    chip: "border-mutation/30 bg-mutation/10 text-mutation",
    dot: "bg-mutation/50",
  },
};

export const UTILITIES = [
  {
    id: "jwt",
    label: "JWT",
    description: JWT_DESCRIPTION,
    group: "tokens",
    icon: Key,
    Panel: JwtTool,
  },
  {
    id: "api-key",
    label: "API Key Masker",
    description: REDACT_DESCRIPTION,
    group: "tokens",
    icon: EyeOff,
    Panel: ApiKeyTool,
  },
  {
    id: "hash-id",
    label: "Hash Identifier",
    description: HASHID_DESCRIPTION,
    group: "tokens",
    icon: Hashtag,
    Panel: HashIdTool,
  },
  {
    id: "timestamp",
    label: "Timestamp",
    description: TIME_DESCRIPTION,
    group: "time",
    icon: Clock,
    Panel: TimestampTool,
  },
  {
    id: "uuid",
    label: "UUID",
    description: UUID_DESCRIPTION,
    group: "time",
    icon: Fingerprint,
    Panel: UuidTool,
  },
  {
    id: "url",
    label: "URL Encode / Decode",
    // The full label is too long for the 220px rail; the header shows it in full.
    navLabel: "URL Codec",
    description: URL_DESCRIPTION,
    group: "web",
    icon: Link,
    Panel: UrlTool,
  },
  {
    id: "sec-headers",
    label: "Security Headers",
    description: SECHEADERS_DESCRIPTION,
    group: "web",
    icon: ShieldCheck,
    Panel: SecHeadersTool,
  },
];

export const findUtility = (id) => UTILITIES.find((u) => u.id === id) ?? null;

// ─── Page shell ───────────────────────────────────────────────────────────────
// A header strip (icon + name + group chip + one-line description) above the
// tool body. The body owns the scrolling, matching the Base64 workspace pane.

export default function UtilityPage({ id }) {
  const tool = findUtility(id);
  if (!tool) return null;

  const accent = ACCENTS[tool.group];
  const Icon = tool.icon;
  const Panel = tool.Panel;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <header className="shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3.5 border-b border-line">
        <span
          className={`w-8 h-8 rounded-control border flex items-center justify-center shrink-0 ${accent.iconBox}`}
        >
          <Icon size={14} className={accent.text} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-fg truncate">{tool.label}</h2>
            <span
              className={`text-2xs font-medium uppercase tracking-label px-1.5 py-0.5 rounded-chip border shrink-0 ${accent.chip}`}
            >
              {accent.label}
            </span>
          </div>
          <p className="text-2xs text-fg-subtle truncate mt-0.5">{tool.description}</p>
        </div>
      </header>

      <div className="flex-1 pane-scroll px-4 sm:px-6 py-5 w-full">
        <Panel />
      </div>
    </div>
  );
}
