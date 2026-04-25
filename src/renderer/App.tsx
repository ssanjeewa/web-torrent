import { AddTorrent } from './components/AddTorrent'
import { TorrentList } from './components/TorrentList'
import { Toaster } from './components/Toaster'
import { useTorrents } from './hooks/useTorrents'
import type { TorrentAction } from './components/TorrentList'
import { useTorrentStore } from './store/torrentStore'

export default function App() {
  const { torrents } = useTorrents()
  const pushError = useTorrentStore((s) => s.pushError)

  const onAction = async (action: TorrentAction, infoHash: string) => {
    try {
      let result
      if (action === 'pause') result = await window.api.pauseTorrent({ infoHash })
      else if (action === 'resume') result = await window.api.resumeTorrent({ infoHash })
      else if (action === 'remove') result = await window.api.removeTorrent({ infoHash, deleteFiles: false })
      else if (action === 'open') result = await window.api.openSavePath(infoHash)

      if (result && !result.ok) pushError(`${action} failed: ${result.error.message}`)
    } catch (e) {
      pushError(`${action} failed: ${String(e)}`)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="px-6 py-4 border-b border-slate-800 flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 bg-blue-600 rounded-md flex items-center justify-center text-sm font-bold">
          W
        </div>
        <h1 className="text-base font-semibold tracking-tight">WebTorrent Desktop</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 space-y-6">
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Add Torrent
          </h2>
          <AddTorrent />
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Downloads
            </h2>
            {torrents.length > 0 && (
              <span className="text-xs text-slate-500">{torrents.length} torrent{torrents.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <TorrentList torrents={torrents} onAction={onAction} />
        </section>
      </main>

      <Toaster />
    </div>
  )
}
