import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { TorrentState } from '../shared/types'

interface PersistedTorrent {
  readonly magnetURI: string
  readonly savePath: string
  readonly infoHash: string
}

export class Persistence {
  private readonly file: string

  constructor(userDataDir: string) {
    this.file = path.join(userDataDir, 'torrents.json')
  }

  async load(): Promise<ReadonlyArray<PersistedTorrent>> {
    try {
      const raw = await fs.readFile(this.file, 'utf8')
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed as PersistedTorrent[]
    } catch {
      return []
    }
  }

  async save(states: ReadonlyArray<TorrentState>): Promise<void> {
    const data: PersistedTorrent[] = states
      .filter((s) => s.magnetURI)
      .map((s) => ({
        magnetURI: s.magnetURI,
        savePath: s.savePath,
        infoHash: s.infoHash
      }))
    await fs.writeFile(this.file, JSON.stringify(data, null, 2), 'utf8')
  }
}
