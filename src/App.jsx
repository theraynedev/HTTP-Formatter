import {
  useState,
  useLayoutEffect,
  useCallback,
  useEffect,
  Fragment,
} from "react";
import {
  Sun,
  Moon,
  TerminalSquare,
  Link,
  History,
  SidebarLeft,
  ShieldCheck,
  ShieldCross,
  Data,
  Archive,
  Code2,
  Fingerprint,
  ArrowLeft,
  ArrowRight,
} from "reicon-react";

import InputPanel from "./components/InputPanel.jsx";
import OutputPanel from "./components/OutputPanel.jsx";
import CodeGenPanel from "./components/CodeGenPanel.jsx";
import RequestTester from "./components/RequestTester.jsx";
import HistoryPanel from "./components/HistoryPanel.jsx";
import ComparePanel from "./components/ComparePanel.jsx";
import JsonUtility from "./components/JsonUtility.jsx";
import HarToolkit from "./components/HarToolkit.jsx";
import Base64Toolkit from "./components/Base64Toolkit.jsx";
import MaskifyTool from "./components/MaskifyTool.jsx";
import UtilityPage, {
  UTILITIES,
  ACCENTS as UTIL_ACCENTS,
} from "./components/utilities/index.jsx";
import ToastContainer from "./components/Toast.jsx";

import { parseRequest, parseHar, reconstructCurl } from "./utils/parser.js";
import {
  saveEntry,
  getHistory,
  getCookiePref,
  setCookiePref,
  getTheme,
  setTheme,
  findDuplicate,
  getRedactPref,
  setRedactPref,
  getNavCollapsed,
  setNavCollapsedPref,
} from "./utils/storage.js";
import {
  buildShareUrl,
  readShareParam,
  clearShareParam,
  hasRedactableContent,
} from "./utils/share.js";
import { parseHarFile, historyEntryToHar } from "./utils/harOps.js";

// ─── Theme ────────────────────────────────────────────────────────────────────
function useTheme() {
  const [theme, setThemeState] = useState(getTheme);
  useLayoutEffect(() => {
    const isDark = theme === "dark";
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  }, [theme]);
  const change = (t) => {
    setThemeState(t);
    setTheme(t);
  };
  return [theme, change];
}

// ─── Toasts ───────────────────────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = "info", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type, duration }]);
  }, []);
  const remove = useCallback(
    (id) => setToasts((p) => p.filter((t) => t.id !== id)),
    [],
  );
  return { toasts, add, remove };
}

// ─── Output sub-tabs ──────────────────────────────────────────────────────────
const OUTPUT_TABS = [
  { id: "output", label: "Output" },
  { id: "codegen", label: "Code / Commands" },
  { id: "tester", label: "Send" },
];

// ─── Nav items ────────────────────────────────────────────────────────────────
// `group` drives the section labels in the rail. The first group ("core") is
// deliberately unlabelled — the brand row already sits directly above it. Every
// entry in UTILITIES is promoted to its own top-level nav item.
const NAV_GROUPS = {
  core: null,
  tokens: UTIL_ACCENTS.tokens.label, // "Tokens & Secrets"
  time: UTIL_ACCENTS.time.label, //     "Time & IDs"
  web: UTIL_ACCENTS.web.label, //       "Web"
  history: null,
};

const NAV = [
  {
    id: "formatter",
    icon: SidebarLeft,
    label: "HTTP Formatter",
    group: "core",
  },
  { id: "json", icon: Data, label: "JSON", group: "core" },
  { id: "har", icon: Archive, label: "HAR Analyzer", group: "core" },
  { id: "base64", icon: Code2, label: "Base64", group: "core" },
  { id: "maskify", icon: Fingerprint, label: "Maskify", group: "core" },
  ...UTILITIES.map((u) => ({
    id: u.id,
    icon: u.icon,
    label: u.navLabel ?? u.label,
    group: u.group,
  })),
  { id: "history", icon: History, label: "History", group: "history" },
];

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [theme, changeTheme] = useTheme();
  const { toasts, add: addToast, remove: removeToast } = useToasts();

  const [page, setPage] = useState("formatter"); // formatter | json | history | compare
  const [outputTab, setOutputTabRaw] = useState("output");
  const [outputTabLoading, setOutputTabLoading] = useState(false);

  const setOutputTab = (next) => {
    if (next === outputTab) return;
    setOutputTabLoading(true);
    setOutputTabRaw(next);
    setTimeout(() => setOutputTabLoading(false), 100);
  };
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState(null);
  const [includeCookie, setIncludeCookie] = useState(getCookiePref);
  const [shareRedact, setShareRedact] = useState(getRedactPref);
  const [history, setHistory] = useState(getHistory);
  const [compareEntries, setCompareEntries] = useState(null);
  const [navCollapsed, setNavCollapsedState] = useState(getNavCollapsed);
  // A saved request handed to the HAR Analyzer ("Send to Analyzer"). Shaped
  // exactly like what HarToolkit's drop zone produces: { parsed, fileMeta }.
  const [harSeed, setHarSeed] = useState(null);

  const refreshHistory = () => setHistory(getHistory());

  const toggleNav = () => {
    const next = !navCollapsed;
    setNavCollapsedState(next);
    setNavCollapsedPref(next);
  };

  // The nav stays wherever the user put it — no page auto-collapses it.
  // (Base64 used to force the rail shut on entry; that's gone by request.)

  // Load ?q= share param on mount
  useEffect(() => {
    const raw = readShareParam();
    if (!raw) return;
    clearShareParam();
    setInput(raw);
    const result = parseRequest(raw, getCookiePref());
    if (result.url) {
      setParsed(result);
      addToast("Loaded shared request.", "success", 3000);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const handleFormat = useCallback(() => {
    const raw = input.trim();
    if (!raw) {
      addToast("Paste a request first.", "error");
      return;
    }
    const result = parseRequest(raw, includeCookie);
    setParsed(result);
    if (result.errors?.length)
      result.errors.forEach((e) => addToast(e, "error"));
    if (result.url) {
      const dupe = findDuplicate(result.method, result.url);
      if (dupe)
        addToast(
          `Already in history: ${dupe.customName ?? dupe.name}`,
          "info",
          4000,
        );
      saveEntry(result);
      refreshHistory();
    }
    setOutputTab("output");
  }, [input, includeCookie, addToast]);

  const handleToggleCookie = () => {
    const next = !includeCookie;
    setIncludeCookie(next);
    setCookiePref(next);
    if (parsed) setParsed(parseRequest(input.trim(), next));
  };

  const handleQueryChange = (newParams, newUrl) => {
    if (!parsed) return;
    setParsed((p) => ({ ...p, queryParams: newParams, url: newUrl }));
  };

  const handleCurlUpdate = (up) => setInput(reconstructCurl(up));

  const handleParsedChange = (up) => {
    setParsed(up);
    setInput(reconstructCurl(up));
  };

  const toggleRedact = () => {
    const next = !shareRedact;
    setShareRedact(next);
    setRedactPref(next);
    addToast(
      next
        ? "Share links will hide Authorization, Cookie and token values."
        : "Warning: share links will include real credentials.",
      next ? "success" : "error",
      4000,
    );
  };

  const handleShare = () => {
    if (!parsed?.url) {
      addToast("Format a request first.", "error");
      return;
    }
    const redacted = shareRedact && hasRedactableContent(parsed);
    navigator.clipboard
      .writeText(buildShareUrl(parsed, { redact: shareRedact }))
      .then(() =>
        addToast(
          redacted
            ? "Share link copied (secrets redacted)."
            : shareRedact
              ? "Share link copied."
              : "Share link copied — includes real credentials.",
          "success",
        ),
      )
      .catch(() => addToast("Copy failed.", "error"));
  };

  const handleHarDrop = (content) => {
    const entries = parseHar(content);
    if (!entries.length) {
      addToast("No requests found in HAR.", "error");
      return;
    }
    entries.forEach((e) => {
      if (e.url) saveEntry(e);
    });
    refreshHistory();
    addToast(
      `Imported ${entries.length} request${entries.length !== 1 ? "s" : ""} from HAR.`,
      "success",
    );
    setPage("history");
  };

  const handleLoadHistory = (entry) => {
    setInput(entry.raw);
    const result = parseRequest(entry.raw, includeCookie);
    setParsed(result);
    setPage("formatter");
    setOutputTab("output");
  };

  // History → HAR Analyzer. History keeps the full request but no response
  // body, so `historyEntryToHar` synthesises a request-only HAR document and we
  // feed it through the Analyzer's own parser — the same entry point a dropped
  // file uses, so the two paths can never drift apart.
  const handleSendToAnalyzer = (entry) => {
    try {
      const doc = historyEntryToHar(entry);
      if (!doc) {
        addToast("Could not convert this entry to a HAR document.", "error");
        return;
      }
      const text = JSON.stringify(doc);
      const result = parseHarFile(text);
      if (!result?.ok) {
        addToast(result?.error ?? "Could not build a HAR document.", "error");
        return;
      }
      setHarSeed({
        parsed: result,
        fileMeta: { name: entry.customName ?? entry.name, size: text.length },
      });
      setPage("har");
      addToast("Sent to HAR Analyzer.", "success", 1600);
    } catch (err) {
      // Never fail silently: a throw here is indistinguishable from a dead
      // button, which is exactly how this was reported.
      addToast(
        `Could not open in the HAR Analyzer — ${err?.message ?? "unknown error"}`,
        "error",
      );
    }
  };

  const handleCompare = (a, b) => {
    setCompareEntries({ a, b });
    setPage("compare");
  };
  const handleClear = () => {
    setInput("");
    setParsed(null);
  };

  const cycleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    changeTheme(next);
    addToast(`Theme: ${next}`, "info", 1500);
  };
  const ThemeIcon = theme === "dark" ? Moon : Sun;

  // ─── Layout ──────────────────────────────────────────────────────────────────
  // Full viewport: nav sidebar (220px ⇄ 48px rail) + body
  return (
    <div className="h-full flex overflow-hidden bg-canvas text-fg antialiased selection:bg-surface-overlay">
      {/* ── Ambient glow (fixed, pointer-none) ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-accent/[0.07] rounded-full blur-[120px]" />
      </div>

      {/* ════════════════════════════════════════════
          NAV SIDEBAR — 220px, collapses to a 48px rail
      ════════════════════════════════════════════ */}
      <aside
        className={`relative z-20 shrink-0 flex flex-col border-r border-line bg-surface transition-[width] duration-150 ${
          navCollapsed ? "w-12" : "w-[220px]"
        }`}
      >
        {/* Brand / workspace switcher */}
        <div
          className={`shrink-0 h-12 flex items-center border-b border-line ${
            navCollapsed ? "justify-center px-0" : "gap-2.5 px-3"
          }`}
        >
          <span className="w-6 h-6 shrink-0 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 40 40"
              fill="none"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M20 0C27.4768 0 31.2154 -0.000204921 34 1.60742C35.8242 2.66064 37.3394 4.17577 38.3926 6C40.0002 8.7846 40 12.5232 40 20C40 27.4768 40.0002 31.2154 38.3926 34C37.3394 35.8242 35.8242 37.3394 34 38.3926C31.2154 40.0002 27.4768 40 20 40C12.5232 40 8.7846 40.0002 6 38.3926C4.17577 37.3394 2.66064 35.8242 1.60742 34C-0.000204921 31.2154 0 27.4768 0 20C0 12.5232 -0.000204921 8.7846 1.60742 6C2.66064 4.17577 4.17577 2.66064 6 1.60742C8.7846 -0.000204921 12.5232 0 20 0ZM22 4C13.1634 4 6 11.1634 6 20C6 28.8366 13.1634 36 22 36C30.8366 36 38 28.8366 38 20C38 11.1634 30.8366 4 22 4Z"
                fill="#FF4D00"
              />
              <path
                d="M36 20C36 25.5228 31.5228 30 26 30C20.4772 30 16 25.5228 16 20C16 14.4772 20.4772 10 26 10C31.5228 10 36 14.4772 36 20Z"
                fill="#FF4D00"
              />
            </svg>
          </span>
          {!navCollapsed && (
            <span className="text-sm font-semibold tracking-tight truncate">
              DevOrbit
            </span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 min-h-0 pane-scroll px-2 py-2 space-y-0.5">
          {NAV.map((n, i) => {
            const Icon = n.icon;
            const active =
              page === n.id || (page === "compare" && n.id === "history");
            const prev = i > 0 ? NAV[i - 1] : null;
            const newGroup = prev && prev.group !== n.group;
            const label = NAV_GROUPS[n.group];
            return (
              <Fragment key={n.id}>
                {newGroup &&
                  (navCollapsed ? (
                    <div className="h-px bg-line mx-1.5 my-2" />
                  ) : label ? (
                    <div className="px-2.5 pt-3 pb-1 text-2xs uppercase tracking-label font-medium text-fg-subtle">
                      {label}
                    </div>
                  ) : (
                    <div className="border-t border-line mx-2.5 my-2" />
                  ))}
                <button
                  onClick={() => {
                    setPage(n.id);
                    if (n.id !== "history") setCompareEntries(null);
                  }}
                  title={navCollapsed ? n.label : undefined}
                  className={`w-full h-8 flex items-center rounded-card text-sm font-medium transition ${
                    navCollapsed ? "justify-center" : "gap-2.5 px-2.5"
                  } ${
                    active
                      ? "bg-accent/10 text-fg"
                      : "text-fg-subtle hover:bg-surface-raised hover:text-fg"
                  }`}
                >
                  <Icon
                    size={14}
                    className={`shrink-0 ${active ? "text-accent-text" : ""}`}
                  />
                  {!navCollapsed && (
                    <>
                      <span className="truncate">{n.label}</span>
                      {n.id === "history" && history.length > 0 && (
                        <span className="ml-auto shrink-0 text-2xs tabular-nums text-fg-subtle bg-surface-raised rounded-full px-1.5 py-0.5 leading-none">
                          {history.length}
                        </span>
                      )}
                    </>
                  )}
                </button>
              </Fragment>
            );
          })}
        </nav>

        {/* Footer actions */}
        <div
          className={`shrink-0 border-t border-line p-2 flex gap-1 ${
            navCollapsed ? "flex-col items-center" : "items-center"
          }`}
        >
          <button
            onClick={toggleRedact}
            title={
              shareRedact
                ? "Share links hide secrets — click to include them"
                : "Share links include real credentials — click to redact"
            }
            className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-control border transition ${
              shareRedact
                ? "border-success/30 bg-success/10 text-success hover:bg-success/20"
                : "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
            }`}
          >
            {shareRedact ? (
              <ShieldCheck size={14} />
            ) : (
              <ShieldCross size={14} />
            )}
          </button>
          <button
            onClick={handleShare}
            title="Copy share link"
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-control border border-line bg-surface-raised hover:bg-surface-overlay text-fg hover:text-fg transition"
          >
            <Link size={14} />
          </button>
          <button
            onClick={cycleTheme}
            title="Toggle theme"
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-control border border-line bg-surface-raised hover:bg-surface-overlay text-fg hover:text-fg transition"
          >
            <ThemeIcon size={14} />
          </button>
          {!navCollapsed && <div className="flex-1" />}
          <button
            onClick={toggleNav}
            title={navCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-control text-fg-subtle hover:bg-surface-raised hover:text-fg transition"
          >
            {navCollapsed ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          BODY  (fills all remaining width)
      ════════════════════════════════════════════ */}
      <main className="relative z-10 flex-1 flex overflow-hidden min-w-0">
        {/* ── FORMATTER page: two-pane split ──
            Below `lg` the panes stack: a fixed 420px input column next to the
            output pushed the output pane completely out of a 390px viewport
            (the shell clips it, so it was unreachable). Column-first keeps the
            desktop layout byte-for-byte and makes the narrow one usable. */}
        {page === "formatter" && (
          <div className="flex-1 flex flex-col lg:flex-row min-w-0 min-h-0 overflow-hidden">
            {/* ── Left pane: input ── */}
            <div className="flex flex-col shrink-0 h-[42%] lg:h-auto w-full lg:w-[420px] min-h-0 border-b lg:border-b-0 lg:border-r border-line p-4">
              <InputPanel
                value={input}
                onChange={setInput}
                onFormat={handleFormat}
                onClear={handleClear}
                onHarDrop={handleHarDrop}
                includeCookie={includeCookie}
                onToggleCookie={handleToggleCookie}
              />
            </div>

            {/* ── Right pane: output tabs ── */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
              {!parsed ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
                  <div className="w-12 h-12 rounded-panel bg-surface-raised border border-line flex items-center justify-center">
                    <TerminalSquare size={20} className="text-fg-subtle" />
                  </div>
                  <p className="text-sm text-fg-subtle max-w-xs leading-relaxed">
                    Paste a curl, PowerShell, or fetch command on the left and
                    hit <span className="text-fg-subtle">Format</span>.
                  </p>
                </div>
              ) : (
                <>
                  {/* Sub-tab bar */}
                  <div className="shrink-0 flex items-center gap-1 px-4 pt-3 pb-0 border-b border-line overflow-x-auto">
                    {OUTPUT_TABS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setOutputTab(t.id)}
                        className={`shrink-0 px-3 py-2 text-xs font-semibold transition border-b-2 -mb-px ${
                          outputTab === t.id
                            ? "text-fg border-fg"
                            : "text-fg-subtle border-transparent hover:text-fg hover:border-line-strong"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="flex-1 min-h-0 pane-scroll px-4 py-4">
                    {outputTabLoading ? (
                      <div className="space-y-3 pt-1">
                        {[70, 50, 85, 60, 75, 45].map((w, i) => (
                          <div
                            key={i}
                            className="h-3 rounded bg-surface-raised animate-pulse"
                            style={{ width: `${w}%` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <>
                        <div
                          style={{
                            display: outputTab === "output" ? "block" : "none",
                          }}
                        >
                          <OutputPanel
                            parsed={parsed}
                            onQueryChange={handleQueryChange}
                            onCurlUpdate={handleCurlUpdate}
                            onParsedChange={handleParsedChange}
                          />
                        </div>
                        <div
                          style={{
                            display: outputTab === "codegen" ? "block" : "none",
                          }}
                        >
                          <CodeGenPanel parsed={parsed} />
                        </div>
                        <div
                          style={{
                            display: outputTab === "tester" ? "block" : "none",
                          }}
                        >
                          <RequestTester parsed={parsed} />
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── JSON UTILITY page ── */}
        {page === "json" && (
          <div className="flex-1 pane-scroll px-4 sm:px-6 py-5 w-full">
            <JsonUtility addToast={addToast} />
          </div>
        )}

        {/* ── HAR ANALYZER page ── */}
        {page === "har" && (
          <div className="flex-1 pane-scroll px-4 sm:px-6 py-5 w-full">
            <HarToolkit
              addToast={addToast}
              seed={harSeed}
              onSeedConsumed={() => setHarSeed(null)}
            />
          </div>
        )}

        {/* ── BASE64 TOOLKIT page — owns its own sidebar + workspace layout ── */}
        {page === "base64" && <Base64Toolkit addToast={addToast} />}

        {/* ── MASKIFY page — string → ?d/?l/?u mask pattern ── */}
        {page === "maskify" && (
          <div className="flex-1 pane-scroll px-4 sm:px-6 py-5 w-full">
            <MaskifyTool />
          </div>
        )}

        {/* ── UTILITY pages — each promoted to its own nav entry ── */}
        {UTILITIES.map(
          (u) => page === u.id && <UtilityPage key={u.id} id={u.id} />,
        )}

        {/* ── HISTORY page ── */}
        {page === "history" && !compareEntries && (
          <div className="flex-1 pane-scroll px-6 py-5 max-w-6xl w-full mx-auto">
            <HistoryPanel
              history={history}
              onLoad={handleLoadHistory}
              onSendToAnalyzer={handleSendToAnalyzer}
              onHistoryChange={(msg) => {
                refreshHistory();
                if (msg) addToast(msg, "success");
              }}
              onCompare={handleCompare}
            />
          </div>
        )}

        {/* ── COMPARE page ── */}
        {(page === "compare" || (page === "history" && compareEntries)) &&
          compareEntries && (
            <div className="flex-1 pane-scroll px-6 py-5 max-w-3xl w-full mx-auto">
              <ComparePanel
                a={compareEntries.a}
                b={compareEntries.b}
                onBack={() => {
                  setCompareEntries(null);
                  setPage("history");
                }}
              />
            </div>
          )}
      </main>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
