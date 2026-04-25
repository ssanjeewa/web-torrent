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
  const isSkipped = file.priority === 'skip'
  const pct = Math.round(file.progress * 100)

  const handlePriorityChange = async (priority: FilePriority) => {
    const result = await window.api.setFilePriority({ infoHash, fileIndex, priority })
    if (!result.ok) pushError(result.error.message)
  }

  return (
    <div className={clsx('flex items-center gap-3 py-1.5', isSkipped && 'opacity-50')}>
      {/* File info + mini progress */}
      <div className="flex-1 min-w-0 space-y-1">
        <p
          className={clsx(
            'text-xs truncate',
            isSkipped ? 'line-through text-slate-500' : 'text-slate-200'
          )}
          title={file.name}
        >
          {file.name}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-300',
                isSkipped
                  ? 'bg-slate-600'
                  : file.priority === 'high'
                    ? 'bg-blue-500'
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

      {/* Priority selector — disabled once torrent is fully done */}
      <PrioritySelector
        value={file.priority}
        onChange={handlePriorityChange}
        disabled={torrentDone}
      />
    </div>
  )
}
