import { memo, useState } from 'react'
import clsx from 'clsx'
import type { TorrentState, TorrentStatus } from '../../shared/types'
import type { TorrentAction } from './TorrentList'
import { ProgressBar } from './ProgressBar'
import { SpeedIndicator } from './SpeedIndicator'
import { FileList } from './FileList'
import { formatBytes, formatETA } from '../utils/format'

export interface TorrentRowProps {
  readonly torrent: TorrentState
  readonly onAction: (action: TorrentAction) => void
}

const STATUS_TEXT_COLORS: Record<TorrentStatus, string> = {
  idle: 'text-slate-400',
  metadata: 'text-yellow-400',
  downloading: 'text-blue-400',
  seeding: 'text-green-400',
  paused: 'text-orange-400',
  done: 'text-green-400',
  error: 'text-red-400'
}

export const TorrentRow = memo(function TorrentRow({ torrent, onAction }: TorrentRowProps) {
  const [filesExpanded, setFilesExpanded] = useState(false)
  const isPaused = torrent.status === 'paused'
  const isSeeding = torrent.status === 'seeding'
  const isError = torrent.status === 'error'
  const isFetchingMeta = torrent.status === 'metadata' || torrent.status === 'idle'
  const hasFiles = torrent.files.length > 0
  // Allow pause/cancel at every non-error stage (including metadata fetch)
  const canPause = !isError

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 hover:border-slate-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100 truncate" title={torrent.name}>
            {torrent.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-slate-400">
              {torrent.totalLength > 0
                ? formatBytes(torrent.totalLength)
                : 'Fetching metadata\u2026'}
            </p>
            {hasFiles && (
              <button
                onClick={() => setFilesExpanded((e) => !e)}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
              >
                <span>{filesExpanded ? '▲' : '▼'}</span>
                <span>
                  {torrent.files.length} file{torrent.files.length !== 1 ? 's' : ''}
                </span>
              </button>
            )}
          </div>
        </div>
        <span
          className={clsx(
            'text-xs font-semibold tracking-wide shrink-0',
            STATUS_TEXT_COLORS[torrent.status]
          )}
        >
          {torrent.status.toUpperCase()}
        </span>
      </div>

      {/* Overall progress bar */}
      <ProgressBar
        value={torrent.progress}
        status={torrent.status}
        indeterminate={isFetchingMeta}
      />

      {/* Stats */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <SpeedIndicator down={torrent.downloadSpeed} up={torrent.uploadSpeed} />
        <div className="flex items-center gap-3 tabular-nums">
          <span>
            {torrent.numPeers} peer{torrent.numPeers !== 1 ? 's' : ''}
          </span>
          {!isSeeding && !isPaused && torrent.timeRemaining > 0 && (
            <span>ETA {formatETA(torrent.timeRemaining)}</span>
          )}
          <span className="font-medium text-slate-300">
            {Math.round(torrent.progress * 100)}%
          </span>
        </div>
      </div>

      {/* File list (collapsible) */}
      {filesExpanded && hasFiles && (
        <div className="border-t border-slate-800 pt-3">
          <FileList torrent={torrent} />
        </div>
      )}

      {/* Error message */}
      {isError && torrent.error && (
        <p className="text-xs text-red-400 bg-red-950/50 rounded px-2 py-1">{torrent.error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5 border-t border-slate-800">
        {canPause && (
          <button
            onClick={() => onAction(isPaused ? 'resume' : 'pause')}
            className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded transition-colors"
          >
            {isPaused
              ? 'Resume'
              : isSeeding
                ? 'Stop Seeding'
                : isFetchingMeta
                  ? 'Cancel'
                  : 'Pause'}
          </button>
        )}
        <button
          onClick={() => onAction('open')}
          className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded transition-colors"
        >
          Open Folder
        </button>
        {hasFiles && (
          <button
            onClick={() => setFilesExpanded((e) => !e)}
            className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 rounded transition-colors"
          >
            {filesExpanded ? 'Hide Files' : 'Show Files'}
          </button>
        )}
        <button
          onClick={() => onAction('remove')}
          className="ml-auto px-3 py-1 text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 hover:text-red-300 rounded transition-colors"
        >
          Remove
        </button>
      </div>
    </div>
  )
})
