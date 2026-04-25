import { BrowserWindow, Menu, app, globalShortcut, shell } from 'electron'
import path from 'node:path'
import { registerIpcHandlers } from './ipcHandlers'
import { setupLogger, log } from './logger'
import { Persistence } from './persistence'
import { TorrentEngine } from './torrentEngine'

const isDev = process.env.NODE_ENV === 'development'

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
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

function registerShortcuts(): void {
  // Toggle DevTools — dev only
  if (isDev) {
    globalShortcut.register('CommandOrControl+Shift+I', () => {
      mainWindow?.webContents.toggleDevTools()
    })
  }
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev
          ? [
              { type: 'separator' as const },
              {
                label: 'Toggle Developer Tools',
                accelerator: 'CmdOrCtrl+Shift+I',
                click: () => mainWindow?.webContents.toggleDevTools()
              }
            ]
          : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  setupLogger()
  log.info('App starting')

  buildMenu()
  registerShortcuts()

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
  globalShortcut.unregisterAll()
  await engine?.shutdown()
})
