import { useState } from "react";
import { Copy, Check } from "lucide-react";

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
      className={`flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition ${className}`}
      title="Copy"
    >
      {copied ? (
        <Check size={size} className="text-green-400" />
      ) : (
        <Copy size={size} />
      )}
    </button>
  );
}
