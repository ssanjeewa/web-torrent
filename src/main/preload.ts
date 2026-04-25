import { IpcRendererEvent, contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/channels'
import type {
  ProgressBroadcast,
  TorrentAPI,
  TorrentDoneBroadcast,
  TorrentErrorBroadcast
} from '../shared/types'


const subscribe = <T>(channel: string, cb: (payload: T) => void): (() => void) => {
  const handler = (_e: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: TorrentAPI = {
  addTorrent: (req) => ipcRenderer.invoke(IPC.Add, req),
  removeTorrent: (req) => ipcRenderer.invoke(IPC.Remove, req),
  pauseTorrent: (req) => ipcRenderer.invoke(IPC.Pause, req),
  resumeTorrent: (req) => ipcRenderer.invoke(IPC.Resume, req),
  listTorrents: () => ipcRenderer.invoke(IPC.List),
  chooseSavePath: () => ipcRenderer.invoke(IPC.ChoosePath),
  openSavePath: (h) => ipcRenderer.invoke(IPC.OpenPath, h),
  setFilePriority: (req) => ipcRenderer.invoke(IPC.SetFilePriority, req),
  onProgress: (cb) => subscribe<ProgressBroadcast>(IPC.Progress, cb),
  onDone: (cb) => subscribe<TorrentDoneBroadcast>(IPC.Done, cb),
  onError: (cb) => subscribe<TorrentErrorBroadcast>(IPC.Error, cb)
}

contextBridge.exposeInMainWorld('api', api)
