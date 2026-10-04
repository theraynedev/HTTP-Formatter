import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
}

const COLORS = {
  success: 'border-green-500/30 bg-green-500/10 text-green-400',
  error: 'border-red-500/30 bg-red-500/10 text-red-400',
  info: 'border-white/20 bg-white/5 text-gray-300',
}

function ToastItem({ toast, onRemove }) {
  const Icon = ICONS[toast.type] ?? Info

  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), toast.duration ?? 3500)
    return () => clearTimeout(t)
  }, [toast.id, toast.duration, onRemove])

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm shadow-lg text-sm animate-in ${COLORS[toast.type]}`}
      style={{ animation: 'slideIn 0.2s ease' }}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="shrink-0 opacity-60 hover:opacity-100 transition">
        <X size={14} />
      </button>
    </div>
  )
}

export default function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}
