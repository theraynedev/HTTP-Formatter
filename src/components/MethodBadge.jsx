import { normalizeMethod } from '../utils/storage.js'

const METHOD_COLORS = {
  GET:     'bg-success/15 text-success border-success/30',
  POST:    'bg-info/15 text-info border-info/30',
  PUT:     'bg-warning/15 text-warning border-warning/30',
  PATCH:   'bg-accent/15 text-accent-text border-accent/30',
  DELETE:  'bg-danger/15 text-danger border-danger/30',
  HEAD:    'bg-surface-raised/15 text-fg-muted border-line/30',
  OPTIONS: 'bg-accent/15 text-accent-text border-accent/30',
}

export default function MethodBadge({ method, size = 'sm' }) {
  const normalized = normalizeMethod(method)
  const colors = METHOD_COLORS[normalized] ?? 'bg-surface-raised/15 text-fg-muted border-line/30'
  const textSize = size === 'xs' ? 'text-2xs px-1.5 py-0.5' : 'text-xs px-2 py-1'
  return (
    <span className={`inline-flex items-center font-mono font-medium rounded-chip border ${textSize} ${colors}`}>
      {normalized}
    </span>
  )
}
