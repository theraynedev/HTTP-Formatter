import { useState } from 'react'
import { LANGUAGES } from '../utils/codegen.js'
import CopyButton from './CopyButton.jsx'

export default function CodeGenPanel({ parsed }) {
  const [selected, setSelected] = useState('fetch')

  if (!parsed) {
    return (
      <div className="text-center text-gray-600 py-12 text-sm">
        Format a request first to generate code.
      </div>
    )
  }

  const lang = LANGUAGES.find(l => l.id === selected) ?? LANGUAGES[0]
  const code = lang.gen(parsed)

  return (
    <div className="space-y-4">
      {/* Language selector */}
      <div className="flex flex-wrap gap-2">
        {LANGUAGES.map(l => (
          <button
            key={l.id}
            onClick={() => setSelected(l.id)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${
              selected === l.id
                ? 'border-white/30 bg-white/10 text-white'
                : 'border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-white/20'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Code block */}
      <div className="relative">
        <CopyButton
          getText={() => code}
          size={14}
          className="absolute top-3 right-3 w-7 h-7 z-10"
        />
        <pre className="bg-white/[0.03] border border-white/10 rounded-xl p-4 pr-12 text-xs font-mono text-gray-200 overflow-auto max-h-[480px] whitespace-pre leading-5">
          {code}
        </pre>
      </div>
    </div>
  )
}
