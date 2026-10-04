const METHOD_COLORS = {
  GET:     'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT:     'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PATCH:   'bg-violet-500/15 text-violet-400 border-violet-500/30',
  DELETE:  'bg-red-500/15 text-red-400 border-red-500/30',
  HEAD:    'bg-gray-500/15 text-gray-400 border-gray-500/30',
  OPTIONS: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
}

export default function MethodBadge({ method, size = 'sm' }) {
  const colors = METHOD_COLORS[method] ?? 'bg-gray-500/15 text-gray-400 border-gray-500/30'
  const textSize = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
  return (
    <span className={`inline-flex items-center font-mono font-bold rounded border ${textSize} ${colors}`}>
      {method}
    </span>
  )
}
