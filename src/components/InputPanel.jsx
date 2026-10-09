import { useRef, useState } from "react";
import { Bolt, Trash, Cookie, Document, Upload } from "reicon-react";

export default function InputPanel({
  value,
  onChange,
  onFormat,
  onClear,
  onHarDrop,
  includeCookie,
  onToggleCookie,
}) {
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
      file.name.endsWith(".har")
        ? onHarDrop(ev.target.result)
        : onChange(ev.target.result);
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      file.name.endsWith(".har")
        ? onHarDrop(ev.target.result)
        : onChange(ev.target.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Textarea — fills all available vertical space */}
      <div
        className={`relative flex-1 rounded-card border transition-colors ${
          dragging ? "border-line bg-surface-raised" : "border-line bg-surface"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {dragging && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 rounded-card bg-surface-raised pointer-events-none">
            <Upload size={22} className="text-fg/50 mb-2" />
            <p className="text-sm text-fg/50">Drop .txt or .har file</p>
          </div>
        )}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full h-full bg-transparent rounded-card p-4 font-mono text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-2 focus:ring-accent/15 resize-none transition leading-relaxed"
          placeholder={
            "Paste curl, PowerShell, or fetch…\nor drop a .txt / .har file\n\n⌘↵  to format"
          }
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* Action bar */}
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onFormat}
          className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium py-2.5 rounded-card transition active:scale-[0.99]"
        >
          <Bolt size={14} />
          Format
        </button>

        {/* Cookie toggle — the knob must contrast with the track. It used to be
            `bg-accent` on a `bg-accent` track, which rendered as a solid violet
            blob with no visible switch when on. */}
        <button
          onClick={onToggleCookie}
          role="switch"
          aria-checked={includeCookie}
          title={
            includeCookie ? "Cookie header included" : "Cookie header excluded"
          }
          className="flex items-center gap-2 px-3 bg-surface-raised border border-line hover:bg-surface-overlay text-fg py-2.5 rounded-card transition"
        >
          <span
            className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${
              includeCookie
                ? "bg-accent"
                : "bg-surface-overlay border border-line"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform ${
                includeCookie ? "bg-white translate-x-4" : "bg-fg-subtle"
              }`}
            />
          </span>
          <Cookie
            size={13}
            className={includeCookie ? "text-fg" : "text-fg-subtle"}
          />
        </button>

        {/* File import */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Import .txt or .har"
          className="px-3 bg-surface-raised border border-line hover:bg-surface-overlay text-fg py-2.5 rounded-card transition"
        >
          <Document size={14} />
        </button>

        {/* Clear */}
        <button
          onClick={onClear}
          title="Clear"
          className="px-3 bg-surface-raised border border-line hover:bg-surface-overlay text-fg hover:text-danger py-2.5 rounded-card transition"
        >
          <Trash size={14} />
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
