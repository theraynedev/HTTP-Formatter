import { useState } from "react";
import { CATEGORIES } from "../utils/codegen.js";
import CopyButton from "./CopyButton.jsx";

const CATEGORY_COLORS = {
  code: "text-info border-info/30 bg-info/10",
  attack: "text-danger border-danger/30 bg-danger/10",
  recon: "text-accent-text border-accent/30 bg-accent/10",
};

export default function CodeGenPanel({ parsed }) {
  const [selected, setSelected] = useState("fetch");

  if (!parsed) {
    return (
      <div className="text-center text-fg-subtle py-12 text-sm">
        Format a request first to generate code or commands.
      </div>
    );
  }

  // Find the selected item across all categories
  const allItems = CATEGORIES.flatMap((c) => c.items);
  const item = allItems.find((l) => l.id === selected) ?? allItems[0];
  const code = item.gen(parsed);

  return (
    <div className="space-y-5">
      {/* Category groups */}
      {CATEGORIES.map((cat) => (
        <div key={cat.id}>
          {/* Category header */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`text-2xs font-medium tracking-label uppercase px-2 py-0.5 rounded-chip border ${CATEGORY_COLORS[cat.id] ?? "text-fg-muted border-line bg-surface-raised"}`}
            >
              {cat.label}
            </span>
            <span className="flex-1 h-px bg-surface" />
          </div>
          {/* Item buttons */}
          <div className="flex flex-wrap gap-1.5">
            {cat.items.map((l) => (
              <button
                key={l.id}
                onClick={() => setSelected(l.id)}
                className={`text-xs px-3 py-1.5 rounded-control border font-medium transition ${
                  selected === l.id
                    ? "border-line bg-surface-overlay text-fg"
                    : "border-line bg-surface-raised text-fg-muted hover:text-fg hover:border-line-strong"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Code block */}
      <div className="relative">
        {/* Header bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-fg-subtle font-mono">{item.label}</span>
          <span className="text-2xs text-fg-subtle border border-line px-1.5 py-0.5 rounded-chip font-mono">
            {item.lang}
          </span>
          <span className="flex-1" />
          <CopyButton getText={() => code} size={14} className="w-7 h-7" />
        </div>
        <pre className="bg-surface border border-line rounded-card p-4 text-xs font-mono text-fg overflow-auto max-h-[500px] whitespace-pre leading-5">
          {code}
        </pre>
      </div>
    </div>
  );
}
