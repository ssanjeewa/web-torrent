import clsx from 'clsx'
import type { FilePriority } from '../../shared/types'

interface Option {
  value: FilePriority
  label: string
  icon: string
  activeClass: string
}

const OPTIONS: Option[] = [
  { value: 'high',   label: 'High priority',   icon: '↑', activeClass: 'bg-blue-600 text-white' },
  { value: 'normal', label: 'Normal priority',  icon: '—', activeClass: 'bg-slate-600 text-white' },
  { value: 'skip',   label: 'Skip this file',   icon: '✕', activeClass: 'bg-red-700 text-white' }
]

export interface PrioritySelectorProps {
  readonly value: FilePriority
  readonly onChange: (priority: FilePriority) => void
  readonly disabled?: boolean
}

export function PrioritySelector({ value, onChange, disabled }: PrioritySelectorProps) {
  return (
    <div className="flex rounded overflow-hidden border border-slate-700 shrink-0">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          title={opt.label}
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={clsx(
            'w-7 h-6 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
            value === opt.value
              ? opt.activeClass
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          )}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  )
}
