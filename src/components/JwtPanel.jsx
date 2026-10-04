import { useState, useEffect } from 'react'
import { ShieldCheck, ShieldX, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { decodeJwt, formatDuration, extractAuthHeader } from '../utils/jwt.js'
import { highlightJson } from '../utils/highlight.js'
import CopyButton from './CopyButton.jsx'

export default function JwtPanel({ headers }) {
  const [open, setOpen] = useState(false)
  const [tick, setTick] = useState(0)

  const authValue = extractAuthHeader(headers)
  const isBearer = authValue && /^bearer\s+/i.test(authValue)

  // Tick every second when panel is open to update countdown
  useEffect(() => {
    if (!open || !isBearer) return
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [open, isBearer])

  if (!authValue || !isBearer) return null

  const decoded = decodeJwt(authValue)
  if (!decoded) return null

  const { header, payload, expiryStatus, secondsLeft, expiresAt, issuedAt } = decoded

  const statusColor = expiryStatus === 'expired'
    ? 'text-red-400 border-red-500/30 bg-red-500/5'
    : expiryStatus === 'valid'
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5'
      : 'text-gray-400 border-white/10 bg-white/5'

  const StatusIcon = expiryStatus === 'expired' ? ShieldX : ShieldCheck

  return (
    <section className="mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition ${statusColor}`}
      >
        <StatusIcon size={15} className="shrink-0" />
        <span className="flex-1 text-left">JWT Token detected</span>
        {expiryStatus !== 'none' && (
          <span className="text-xs font-mono opacity-80">
            {expiryStatus === 'expired' ? 'Expired' : formatDuration(secondsLeft)}
          </span>
        )}
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          {/* Meta row */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
            {issuedAt && <span>Issued: <span className="text-gray-300">{issuedAt}</span></span>}
            {expiresAt && <span>Expires: <span className={expiryStatus === 'expired' ? 'text-red-400' : 'text-gray-300'}>{expiresAt}</span></span>}
            {expiryStatus === 'valid' && secondsLeft !== null && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                <span className="text-emerald-400">{formatDuration(secondsLeft)} remaining</span>
              </span>
            )}
            {decoded.header.alg && (
              <span>Alg: <span className="text-gray-300 font-mono">{decoded.header.alg}</span></span>
            )}
          </div>

          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-600">Header</p>
              <span className="flex-1 h-px bg-white/5" />
              <CopyButton getText={() => JSON.stringify(header, null, 2)} size={12} className="w-5 h-5" />
            </div>
            <pre
              className="text-xs font-mono bg-white/[0.02] border border-white/5 rounded-lg p-3 whitespace-pre-wrap leading-5"
              dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(header)) }}
            />
          </div>

          {/* Payload */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-600">Payload</p>
              <span className="flex-1 h-px bg-white/5" />
              <CopyButton getText={() => JSON.stringify(payload, null, 2)} size={12} className="w-5 h-5" />
            </div>
            <pre
              className="text-xs font-mono bg-white/[0.02] border border-white/5 rounded-lg p-3 whitespace-pre-wrap leading-5 max-h-60 overflow-auto"
              dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(payload)) }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
