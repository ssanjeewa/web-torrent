export type TorrentStatus =
  | 'idle'
  | 'metadata'
  | 'downloading'
  | 'seeding'
  | 'paused'
  | 'done'
  | 'error'

export type FilePriority = 'high' | 'normal' | 'skip'

export interface TorrentFile {
  readonly name: string
  readonly path: string
  readonly length: number
  readonly progress: number
  readonly priority: FilePriority
  readonly filePaused: boolean   // independent of priority — temporary per-file pause
}

export interface TorrentState {
  readonly infoHash: string
  readonly magnetURI: string
  readonly name: string
  readonly status: TorrentStatus
  readonly totalLength: number
  readonly downloaded: number
  readonly uploaded: number
  readonly downloadSpeed: number
  readonly uploadSpeed: number
  readonly progress: number
  readonly numPeers: number
  readonly timeRemaining: number
  readonly ratio: number
  readonly savePath: string
  readonly files: ReadonlyArray<TorrentFile>
  readonly addedAt: number
  readonly error?: string
}

export interface AddTorrentRequest {
  readonly source:
    | { readonly kind: 'magnet'; readonly uri: string }
    | { readonly kind: 'file'; readonly buffer: ArrayBuffer; readonly fileName: string }
  readonly savePath: string
}

export interface AddTorrentResponse {
  readonly infoHash: string
}

export interface SetFilePriorityRequest {
  readonly infoHash: string
  readonly fileIndex: number
  readonly priority: FilePriority
}

export interface ToggleFilePauseRequest {
  readonly infoHash: string
  readonly fileIndex: number
}

export interface RemoveTorrentRequest {
  readonly infoHash: string
  readonly deleteFiles: boolean
}

export interface PauseTorrentRequest {
  readonly infoHash: string
}

export interface ResumeTorrentRequest {
  readonly infoHash: string
}

export interface ChooseSavePathResponse {
  readonly path: string | null
}

export interface ProgressBroadcast {
  readonly torrents: ReadonlyArray<TorrentState>
  readonly timestamp: number
}

export interface TorrentDoneBroadcast {
  readonly infoHash: string
  readonly savePath: string
}

export interface TorrentErrorBroadcast {
  readonly infoHash?: string
  readonly message: string
  readonly code?: string
}

export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } }

export interface TorrentAPI {
  addTorrent: (req: AddTorrentRequest) => Promise<Result<AddTorrentResponse>>
  removeTorrent: (req: RemoveTorrentRequest) => Promise<Result<void>>
  pauseTorrent: (req: PauseTorrentRequest) => Promise<Result<void>>
  resumeTorrent: (req: ResumeTorrentRequest) => Promise<Result<void>>
  listTorrents: () => Promise<Result<ReadonlyArray<TorrentState>>>
  chooseSavePath: () => Promise<Result<ChooseSavePathResponse>>
  openSavePath: (infoHash: string) => Promise<Result<void>>
  setFilePriority: (req: SetFilePriorityRequest) => Promise<Result<void>>
  toggleFilePause: (req: ToggleFilePauseRequest) => Promise<Result<void>>
  onProgress: (cb: (b: ProgressBroadcast) => void) => () => void
  onDone: (cb: (b: TorrentDoneBroadcast) => void) => () => void
  onError: (cb: (b: TorrentErrorBroadcast) => void) => () => void
}

declare global {
  interface Window {
    readonly api: TorrentAPI
  }
}
