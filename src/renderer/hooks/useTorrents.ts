import { useEffect } from 'react'
import { useTorrentStore } from '../store/torrentStore'

export function useTorrents() {
  const byHash = useTorrentStore((s) => s.byHash)
  const upsertMany = useTorrentStore((s) => s.upsertMany)
  const pushError = useTorrentStore((s) => s.pushError)

  useEffect(() => {
    let mounted = true

    window.api.listTorrents().then((r) => {
      if (mounted && r.ok) upsertMany(r.data)
    })

    const offProgress = window.api.onProgress(({ torrents }) => upsertMany(torrents))
    const offError = window.api.onError(({ message }) => pushError(message))
    const offDone = window.api.onDone(() => {
      // Future: play sound or show system notification
    })

    return () => {
      mounted = false
      offProgress()
      offError()
      offDone()
    }
  }, [upsertMany, pushError])

  return { torrents: Object.values(byHash) }
}
