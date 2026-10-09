import { useState } from 'react'
import { Code, ChevronDown, ChevronUp } from 'reicon-react'
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
        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-card border border-line bg-surface text-sm font-medium text-fg-muted hover:text-fg hover:bg-surface-raised transition"
      >
        <Code size={14} className="shrink-0" />
        <span className="flex-1 text-left">Infer schema from response</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 space-y-3 p-4 rounded-card border border-line bg-surface">
          {/* Mode tabs + copy */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-0.5 rounded-control bg-surface-raised border border-line">
              <button
                onClick={() => setMode('ts')}
                className={`text-xs px-3 py-1 rounded-control font-medium transition ${mode === 'ts' ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg'}`}
              >
                TypeScript
              </button>
              <button
                onClick={() => setMode('json')}
                className={`text-xs px-3 py-1 rounded-control font-medium transition ${mode === 'json' ? 'bg-accent text-white' : 'text-fg-muted hover:text-fg'}`}
              >
                JSON Schema
              </button>
            </div>
            <span className="flex-1" />
            <CopyButton getText={() => output} size={13} className="w-7 h-7" />
          </div>

          <pre className="text-xs font-mono bg-surface border border-line rounded-control p-3 whitespace-pre-wrap leading-5 max-h-72 overflow-auto text-fg">
            {output}
          </pre>
        </div>
      )}
    </div>
  )
}
