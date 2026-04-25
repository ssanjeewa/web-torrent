import type { TorrentState } from '../../shared/types'
import { FileItem } from './FileItem'

export interface FileListProps {
  readonly torrent: TorrentState
}

export function FileList({ torrent }: FileListProps) {
  const isDone = torrent.status === 'done'

  if (torrent.files.length === 0) {
    return (
      <p className="text-xs text-slate-500 py-2 text-center">
        Fetching file list\u2026
      </p>
    )
  }

  const skippedCount = torrent.files.filter((f) => f.priority === 'skip').length
  const highCount = torrent.files.filter((f) => f.priority === 'high').length

  return (
    <div className="space-y-0.5">
      {/* Summary badges */}
      {(highCount > 0 || skippedCount > 0) && (
        <div className="flex gap-2 pb-1.5">
          {highCount > 0 && (
            <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded">
              {highCount} high priority
            </span>
          )}
          {skippedCount > 0 && (
            <span className="text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">
              {skippedCount} skipped
            </span>
          )}
          {skippedCount === torrent.files.length && (
            <span className="text-xs bg-yellow-900/50 text-yellow-400 px-1.5 py-0.5 rounded">
              ⚠ All files skipped
            </span>
          )}
        </div>
      )}

      {torrent.files.map((file, index) => (
        <FileItem
          key={index}
          file={file}
          fileIndex={index}
          infoHash={torrent.infoHash}
          torrentDone={isDone}
        />
      ))}
    </div>
  )
}
