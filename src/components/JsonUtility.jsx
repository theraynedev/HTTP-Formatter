import { useState } from "react";
import PathfinderPanel from "./json/PathfinderPanel.jsx";
import ExtractorPanel from "./json/ExtractorPanel.jsx";

const TABS = [
  { id: "pathfinder", label: "JSON Pathfinder" },
  { id: "extractor", label: "JSON Extractor" },
];

export default function JsonUtility({ addToast }) {
  const [tab, setTabRaw] = useState("pathfinder");
  const [tabLoading, setTabLoading] = useState(false);

  const setTab = (next) => {
    if (next === tab) return;
    setTabLoading(true);
    setTabRaw(next);
    setTimeout(() => setTabLoading(false), 100);
  };

  return (
    <div className="space-y-5">
      {/* ── Sub-tab bar ── */}
      <div className="flex items-center gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold transition border-b-2 -mb-px ${
              tab === t.id
                ? "text-fg border-fg"
                : "text-fg-subtle border-transparent hover:text-fg hover:border-line-strong"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabLoading ? (
        <div className="space-y-3 pt-1">
          {[75, 55, 90, 65, 80, 50].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded bg-surface-raised animate-pulse"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      ) : (
        <div>
          <div style={{ display: tab === "pathfinder" ? "block" : "none" }}>
            <PathfinderPanel addToast={addToast} />
          </div>
          <div style={{ display: tab === "extractor" ? "block" : "none" }}>
            <ExtractorPanel addToast={addToast} />
          </div>
        </div>
      )}
    </div>
  );
}
