import type { TorrentState } from '../../shared/types'
import { TorrentRow } from './TorrentRow'

export type TorrentAction = 'pause' | 'resume' | 'remove' | 'open'

export interface TorrentListProps {
  readonly torrents: ReadonlyArray<TorrentState>
  readonly onAction: (action: TorrentAction, infoHash: string) => void
}

export function TorrentList({ torrents, onAction }: TorrentListProps) {
  if (torrents.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500">
        <div className="text-5xl mb-4">⬇</div>
        <p className="text-lg font-medium text-slate-400">No active torrents</p>
        <p className="text-sm mt-1">Paste a magnet link or drop a .torrent file above to get started</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {torrents.map((t) => (
        <TorrentRow
          key={t.infoHash}
          torrent={t}
          onAction={(action) => onAction(action, t.infoHash)}
        />
      ))}
    </div>
  )
}
