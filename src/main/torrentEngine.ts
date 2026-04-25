import { EventEmitter } from 'node:events'
import type {
  AddTorrentRequest,
  FilePriority,
  TorrentFile,
  TorrentState,
  TorrentStatus
} from '../shared/types'
import type { Persistence } from './persistence'

export interface EngineDeps {
  readonly persistence: Persistence
  readonly log: {
    info: (m: string) => void
    error: (m: string, e?: unknown) => void
  }
}

// WebTorrent v2: client.get() is async — never call it synchronously.
// We maintain our own infoHash→torrent Map to avoid the async lookup entirely.
type WebTorrentInstance = {
  torrents: WebTorrentTorrent[]
  add: (
    id: string | Buffer,
    opts: { path: string },
    cb: (t: WebTorrentTorrent) => void
  ) => WebTorrentTorrent
  destroy: (cb?: () => void) => void
  on: (event: string, cb: (...args: unknown[]) => void) => void
}

type WebTorrentFile = {
  name: string
  path: string
  length: number
  progress: number
  select: () => void
  deselect: () => void
}

type WebTorrentWire = {
  destroy: () => void
}

type WebTorrentTorrent = {
  infoHash: string
  magnetURI: string
  name: string
  length: number
  downloaded: number
  uploaded: number
  downloadSpeed: number
  uploadSpeed: number
  progress: number
  numPeers: number
  timeRemaining: number
  ratio: number
  path: string
  files: WebTorrentFile[]
  wires: WebTorrentWire[]
  done: boolean
  ready: boolean
  paused: boolean
  pause: () => void
  resume: () => void
  destroy: (opts?: { destroyStore?: boolean }) => void
  on: (event: string, cb: (...args: unknown[]) => void) => void
}

const TICK_MS = 1000

export class TorrentEngine extends EventEmitter {
  private client: WebTorrentInstance | null = null
  private tickHandle: NodeJS.Timeout | null = null
  // Primary torrent lookup — avoids async client.get() which is async in WebTorrent v2
  private readonly torrentMap = new Map<string, WebTorrentTorrent>()
  private readonly paused = new Set<string>()
  private readonly savePaths = new Map<string, string>()
  private readonly addedAt = new Map<string, number>()
  private readonly filePriorities = new Map<string, FilePriority>()

  constructor(private readonly deps: EngineDeps) {
    super()
  }

  async start(): Promise<void> {
    const { default: WebTorrent } = await import('webtorrent')
    this.client = new (WebTorrent as unknown as new () => WebTorrentInstance)()
    this.client.on('error', (err: unknown) => this.emit('error', String(err)))
    this.tickHandle = setInterval(() => this.tick(), TICK_MS)

    const saved = await this.deps.persistence.load()
    for (const t of saved) {
      try {
        await this.add({ source: { kind: 'magnet', uri: t.magnetURI }, savePath: t.savePath })
      } catch (e) {
        this.deps.log.error('restore failed', e)
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.tickHandle) clearInterval(this.tickHandle)
    await this.deps.persistence.save(this.snapshot())
    await new Promise<void>((res) => {
      if (this.client) this.client.destroy(() => res())
      else res()
    })
    this.client = null
  }

  add(req: AddTorrentRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.client) return reject(new Error('engine not started'))
      const id =
        req.source.kind === 'magnet'
          ? req.source.uri
          : Buffer.from(req.source.buffer)
      this.client.add(id, { path: req.savePath }, (torrent) => {
        this.torrentMap.set(torrent.infoHash, torrent)
        this.savePaths.set(torrent.infoHash, req.savePath)
        this.addedAt.set(torrent.infoHash, Date.now())
        this.wireEvents(torrent)
        resolve(torrent.infoHash)
      })
    })
  }

  async remove(infoHash: string, deleteFiles: boolean): Promise<void> {
    const t = this.torrentMap.get(infoHash)
    if (!t) throw new Error(`torrent ${infoHash} not found`)
    t.destroy({ destroyStore: deleteFiles })
    this.torrentMap.delete(infoHash)
    this.paused.delete(infoHash)
    this.savePaths.delete(infoHash)
    this.addedAt.delete(infoHash)
    for (const key of this.filePriorities.keys()) {
      if (key.startsWith(`${infoHash}:`)) this.filePriorities.delete(key)
    }
  }

  pause(infoHash: string): void {
    const t = this.torrentMap.get(infoHash)
    if (!t) throw new Error(`torrent ${infoHash} not found`)
    t.pause()
    // WebTorrent v2 pause() only blocks new connections — destroy existing wires
    // to stop in-progress transfers immediately
    for (const wire of [...t.wires]) wire.destroy()
    this.paused.add(infoHash)
  }

  resume(infoHash: string): void {
    const t = this.torrentMap.get(infoHash)
    if (!t) throw new Error(`torrent ${infoHash} not found`)
    t.resume()
    this.paused.delete(infoHash)
  }

  setFilePriority(infoHash: string, fileIndex: number, priority: FilePriority): void {
    const torrent = this.torrentMap.get(infoHash)
    if (!torrent) throw new Error(`torrent ${infoHash} not found`)
    const file = torrent.files[fileIndex]
    if (!file) throw new Error(`file index ${fileIndex} out of range`)
    this.filePriorities.set(`${infoHash}:${fileIndex}`, priority)
    if (priority === 'skip') file.deselect()
    else file.select()
  }

  list(): ReadonlyArray<TorrentState> {
    return this.snapshot()
  }

  private wireEvents(t: WebTorrentTorrent): void {
    t.on('done', () => this.emit('done', t.infoHash, t.path))
    t.on('error', (e: unknown) => this.emit('error', String(e), t.infoHash))
  }

  private tick(): void {
    this.emit('progress', this.snapshot())
  }

  private snapshot(): ReadonlyArray<TorrentState> {
    return Array.from(this.torrentMap.values()).map((t) => this.toState(t))
  }

  private toState(t: WebTorrentTorrent): TorrentState {
    const status: TorrentStatus = this.paused.has(t.infoHash)
      ? 'paused'
      : t.done
        ? 'seeding'
        : t.ready
          ? 'downloading'
          : 'metadata'

    const files: TorrentFile[] = t.files.map((f, i) => ({
      name: f.name,
      path: f.path,
      length: f.length,
      progress: f.progress,
      priority: this.filePriorities.get(`${t.infoHash}:${i}`) ?? 'normal'
    }))

    return {
      infoHash: t.infoHash,
      magnetURI: t.magnetURI ?? '',
      name: t.name ?? '(unknown)',
      status,
      totalLength: t.length ?? 0,
      downloaded: t.downloaded ?? 0,
      uploaded: t.uploaded ?? 0,
      downloadSpeed: t.downloadSpeed ?? 0,
      uploadSpeed: t.uploadSpeed ?? 0,
      progress: t.progress ?? 0,
      numPeers: t.numPeers ?? 0,
      timeRemaining: Number.isFinite(t.timeRemaining) ? t.timeRemaining : -1,
      ratio: t.ratio ?? 0,
      savePath: this.savePaths.get(t.infoHash) ?? t.path,
      files,
      addedAt: this.addedAt.get(t.infoHash) ?? Date.now()
    }
  }
}
