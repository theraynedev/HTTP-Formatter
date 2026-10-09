import { useState } from "react";
import { Copy3, Check } from "reicon-react";

export default function CopyButton({ getText, size = 16, className = "" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const text = typeof getText === "function" ? getText() : getText;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center justify-center rounded-control bg-surface-raised hover:bg-surface-overlay text-fg-muted hover:text-fg border border-line transition ${className}`}
      title="Copy"
    >
      {copied ? (
        <Check size={size} className="text-success" />
      ) : (
        <Copy3 size={size} />
      )}
    </button>
  );
}
