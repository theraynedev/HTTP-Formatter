import { ArrowLeft } from 'lucide-react'
import MethodBadge from './MethodBadge.jsx'
import { diffObjects, diffLines, headersToObj } from '../utils/diff.js'

function DiffRow({ row }) {
  const bg = row.type === 'same'
    ? ''
    : row.type === 'added'
      ? 'bg-emerald-500/10'
      : row.type === 'removed'
        ? 'bg-red-500/10'
        : 'bg-amber-500/10'

  return (
    <tr className={`text-xs font-mono ${bg}`}>
      <td className="px-3 py-1 align-top border-r border-white/5 text-gray-400 break-all">{row.key}</td>
      <td className={`px-3 py-1 align-top border-r border-white/5 break-all ${row.type === 'removed' || row.type === 'changed' ? 'text-red-300' : 'text-gray-300'}`}>
        {row.leftVal ?? <span className="text-gray-600 italic">—</span>}
      </td>
      <td className={`px-3 py-1 align-top break-all ${row.type === 'added' || row.type === 'changed' ? 'text-emerald-300' : 'text-gray-300'}`}>
        {row.rightVal ?? <span className="text-gray-600 italic">—</span>}
      </td>
    </tr>
  )
}

function LineDiff({ leftLines, rightLines }) {
  const rows = diffLines(leftLines, rightLines)
  const maxLen = Math.max(leftLines.length, rightLines.length)
  if (maxLen === 0) return <p className="text-xs text-gray-600 italic p-3">No content</p>

  return (
    <div className="grid grid-cols-2 gap-px bg-white/5 rounded-xl overflow-hidden border border-white/10 text-xs font-mono">
      <div className="bg-[#0a0a0a] p-3 space-y-0.5 max-h-64 overflow-auto">
        {rows.map((r, i) => (
          <div key={i} className={`leading-5 break-all px-1 rounded ${r.type === 'diff' ? 'bg-red-500/15 text-red-300' : 'text-gray-400'}`}>
            {r.left || <span className="opacity-30">∅</span>}
          </div>
        ))}
      </div>
      <div className="bg-[#0a0a0a] p-3 space-y-0.5 max-h-64 overflow-auto">
        {rows.map((r, i) => (
          <div key={i} className={`leading-5 break-all px-1 rounded ${r.type === 'diff' ? 'bg-emerald-500/15 text-emerald-300' : 'text-gray-400'}`}>
            {r.right || <span className="opacity-30">∅</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ComparePanel({ a, b, onBack }) {
  const aHdrObj = headersToObj(a.headers)
  const bHdrObj = headersToObj(b.headers)
  const headerDiff = diffObjects(aHdrObj, bHdrObj)

  const aPayloadLines = a.payload ? a.payload.split('\n') : []
  const bPayloadLines = b.payload ? b.payload.split('\n') : []

  const labelA = a.customName ?? a.name
  const labelB = b.customName ?? b.name

  const urlChanged = a.url !== b.url
  const methodChanged = a.method !== b.method

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <span className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-gray-600">Compare</span>
      </div>

      {/* Labels */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2 mb-1">
            <MethodBadge method={a.method ?? 'GET'} size="xs" />
            <span className="font-mono text-white text-xs truncate">{labelA}</span>
          </div>
          <p className="text-xs text-gray-600 font-mono truncate">{a.url}</p>
        </div>
        <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2 mb-1">
            <MethodBadge method={b.method ?? 'GET'} size="xs" />
            <span className="font-mono text-white text-xs truncate">{labelB}</span>
          </div>
          <p className="text-xs text-gray-600 font-mono truncate">{b.url}</p>
        </div>
      </div>

      {/* URL diff */}
      {urlChanged && (
        <section>
          <h3 className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-2">URL</h3>
          <LineDiff leftLines={[a.url]} rightLines={[b.url]} />
        </section>
      )}

      {/* Method diff */}
      {methodChanged && (
        <section>
          <h3 className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-2">Method</h3>
          <div className="flex gap-3">
            <MethodBadge method={a.method} />
            <span className="text-gray-600">→</span>
            <MethodBadge method={b.method} />
          </div>
        </section>
      )}

      {/* Headers diff */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <h3 className="text-xs font-semibold tracking-widest uppercase text-gray-500">Headers</h3>
          <span className="flex-1 h-px bg-white/10" />
          <span className="text-xs text-gray-600">
            {headerDiff.filter(r => r.type !== 'same').length} change{headerDiff.filter(r => r.type !== 'same').length !== 1 ? 's' : ''}
          </span>
        </div>
        {headerDiff.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No headers</p>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white/5 text-xs text-gray-500">
                  <th className="px-3 py-2 text-left border-r border-white/5 font-medium w-1/4">Header</th>
                  <th className="px-3 py-2 text-left border-r border-white/5 font-medium w-[37.5%]">{labelA}</th>
                  <th className="px-3 py-2 text-left font-medium w-[37.5%]">{labelB}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {headerDiff.map((row, i) => <DiffRow key={i} row={row} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Payload diff */}
      {(a.payload || b.payload) && (
        <section>
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-gray-500">Payload</h3>
            <span className="flex-1 h-px bg-white/10" />
          </div>
          <LineDiff leftLines={aPayloadLines} rightLines={bPayloadLines} />
        </section>
      )}
    </div>
  )
}
