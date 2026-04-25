import { BrowserWindow, app, shell } from 'electron'
import path from 'node:path'
import { registerIpcHandlers } from './ipcHandlers'
import { setupLogger, log } from './logger'
import { Persistence } from './persistence'
import { TorrentEngine } from './torrentEngine'

const isDev = process.env.NODE_ENV === 'development'

// Suppress Chrome DevTools Autofill protocol errors (methods not supported in this Electron build)
app.commandLine.appendSwitch('disable-features', 'AutofillCreditCardEnabled,AutofillProfileEnabled')

let mainWindow: BrowserWindow | null = null
let engine: TorrentEngine | null = null

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 480,
    title: 'WebTorrent Desktop',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  setupLogger()
  log.info('App starting')

  const persistence = new Persistence(app.getPath('userData'))
  engine = new TorrentEngine({ persistence, log })

  try {
    await engine.start()
  } catch (e) {
    log.error('Engine start failed', e)
  }

  await createWindow()
  if (mainWindow && engine) registerIpcHandlers(mainWindow, engine)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await engine?.shutdown()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  await engine?.shutdown()
})
