import { useState, useRef, useEffect } from 'react'
import { Copy, Check, ChevronDown } from 'lucide-react'

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
        className={`flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 transition ${className}`}
        title={options[0].label}
      >
        {copiedIdx === 0
          ? <Check size={size} className="text-green-400" />
          : <Copy size={size} />}
      </button>
    )
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/* Split button: left = copy first option, right = open dropdown */}
      <div className="flex items-center rounded-lg border border-white/10 overflow-hidden">
        <button
          onClick={() => doCopy(0)}
          className="flex items-center justify-center px-2 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
          title={options[0].label}
        >
          {copiedIdx === 0
            ? <Check size={size} className="text-green-400" />
            : <Copy size={size} />}
        </button>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-center px-1 py-1.5 bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white border-l border-white/10 transition"
          title="More copy options"
        >
          <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-[#111] border border-white/10 rounded-xl shadow-xl overflow-hidden">
          {options.map((opt, i) => (
            <button
              key={i}
              onClick={() => doCopy(i)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white transition text-left"
            >
              {copiedIdx === i
                ? <Check size={12} className="text-green-400 shrink-0" />
                : <Copy size={12} className="shrink-0 text-gray-500" />}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
