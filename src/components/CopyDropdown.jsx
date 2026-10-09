import { useState, useRef, useEffect } from 'react'
import { Copy3, Check, ChevronDown } from 'reicon-react'

// A copy button that optionally opens a dropdown of copy formats
// props:
//   options: [{ label, getText }]   — if only 1 option, renders a plain button
//   size?: number
//   className?: string
export default function CopyDropdown({ options = [], size = 14, className = '' }) {
  const [open, setOpen] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const doCopy = async (idx) => {
    try {
      const text = options[idx].getText()
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 1500)
      setOpen(false)
    } catch (_) {}
  }

  if (options.length === 0) return null

  // Single option → plain copy button
  if (options.length === 1) {
    return (
      <button
        onClick={() => doCopy(0)}
        className={`flex items-center justify-center rounded-control bg-surface-raised hover:bg-surface-overlay text-fg-muted hover:text-fg border border-line transition ${className}`}
        title={options[0].label}
      >
        {copiedIdx === 0
          ? <Check size={size} className="text-success" />
          : <Copy3 size={size} />}
      </button>
    )
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/* Split button: left = copy first option, right = open dropdown */}
      <div className="flex items-center rounded-control border border-line overflow-hidden">
        <button
          onClick={() => doCopy(0)}
          className="flex items-center justify-center px-2 py-1.5 bg-surface-raised hover:bg-surface-overlay text-fg-muted hover:text-fg transition"
          title={options[0].label}
        >
          {copiedIdx === 0
            ? <Check size={size} className="text-success" />
            : <Copy3 size={size} />}
        </button>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-center px-1 py-1.5 bg-surface-raised hover:bg-surface-overlay text-fg-subtle hover:text-fg border-l border-line transition"
          title="More copy options"
        >
          <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-surface-overlay border border-line rounded-card shadow-pop overflow-hidden">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => doCopy(i)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-fg hover:bg-surface-overlay hover:text-fg transition text-left"
            >
              {copiedIdx === i
                ? <Check size={12} className="text-success shrink-0" />
                : <Copy3 size={12} className="shrink-0 text-fg-subtle" />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
