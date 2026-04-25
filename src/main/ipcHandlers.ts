import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { IPC } from '../shared/channels'
import {
  AddTorrentRequestSchema,
  InfoHashSchema,
  RemoveTorrentRequestSchema,
  SetFilePrioritySchema
} from '../shared/schemas'
import type { Result } from '../shared/types'
import type { TorrentEngine } from './torrentEngine'

const ok = <T>(data: T): Result<T> => ({ ok: true, data })
const err = (code: string, message: string): Result<never> => ({
  ok: false,
  error: { code, message }
})

export function registerIpcHandlers(win: BrowserWindow, engine: TorrentEngine): void {
  ipcMain.handle(IPC.Add, async (_e, raw) => {
    const parsed = AddTorrentRequestSchema.safeParse(raw)
    if (!parsed.success) return err('VALIDATION', parsed.error.message)
    try {
      const infoHash = await engine.add(parsed.data)
      return ok({ infoHash })
    } catch (e) {
      return err('ADD_FAILED', String(e))
    }
  })

  ipcMain.handle(IPC.Remove, async (_e, raw) => {
    const parsed = RemoveTorrentRequestSchema.safeParse(raw)
    if (!parsed.success) return err('VALIDATION', parsed.error.message)
    try {
      await engine.remove(parsed.data.infoHash, parsed.data.deleteFiles)
      return ok(undefined)
    } catch (e) {
      return err('REMOVE_FAILED', String(e))
    }
  })

  ipcMain.handle(IPC.Pause, async (_e, raw) => {
    const hash = InfoHashSchema.safeParse(raw?.infoHash)
    if (!hash.success) return err('VALIDATION', 'invalid infoHash')
    try {
      engine.pause(hash.data)
      return ok(undefined)
    } catch (e) {
      return err('PAUSE_FAILED', String(e))
    }
  })

  ipcMain.handle(IPC.Resume, async (_e, raw) => {
    const hash = InfoHashSchema.safeParse(raw?.infoHash)
    if (!hash.success) return err('VALIDATION', 'invalid infoHash')
    try {
      engine.resume(hash.data)
      return ok(undefined)
    } catch (e) {
      return err('RESUME_FAILED', String(e))
    }
  })

  ipcMain.handle(IPC.List, async () => ok(engine.list()))

  ipcMain.handle(IPC.ChoosePath, async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose download folder',
      properties: ['openDirectory', 'createDirectory']
    })
    return ok({ path: result.canceled ? null : (result.filePaths[0] ?? null) })
  })

  ipcMain.handle(IPC.SetFilePriority, async (_e, raw) => {
    const parsed = SetFilePrioritySchema.safeParse(raw)
    if (!parsed.success) return err('VALIDATION', parsed.error.message)
    try {
      engine.setFilePriority(parsed.data.infoHash, parsed.data.fileIndex, parsed.data.priority)
      return ok(undefined)
    } catch (e) {
      return err('PRIORITY_FAILED', String(e))
    }
  })

  ipcMain.handle(IPC.OpenPath, async (_e, infoHash) => {
    const t = engine.list().find((x) => x.infoHash === infoHash)
    if (!t) return err('NOT_FOUND', 'torrent not found')
    await shell.openPath(t.savePath)
    return ok(undefined)
  })

  const safeSend = (channel: string, payload: unknown) => {
    if (win.isDestroyed()) return
    try {
      win.webContents.send(channel, payload)
    } catch {
      // Renderer frame disposed between isDestroyed() check and send(); ignore
    }
  }

  engine.on('progress', (torrents) => {
    safeSend(IPC.Progress, { torrents, timestamp: Date.now() })
  })

  engine.on('done', (infoHash: string, savePath: string) => {
    safeSend(IPC.Done, { infoHash, savePath })
  })

  engine.on('error', (message: string, infoHash?: string) => {
    safeSend(IPC.Error, { message, infoHash })
  })
}
