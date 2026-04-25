import clsx from 'clsx'
import type { FilePriority, TorrentFile } from '../../shared/types'
import { useTorrentStore } from '../store/torrentStore'
import { formatBytes } from '../utils/format'
import { PrioritySelector } from './PrioritySelector'

export interface FileItemProps {
  readonly file: TorrentFile
  readonly fileIndex: number
  readonly infoHash: string
  readonly torrentDone: boolean
}

export function FileItem({ file, fileIndex, infoHash, torrentDone }: FileItemProps) {
  const pushError = useTorrentStore((s) => s.pushError)

  const isCompleted = file.progress >= 1
  const isSkipped = file.priority === 'skip'
  const isFilePaused = file.filePaused
  // File is effectively stopped if paused OR skipped
  const isStopped = isFilePaused || isSkipped
  const pct = Math.round(file.progress * 100)

  const handlePriorityChange = async (priority: FilePriority) => {
    const result = await window.api.setFilePriority({ infoHash, fileIndex, priority })
    if (!result.ok) pushError(result.error.message)
  }

  const handleTogglePause = async () => {
    const result = await window.api.toggleFilePause({ infoHash, fileIndex })
    if (!result.ok) pushError(result.error.message)
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-3 py-2 px-1 rounded-lg transition-colors',
        isStopped && !isCompleted ? 'opacity-60' : ''
      )}
    >
      {/* Pause / Play button — hidden for completed or skipped files */}
      <button
        onClick={handleTogglePause}
        disabled={torrentDone || isCompleted || isSkipped}
        title={isFilePaused ? 'Resume file download' : 'Pause file download'}
        className={clsx(
          'w-7 h-7 flex items-center justify-center rounded-full shrink-0 text-xs font-bold transition-all',
          isCompleted || isSkipped
            ? 'opacity-0 pointer-events-none'
            : isFilePaused
              ? 'bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 border border-orange-500/40'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600'
        )}
      >
        {isFilePaused ? '▶' : '⏸'}
      </button>

      {/* File info + mini progress */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p
            className={clsx(
              'text-xs truncate flex-1',
              isSkipped
                ? 'line-through text-slate-500'
                : isFilePaused
                  ? 'text-orange-300'
                  : 'text-slate-200'
            )}
            title={file.name}
          >
            {file.name}
          </p>
          {/* Status badge */}
          {!isCompleted && (
            <span
              className={clsx(
                'text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded',
                isSkipped
                  ? 'bg-slate-800 text-slate-500'
                  : isFilePaused
                    ? 'bg-orange-500/20 text-orange-400'
                    : file.progress > 0
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-slate-800 text-slate-500'
              )}
            >
              {isSkipped ? 'SKIP' : isFilePaused ? 'PAUSED' : file.progress > 0 ? 'DL' : 'QUEUED'}
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                isCompleted
                  ? 'bg-green-500'
                  : isSkipped
                    ? 'bg-slate-600'
                    : isFilePaused
                      ? 'bg-orange-500'
                      : file.priority === 'high'
                        ? 'bg-blue-400'
                        : 'bg-slate-400'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 tabular-nums shrink-0 w-8 text-right">
            {pct}%
          </span>
          <span className="text-xs text-slate-500 shrink-0">{formatBytes(file.length)}</span>
        </div>
      </div>

      {/* Priority selector */}
      <PrioritySelector
        value={file.priority}
        onChange={handlePriorityChange}
        disabled={torrentDone || isFilePaused}
      />
    </div>
  )
}
