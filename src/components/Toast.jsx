import { useEffect, useState } from 'react'
import { Xmark, CheckCircle, AlertCircle, InfoCircle } from 'reicon-react'

const ICONS = {
  success: CheckCircle,
  error: AlertCircle,
  info: InfoCircle,
}

const COLORS = {
  success: 'border-success/30 bg-success/10 text-success',
  error: 'border-danger/30 bg-danger/10 text-danger',
  info: 'border-line bg-surface-raised text-fg',
}

function ToastItem({ toast, onRemove }) {
  const Icon = ICONS[toast.type] ?? InfoCircle

  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), toast.duration ?? 3500)
    return () => clearTimeout(t)
  }, [toast.id, toast.duration, onRemove])

  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-card border backdrop-blur-sm shadow-pop text-sm animate-in ${COLORS[toast.type]}`}
      style={{ animation: 'slideIn 0.2s ease' }}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <span className="flex-1">{toast.message}</span>
      <button onClick={() => onRemove(toast.id)} className="shrink-0 opacity-60 hover:opacity-100 transition">
        <Xmark size={14} />
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
