import { useState, useEffect } from 'react'
import { ShieldCheck, ShieldCross, Clock, ChevronDown, ChevronUp } from 'reicon-react'
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
    ? 'text-danger border-danger/30 bg-danger/5'
    : expiryStatus === 'valid'
      ? 'text-success border-success/30 bg-success/5'
      : 'text-fg-muted border-line bg-surface-raised'

  const StatusIcon = expiryStatus === 'expired' ? ShieldCross : ShieldCheck

  return (
    <section className="mt-2">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 rounded-card border text-sm font-medium transition ${statusColor}`}
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
        <div className="mt-2 space-y-3 p-4 rounded-card border border-line bg-surface">
          {/* Meta row */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-fg-subtle">
            {issuedAt && <span>Issued: <span className="text-fg">{issuedAt}</span></span>}
            {expiresAt && <span>Expires: <span className={expiryStatus === 'expired' ? 'text-danger' : 'text-fg'}>{expiresAt}</span></span>}
            {expiryStatus === 'valid' && secondsLeft !== null && (
              <span className="flex items-center gap-1">
                <Clock size={11} />
                <span className="text-success">{formatDuration(secondsLeft)} remaining</span>
              </span>
            )}
            {decoded.header.alg && (
              <span>Alg: <span className="text-fg font-mono">{decoded.header.alg}</span></span>
            )}
          </div>

          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-2xs uppercase tracking-label text-fg-subtle">Header</p>
              <span className="flex-1 h-px bg-surface-raised" />
              <CopyButton getText={() => JSON.stringify(header, null, 2)} size={12} className="w-5 h-5" />
            </div>
            <pre
              className="min-w-0 max-w-full text-xs font-mono bg-surface border border-line rounded-control p-3 whitespace-pre-wrap break-all leading-5"
              dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(header)) }}
            />
          </div>

          {/* Payload */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-2xs uppercase tracking-label text-fg-subtle">Payload</p>
              <span className="flex-1 h-px bg-surface-raised" />
              <CopyButton getText={() => JSON.stringify(payload, null, 2)} size={12} className="w-5 h-5" />
            </div>
            <pre
              className="min-w-0 max-w-full text-xs font-mono bg-surface border border-line rounded-control p-3 whitespace-pre-wrap break-all leading-5 max-h-60 overflow-auto"
              dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(payload)) }}
            />
          </div>
        </div>
      )}
    </section>
  )
}
