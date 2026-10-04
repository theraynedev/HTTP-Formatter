import { useState } from 'react'
import { Braces, ChevronDown, ChevronUp } from 'lucide-react'
import { generateTypeScript, generateJsonSchema } from '../utils/schema.js'
import CopyButton from './CopyButton.jsx'

export default function SchemaPanel({ jsonBody }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('ts') // 'ts' | 'json'

  if (!jsonBody) return null

  const tsOutput = generateTypeScript(jsonBody)
  const jsonOutput = generateJsonSchema(jsonBody)
  const output = mode === 'ts' ? tsOutput : jsonOutput

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-medium text-gray-400 hover:text-white hover:bg-white/[0.06] transition"
      >
        <Braces size={14} className="shrink-0" />
        <span className="flex-1 text-left">Infer schema from response</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
          {/* Mode tabs + copy */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10">
              <button
                onClick={() => setMode('ts')}
                className={`text-xs px-3 py-1 rounded-md font-medium transition ${mode === 'ts' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
              >
                TypeScript
              </button>
              <button
                onClick={() => setMode('json')}
                className={`text-xs px-3 py-1 rounded-md font-medium transition ${mode === 'json' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
              >
                JSON Schema
              </button>
            </div>
            <span className="flex-1" />
            <CopyButton getText={() => output} size={13} className="w-7 h-7" />
          </div>

          <pre className="text-xs font-mono bg-white/[0.02] border border-white/5 rounded-lg p-3 whitespace-pre-wrap leading-5 max-h-72 overflow-auto text-gray-200">
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}
