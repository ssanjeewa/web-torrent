import clsx from 'clsx'
import type { TorrentStatus } from '../../shared/types'

export interface ProgressBarProps {
  readonly value: number
  readonly status: TorrentStatus
  readonly indeterminate?: boolean
}

const BAR_COLORS: Record<TorrentStatus, string> = {
  idle: 'bg-slate-600',
  metadata: 'bg-yellow-500',
  downloading: 'bg-blue-500',
  seeding: 'bg-green-500',
  paused: 'bg-orange-500',
  done: 'bg-green-500',
  error: 'bg-red-500'
}

export function ProgressBar({ value, status, indeterminate }: ProgressBarProps) {
  const pct = Math.min(Math.max(value * 100, 0), 100)

  return (
    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div
        data-testid="progress"
        data-value={value}
        className={clsx(
          'h-full rounded-full transition-all duration-300',
          BAR_COLORS[status],
          indeterminate && 'animate-pulse'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
