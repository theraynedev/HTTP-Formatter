import { useRef, useState } from "react";
import { Zap, Trash2, Cookie, Upload, FileText } from "lucide-react";

export default function InputPanel({
  value,
  onChange,
  onFormat,
  onClear,
  onHarDrop,
  includeCookie,
  onToggleCookie,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      onFormat();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      if (file.name.endsWith(".har")) {
        onHarDrop(content);
      } else {
        onChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      if (file.name.endsWith(".har")) {
        onHarDrop(content);
      } else {
        onChange(content);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Textarea */}
      <div
        className={`relative rounded-xl border transition-colors ${
          dragging
            ? "border-white/40 bg-white/10"
            : "border-white/10 bg-white/[0.03]"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {dragging && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-xl bg-white/5 pointer-events-none">
            <Upload size={24} className="text-white/60 mb-2" />
            <p className="text-sm text-white/60">Drop .txt or .har file</p>
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={9}
          className="w-full bg-transparent rounded-xl p-4 font-mono text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-white/20 resize-y transition"
          placeholder="Paste a curl, PowerShell, or fetch command here… or drop a .txt/.har file"
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={onFormat}
          className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-black font-semibold py-3 rounded-xl transition active:scale-[0.99]"
        >
          <Zap size={16} />
          Format Request
        </button>

        {/* Cookie toggle */}
        <button
          onClick={onToggleCookie}
          title={
            includeCookie ? "Cookie header included" : "Cookie header excluded"
          }
          className="flex items-center gap-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 font-medium py-3 rounded-xl transition"
        >
          <span
            className={`relative w-9 h-5 rounded-full transition-colors ${includeCookie ? "bg-white" : "bg-white/20"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${includeCookie ? "bg-black translate-x-4" : "bg-white"}`}
            />
          </span>
          <Cookie size={14} />
        </button>

        {/* File import */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Import .txt or .har file"
          className="px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 py-3 rounded-xl transition"
        >
          <FileText size={16} />
        </button>

        {/* Clear */}
        <button
          onClick={onClear}
          title="Clear input"
          className="px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 py-3 rounded-xl transition"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.har"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
