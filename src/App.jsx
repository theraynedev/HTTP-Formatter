import { useState, useLayoutEffect, useCallback } from "react";
import { Sun, Moon, Terminal } from "lucide-react";

import InputPanel from "./components/InputPanel.jsx";
import OutputPanel from "./components/OutputPanel.jsx";
import CodeGenPanel from "./components/CodeGenPanel.jsx";
import RequestTester from "./components/RequestTester.jsx";
import HistoryPanel from "./components/HistoryPanel.jsx";
import ComparePanel from "./components/ComparePanel.jsx";
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
} from "./utils/storage.js";

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

// ─── Toast hook ───────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = "info", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);
  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  return { toasts, add, remove };
}

// ─── Tabs definition ──────────────────────────────────────────────────────────

const FORMATTER_TABS = [
  { id: "output", label: "Output" },
  { id: "codegen", label: "Code Gen" },
  { id: "tester", label: "Send" },
];

const MAIN_TABS = [
  { id: "formatter", label: "Formatter" },
  { id: "history", label: "History" },
];

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [theme, changeTheme] = useTheme();
  const { toasts, add: addToast, remove: removeToast } = useToasts();

  // Main tab
  const [mainTab, setMainTab] = useState("formatter");

  // Formatter sub-tab
  const [formatterTab, setFormatterTab] = useState("output");

  // Input
  const [input, setInput] = useState("");

  // Parsed result
  const [parsed, setParsed] = useState(null);
  const [errors, setErrors] = useState([]);

  // Cookie toggle
  const [includeCookie, setIncludeCookie] = useState(getCookiePref);

  // History
  const [history, setHistory] = useState(getHistory);
  const refreshHistory = () => setHistory(getHistory());

  // Compare mode
  const [compareEntries, setCompareEntries] = useState(null); // {a, b}

  // ─── Format ─────────────────────────────────────────────────────────────────
  const handleFormat = useCallback(() => {
    const raw = input.trim();
    if (!raw) {
      addToast("Paste a request first.", "error");
      return;
    }
    const result = parseRequest(raw, includeCookie);
    setParsed(result);
    setErrors(result.errors ?? []);

    if (result.errors?.length) {
      result.errors.forEach((e) => addToast(e, "error"));
    }

    if (result.url) {
      // Duplicate detection
      const dupe = findDuplicate(result.method, result.url);
      if (dupe) {
        addToast(
          `Already in history: ${dupe.customName ?? dupe.name} (${new Date(dupe.timestamp).toLocaleDateString()})`,
          "info",
          4000,
        );
      }
      saveEntry(result);
      refreshHistory();
    }
  }, [input, includeCookie, addToast]);

  // Re-run parse when cookie pref changes while output is visible
  const handleToggleCookie = () => {
    const next = !includeCookie;
    setIncludeCookie(next);
    setCookiePref(next);
    if (parsed) {
      const result = parseRequest(input.trim(), next);
      setParsed(result);
    }
  };

  // ─── Query param updates from OutputPanel ────────────────────────────────────
  const handleQueryChange = (newParams, newUrl) => {
    if (!parsed) return;
    setParsed((prev) => ({ ...prev, queryParams: newParams, url: newUrl }));
  };

  // ─── Curl reconstruction from param edits ────────────────────────────────────
  // When the user edits query params, sync the textarea so it stays accurate
  const handleCurlUpdate = (updatedParsed) => {
    const reconstructed = reconstructCurl(updatedParsed);
    setInput(reconstructed);
  };

  // ─── HAR import ──────────────────────────────────────────────────────────────
  const handleHarDrop = (content) => {
    const entries = parseHar(content);
    if (!entries.length) {
      addToast("No valid requests found in HAR file.", "error");
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
    setMainTab("history");
  };

  // ─── Load from history ───────────────────────────────────────────────────────
  const handleLoadHistory = (entry) => {
    setInput(entry.raw);
    const result = parseRequest(entry.raw, includeCookie);
    setParsed(result);
    setErrors(result.errors ?? []);
    setMainTab("formatter");
    setFormatterTab("output");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Compare ─────────────────────────────────────────────────────────────────
  const handleCompare = (a, b) => {
    setCompareEntries({ a, b });
    setMainTab("compare");
  };

  // ─── Clear ───────────────────────────────────────────────────────────────────
  const handleClear = () => {
    setInput("");
    setParsed(null);
    setErrors([]);
  };

  // ─── Theme icon ──────────────────────────────────────────────────────────────
  const cycleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    changeTheme(next);
    addToast(`Theme: ${next}`, "info", 1800);
  };
  const ThemeIcon = theme === "dark" ? Moon : Sun;
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <div className="min-h-screen bg-black text-white antialiased selection:bg-white/20 transition-colors">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[640px] h-[640px] bg-white/[0.05] rounded-full blur-[160px]" />
      </div>

      <div className="relative max-w-3xl mx-auto px-6 py-12">
        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-10">
          <div className="text-center flex-1">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-white/5 text-[11px] font-mono tracking-[0.2em] uppercase text-gray-400 mb-4">
              <Terminal size={10} />
              HTTP Tools
            </span>
            <h1 className="text-4xl font-bold tracking-tight">
              HTTP <span className="text-gray-500">Formatter</span>
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              Paste a request, beautify it, and copy each part.
            </p>
          </div>

          {/* Theme toggle */}
          <button
            onClick={cycleTheme}
            className="mt-1 p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
            title={`Switch to ${nextTheme} mode`}
            aria-label={`Switch to ${nextTheme} mode`}
          >
            <ThemeIcon size={16} />
          </button>
        </div>

        {/* ── Main tabs ── */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur">
            {MAIN_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setMainTab(t.id);
                  if (t.id === "history") setCompareEntries(null);
                }}
                className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${
                  mainTab === t.id && mainTab !== "compare"
                    ? "bg-white text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {t.label}
                {t.id === "history" && history.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">
                    {history.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Formatter view ── */}
        {mainTab === "formatter" && (
          <div>
            <InputPanel
              value={input}
              onChange={setInput}
              onFormat={handleFormat}
              onClear={handleClear}
              onHarDrop={handleHarDrop}
              includeCookie={includeCookie}
              onToggleCookie={handleToggleCookie}
            />

            {parsed && (
              <div className="mt-8">
                {/* Formatter sub-tabs */}
                <div className="flex gap-1 mb-6 p-1 rounded-xl bg-white/5 border border-white/10 w-full">
                  {FORMATTER_TABS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setFormatterTab(t.id)}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                        formatterTab === t.id
                          ? "bg-white text-black"
                          : "text-gray-400 hover:text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {formatterTab === "output" && (
                  <OutputPanel
                    parsed={parsed}
                    onQueryChange={handleQueryChange}
                    onCurlUpdate={handleCurlUpdate}
                  />
                )}
                {formatterTab === "codegen" && <CodeGenPanel parsed={parsed} />}
                {formatterTab === "tester" && <RequestTester parsed={parsed} />}
              </div>
            )}
          </div>
        )}

        {/* ── History view ── */}
        {mainTab === "history" && !compareEntries && (
          <HistoryPanel
            history={history}
            onLoad={handleLoadHistory}
            onHistoryChange={(msg) => {
              refreshHistory();
              if (msg) addToast(msg, "success");
            }}
            onCompare={handleCompare}
          />
        )}

        {/* ── Compare view ── */}
        {mainTab === "compare" && compareEntries && (
          <ComparePanel
            a={compareEntries.a}
            b={compareEntries.b}
            onBack={() => {
              setMainTab("history");
              setCompareEntries(null);
            }}
          />
        )}
        {mainTab === "history" && compareEntries && (
          <ComparePanel
            a={compareEntries.a}
            b={compareEntries.b}
            onBack={() => setCompareEntries(null)}
          />
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
