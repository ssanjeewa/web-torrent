# Implementation Blueprint: WebTorrent Desktop Application

> Production-ready specification for a TypeScript + React + Electron torrent client.

---

## 1. Requirements

### 1.1 Functional Requirements (MVP)

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Accept magnet URI via paste/text input | Must |
| F2 | Accept `.torrent` file via file picker and drag-drop | Must |
| F3 | Display torrent metadata (name, total size, file count, info hash) | Must |
| F4 | Display real-time progress (%, downloaded bytes, peers, ETA) | Must |
| F5 | Display real-time download/upload speed | Must |
| F6 | Allow user to choose download destination via native OS dialog | Must |
| F7 | Assemble final file(s) on disk and stop seeding when user removes | Must |
| F8 | Pause/resume an active torrent | Should |
| F9 | Remove a torrent (with optional file deletion) | Should |
| F10 | Persist torrent list across app restarts | Should |

### 1.2 Non-Functional Requirements

**Performance**
- UI must remain responsive (60 fps) while downloading at 50+ MB/s
- IPC progress updates throttled to 1 Hz to avoid React re-render storms
- Engine memory ceiling: < 500 MB for up to 20 concurrent torrents
- Cold-start time to first interactive: < 2 seconds

**Security**
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on the renderer
- Strict Content-Security-Policy in `index.html`
- Validate every magnet URI against a regex before passing to engine
- Restrict file dialog to user-owned directories; reject system paths
- No remote code execution: `webSecurity: true`, no `allowRunningInsecureContent`
- Preload script exposes a typed, narrow API via `contextBridge` only

**UX**
- Native window chrome on macOS/Windows/Linux
- Keyboard shortcuts: Cmd/Ctrl+V to paste magnet, Delete to remove selected
- Empty state with onboarding hints
- Toast notifications for errors (invalid magnet, disk full, etc.)
- Progress bars animate smoothly using CSS transitions

**Reliability**
- Graceful handling of network drops (WebTorrent auto-reconnects; UI reflects state)
- Crash recovery: persisted torrent state restored on relaunch
- File system errors surfaced to the user with actionable messages

**Cross-platform**
- macOS 12+, Windows 10+, Ubuntu 20.04+
- Auto-updater (electron-updater) wired but not required for MVP

---

## 2. Tech Stack

### 2.1 Runtime and Build

| Package | Version | Purpose |
|---------|---------|---------|
| `electron` | ^31.0.0 | Desktop shell |
| `electron-vite` | ^2.3.0 | Build tooling for Electron + Vite |
| `electron-builder` | ^24.13.3 | Packaging and code signing |
| `vite` | ^5.3.0 | Renderer dev server, HMR |
| `typescript` | ^5.5.0 | Type system |
| `node` | 20.x LTS | Main-process runtime (bundled with Electron) |

### 2.2 Engine

| Package | Version | Purpose |
|---------|---------|---------|
| `webtorrent` | ^2.4.0 | Torrent engine (BitTorrent + WebRTC) |
| `parse-torrent` | ^11.0.16 | Parse magnet URIs and `.torrent` buffers |
| `bittorrent-dht` | bundled | DHT support |

Justification: `webtorrent` v2 is a hybrid client supporting both classic BitTorrent (TCP/UTP) and WebRTC peers — important when running inside Electron where Node networking is available.

### 2.3 Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^18.3.0 | UI framework |
| `react-dom` | ^18.3.0 | DOM renderer |
| `tailwindcss` | ^3.4.0 | Styling |
| `autoprefixer` | ^10.4.0 | PostCSS plugin |
| `clsx` | ^2.1.0 | Conditional class composition |
| `zustand` | ^4.5.0 | Lightweight global state (torrent map) |

Justification for Zustand: simpler than Redux, avoids Context re-render pitfalls when torrent state ticks every second.

### 2.4 Validation, Logging, Testing

| Package | Version | Purpose |
|---------|---------|---------|
| `zod` | ^3.23.0 | IPC payload validation at boundary |
| `electron-log` | ^5.1.0 | Main + renderer logging to file |
| `vitest` | ^1.6.0 | Unit/integration tests |
| `@testing-library/react` | ^16.0.0 | Component tests |
| `playwright` | ^1.45.0 | E2E (Electron support via `_electron`) |
| `eslint` | ^9.0.0 | Linting |
| `prettier` | ^3.3.0 | Formatting |

---

## 3. Architecture

### 3.1 Process Topology

```
+--------------------------------------------------------------+
|                    Electron Application                       |
|                                                              |
|   +----------------------+        +-----------------------+  |
|   |    Main Process      |  IPC   |   Renderer Process    |  |
|   |    (Node.js)         | <----> |   (Chromium + React)  |  |
|   |                      |        |                       |  |
|   |  - BrowserWindow     |        |  - React App          |  |
|   |  - WebTorrent client |        |  - Zustand store      |  |
|   |  - File dialogs      |        |  - Tailwind UI        |  |
|   |  - Disk I/O          |        |  - Preload bridge     |  |
|   |  - Torrent persistence|       |    (window.api)       |  |
|   +----------------------+        +-----------------------+  |
|             |                                |               |
|             v                                v               |
|   [DHT, Trackers, TCP/UTP/WebRTC peers]   [User]             |
+--------------------------------------------------------------+
```

### 3.2 Data Flow

```
User pastes magnet → Renderer calls window.api.addTorrent(magnet, savePath)
  → preload: ipcRenderer.invoke('torrent:add', payload)
    → Main ipcMain.handle: validates with zod, calls engine.add()
      → WebTorrent client.add(magnet, { path })
        ← emits 'metadata', 'download', 'done' events

Engine setInterval(1000ms):
  → snapshots all client.torrents
  → emits 'progress' EventEmitter event
    → ipcHandlers: win.webContents.send('torrent:progress', states)
      → preload: ipcRenderer.on → invokes registered callbacks
        → useTorrents hook: store.upsertMany(states)
          → Zustand: immutable state update
            → React: only affected rows re-render
```

### 3.3 Directory Structure

```
my-torrent-client/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── electron.vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── electron-builder.yml
└── src/
    ├── main/
    │   ├── main.ts              # Electron window bootstrap
    │   ├── preload.ts           # contextBridge API surface
    │   ├── torrentEngine.ts     # WebTorrent wrapper + EventEmitter
    │   ├── ipcHandlers.ts       # ipcMain channel registration
    │   ├── persistence.ts       # Save/restore torrents.json
    │   ├── logger.ts            # electron-log setup
    │   └── __tests__/
    │       ├── torrentEngine.test.ts
    │       └── persistence.test.ts
    ├── renderer/
    │   ├── index.html           # CSP headers here
    │   ├── main.tsx             # React entry point
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── AddTorrent.tsx
    │   │   ├── TorrentList.tsx
    │   │   ├── TorrentRow.tsx
    │   │   ├── ProgressBar.tsx
    │   │   ├── SpeedIndicator.tsx
    │   │   └── Toaster.tsx
    │   ├── hooks/
    │   │   └── useTorrents.ts
    │   ├── store/
    │   │   └── torrentStore.ts
    │   ├── utils/
    │   │   └── format.ts        # bytes, duration formatters
    │   └── styles/
    │       └── index.css
    └── shared/                  # Isomorphic — no Node or browser APIs
        ├── types.ts
        ├── channels.ts
        └── schemas.ts
```

---

## 4. Shared Types (`src/shared/types.ts`)

```ts
// =====================================================================
// Domain types
// =====================================================================

export type TorrentStatus =
  | 'idle'
  | 'metadata'      // fetching metadata
  | 'downloading'
  | 'seeding'
  | 'paused'
  | 'done'
  | 'error';

export interface TorrentFile {
  readonly name: string;
  readonly path: string;        // relative path within torrent
  readonly length: number;      // bytes
  readonly progress: number;    // 0..1
}

export interface TorrentState {
  readonly infoHash: string;          // primary key
  readonly magnetURI: string;
  readonly name: string;
  readonly status: TorrentStatus;
  readonly totalLength: number;       // bytes; 0 until metadata
  readonly downloaded: number;        // bytes
  readonly uploaded: number;          // bytes
  readonly downloadSpeed: number;     // bytes/sec
  readonly uploadSpeed: number;       // bytes/sec
  readonly progress: number;          // 0..1
  readonly numPeers: number;
  readonly timeRemaining: number;     // ms; use -1 for unknown/Infinity
  readonly ratio: number;
  readonly savePath: string;
  readonly files: ReadonlyArray<TorrentFile>;
  readonly addedAt: number;           // epoch ms
  readonly error?: string;
}

// =====================================================================
// IPC payloads (request/response)
// =====================================================================

export interface AddTorrentRequest {
  readonly source:
    | { readonly kind: 'magnet'; readonly uri: string }
    | { readonly kind: 'file'; readonly buffer: ArrayBuffer; readonly fileName: string };
  readonly savePath: string;
}

export interface AddTorrentResponse {
  readonly infoHash: string;
}

export interface RemoveTorrentRequest {
  readonly infoHash: string;
  readonly deleteFiles: boolean;
}

export interface PauseTorrentRequest {
  readonly infoHash: string;
}

export interface ResumeTorrentRequest {
  readonly infoHash: string;
}

export interface ChooseSavePathResponse {
  readonly path: string | null; // null if user cancelled
}

export interface ProgressBroadcast {
  readonly torrents: ReadonlyArray<TorrentState>;
  readonly timestamp: number;
}

export interface TorrentDoneBroadcast {
  readonly infoHash: string;
  readonly savePath: string;
}

export interface TorrentErrorBroadcast {
  readonly infoHash?: string;
  readonly message: string;
  readonly code?: string;
}

// =====================================================================
// Result envelope (consistent error handling)
// =====================================================================

export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

// =====================================================================
// Window-exposed API contract (preload bridge)
// =====================================================================

export interface TorrentAPI {
  addTorrent: (req: AddTorrentRequest) => Promise<Result<AddTorrentResponse>>;
  removeTorrent: (req: RemoveTorrentRequest) => Promise<Result<void>>;
  pauseTorrent: (req: PauseTorrentRequest) => Promise<Result<void>>;
  resumeTorrent: (req: ResumeTorrentRequest) => Promise<Result<void>>;
  listTorrents: () => Promise<Result<ReadonlyArray<TorrentState>>>;
  chooseSavePath: () => Promise<Result<ChooseSavePathResponse>>;
  openSavePath: (infoHash: string) => Promise<Result<void>>;

  // Subscriptions return an unsubscribe function
  onProgress: (cb: (b: ProgressBroadcast) => void) => () => void;
  onDone: (cb: (b: TorrentDoneBroadcast) => void) => () => void;
  onError: (cb: (b: TorrentErrorBroadcast) => void) => () => void;
}

declare global {
  interface Window {
    readonly api: TorrentAPI;
  }
}
```

---

## 5. IPC Channel Constants (`src/shared/channels.ts`)

```ts
export const IPC = {
  // Renderer -> Main (invoke/handle)
  Add:         'torrent:add',
  Remove:      'torrent:remove',
  Pause:       'torrent:pause',
  Resume:      'torrent:resume',
  List:        'torrent:list',
  ChoosePath:  'dialog:choose-save-path',
  OpenPath:    'shell:open-save-path',

  // Main -> Renderer (send/on)
  Progress:    'torrent:progress',
  Done:        'torrent:done',
  Error:       'torrent:error',
} as const;

export type IpcChannel = typeof IPC[keyof typeof IPC];
```

---

## 6. Zod Schemas (`src/shared/schemas.ts`)

```ts
import { z } from 'zod';

export const MagnetSchema = z.string().regex(
  /^magnet:\?xt=urn:btih:[A-Fa-f0-9]{40,64}([&].*)?$/,
  'Invalid magnet URI'
);

export const InfoHashSchema = z.string().regex(
  /^[A-Fa-f0-9]{40}$/,
  'Invalid info hash'
);

export const AddTorrentRequestSchema = z.object({
  source: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('magnet'), uri: MagnetSchema }),
    z.object({
      kind: z.literal('file'),
      buffer: z.instanceof(ArrayBuffer),
      fileName: z.string().min(1).max(255),
    }),
  ]),
  savePath: z.string().min(1),
});

export const RemoveTorrentRequestSchema = z.object({
  infoHash: InfoHashSchema,
  deleteFiles: z.boolean(),
});
```

---

## 7. Main Process

### 7.1 `src/main/main.ts`

```ts
import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import log from 'electron-log/main';
import { registerIpcHandlers } from './ipcHandlers';
import { TorrentEngine } from './torrentEngine';
import { Persistence } from './persistence';

const isDev = process.env.NODE_ENV === 'development';

let mainWindow: BrowserWindow | null = null;
let engine: TorrentEngine | null = null;

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
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  log.initialize();
  const persistence = new Persistence(app.getPath('userData'));
  engine = new TorrentEngine({ persistence, log });
  await engine.start();

  await createWindow();
  if (mainWindow) registerIpcHandlers(mainWindow, engine);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async () => {
  await engine?.shutdown();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  await engine?.shutdown();
});
```

### 7.2 `src/main/preload.ts`

```ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPC } from '../shared/channels';
import type {
  TorrentAPI,
  ProgressBroadcast,
  TorrentDoneBroadcast,
  TorrentErrorBroadcast,
} from '../shared/types';

const subscribe = <T>(channel: string, cb: (payload: T) => void): (() => void) => {
  const handler = (_e: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

const api: TorrentAPI = {
  addTorrent:     (req) => ipcRenderer.invoke(IPC.Add, req),
  removeTorrent:  (req) => ipcRenderer.invoke(IPC.Remove, req),
  pauseTorrent:   (req) => ipcRenderer.invoke(IPC.Pause, req),
  resumeTorrent:  (req) => ipcRenderer.invoke(IPC.Resume, req),
  listTorrents:   ()    => ipcRenderer.invoke(IPC.List),
  chooseSavePath: ()    => ipcRenderer.invoke(IPC.ChoosePath),
  openSavePath:   (h)   => ipcRenderer.invoke(IPC.OpenPath, h),
  onProgress:     (cb)  => subscribe<ProgressBroadcast>(IPC.Progress, cb),
  onDone:         (cb)  => subscribe<TorrentDoneBroadcast>(IPC.Done, cb),
  onError:        (cb)  => subscribe<TorrentErrorBroadcast>(IPC.Error, cb),
};

contextBridge.exposeInMainWorld('api', api);
```

### 7.3 `src/main/torrentEngine.ts`

```ts
import WebTorrent, { Torrent } from 'webtorrent';
import { EventEmitter } from 'node:events';
import type {
  TorrentState,
  TorrentStatus,
  TorrentFile,
  AddTorrentRequest,
} from '../shared/types';
import type { Persistence } from './persistence';

export interface EngineDeps {
  readonly persistence: Persistence;
  readonly log: { info: (m: string) => void; error: (m: string, e?: unknown) => void };
}

const TICK_MS = 1000;

export class TorrentEngine extends EventEmitter {
  private client: WebTorrent.Instance | null = null;
  private tickHandle: NodeJS.Timeout | null = null;
  private readonly paused = new Set<string>();
  private readonly savePaths = new Map<string, string>(); // infoHash -> savePath

  constructor(private readonly deps: EngineDeps) { super(); }

  async start(): Promise<void> {
    this.client = new WebTorrent();
    this.client.on('error', (err) => this.emit('error', String(err)));
    this.tickHandle = setInterval(() => this.tick(), TICK_MS);

    const saved = await this.deps.persistence.load();
    for (const t of saved) {
      try {
        await this.add({ source: { kind: 'magnet', uri: t.magnetURI }, savePath: t.savePath });
      } catch (e) {
        this.deps.log.error('restore failed', e);
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.tickHandle) clearInterval(this.tickHandle);
    await this.deps.persistence.save(this.snapshot());
    await new Promise<void>((res) => this.client?.destroy(() => res()));
    this.client = null;
  }

  add(req: AddTorrentRequest): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.client) return reject(new Error('engine not started'));
      const id = req.source.kind === 'magnet'
        ? req.source.uri
        : Buffer.from(req.source.buffer);
      this.client.add(id, { path: req.savePath }, (torrent) => {
        this.savePaths.set(torrent.infoHash, req.savePath);
        this.wireEvents(torrent);
        resolve(torrent.infoHash);
      });
    });
  }

  remove(infoHash: string, deleteFiles: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const t = this.client?.get(infoHash);
      if (!t) return reject(new Error(`torrent ${infoHash} not found`));
      t.destroy({ destroyStore: deleteFiles }, (err) => {
        if (err) reject(err);
        else { this.paused.delete(infoHash); this.savePaths.delete(infoHash); resolve(); }
      });
    });
  }

  pause(infoHash: string): void {
    const t = this.client?.get(infoHash);
    if (!t) throw new Error(`torrent ${infoHash} not found`);
    t.pause();
    this.paused.add(infoHash);
  }

  resume(infoHash: string): void {
    const t = this.client?.get(infoHash);
    if (!t) throw new Error(`torrent ${infoHash} not found`);
    t.resume();
    this.paused.delete(infoHash);
  }

  list(): ReadonlyArray<TorrentState> { return this.snapshot(); }

  private wireEvents(t: Torrent): void {
    t.on('done', () => this.emit('done', t.infoHash, t.path));
    t.on('error', (e) => this.emit('error', String(e), t.infoHash));
  }

  private tick(): void { this.emit('progress', this.snapshot()); }

  private snapshot(): ReadonlyArray<TorrentState> {
    if (!this.client) return [];
    return this.client.torrents.map((t) => this.toState(t));
  }

  private toState(t: Torrent): TorrentState {
    const status: TorrentStatus =
      this.paused.has(t.infoHash) ? 'paused'
      : t.done                    ? 'seeding'
      : t.ready                   ? 'downloading'
      : 'metadata';

    const files: TorrentFile[] = t.files.map((f) => ({
      name: f.name,
      path: f.path,
      length: f.length,
      progress: f.progress,
    }));

    return {
      infoHash: t.infoHash,
      magnetURI: t.magnetURI,
      name: t.name ?? '(unknown)',
      status,
      totalLength: t.length ?? 0,
      downloaded: t.downloaded,
      uploaded: t.uploaded,
      downloadSpeed: t.downloadSpeed,
      uploadSpeed: t.uploadSpeed,
      progress: t.progress,
      numPeers: t.numPeers,
      timeRemaining: Number.isFinite(t.timeRemaining) ? t.timeRemaining : -1,
      ratio: t.ratio,
      savePath: this.savePaths.get(t.infoHash) ?? t.path,
      files,
      addedAt: Date.now(),
    };
  }
}
```

### 7.4 `src/main/ipcHandlers.ts`

```ts
import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { IPC } from '../shared/channels';
import { AddTorrentRequestSchema, InfoHashSchema, RemoveTorrentRequestSchema } from '../shared/schemas';
import type { TorrentEngine } from './torrentEngine';
import type { Result } from '../shared/types';

const ok  = <T>(data: T): Result<T> => ({ ok: true, data });
const err = (code: string, message: string): Result<never> => ({ ok: false, error: { code, message } });

export function registerIpcHandlers(win: BrowserWindow, engine: TorrentEngine): void {
  ipcMain.handle(IPC.Add, async (_e, raw) => {
    const parsed = AddTorrentRequestSchema.safeParse(raw);
    if (!parsed.success) return err('VALIDATION', parsed.error.message);
    try { const infoHash = await engine.add(parsed.data); return ok({ infoHash }); }
    catch (e) { return err('ADD_FAILED', String(e)); }
  });

  ipcMain.handle(IPC.Remove, async (_e, raw) => {
    const parsed = RemoveTorrentRequestSchema.safeParse(raw);
    if (!parsed.success) return err('VALIDATION', parsed.error.message);
    try { await engine.remove(parsed.data.infoHash, parsed.data.deleteFiles); return ok(undefined); }
    catch (e) { return err('REMOVE_FAILED', String(e)); }
  });

  ipcMain.handle(IPC.Pause, async (_e, raw) => {
    const hash = InfoHashSchema.safeParse(raw?.infoHash);
    if (!hash.success) return err('VALIDATION', 'invalid infoHash');
    try { engine.pause(hash.data); return ok(undefined); }
    catch (e) { return err('PAUSE_FAILED', String(e)); }
  });

  ipcMain.handle(IPC.Resume, async (_e, raw) => {
    const hash = InfoHashSchema.safeParse(raw?.infoHash);
    if (!hash.success) return err('VALIDATION', 'invalid infoHash');
    try { engine.resume(hash.data); return ok(undefined); }
    catch (e) { return err('RESUME_FAILED', String(e)); }
  });

  ipcMain.handle(IPC.List, async () => ok(engine.list()));

  ipcMain.handle(IPC.ChoosePath, async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Choose download folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    return ok({ path: result.canceled ? null : result.filePaths[0] ?? null });
  });

  ipcMain.handle(IPC.OpenPath, async (_e, infoHash) => {
    const t = engine.list().find((x) => x.infoHash === infoHash);
    if (!t) return err('NOT_FOUND', 'torrent not found');
    await shell.openPath(t.savePath);
    return ok(undefined);
  });

  // Engine -> Renderer broadcasts
  engine.on('progress', (torrents) => {
    if (!win.isDestroyed())
      win.webContents.send(IPC.Progress, { torrents, timestamp: Date.now() });
  });
  engine.on('done', (infoHash, savePath) => {
    if (!win.isDestroyed())
      win.webContents.send(IPC.Done, { infoHash, savePath });
  });
  engine.on('error', (message, infoHash) => {
    if (!win.isDestroyed())
      win.webContents.send(IPC.Error, { message, infoHash });
  });
}
```

### 7.5 `src/main/persistence.ts`

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { TorrentState } from '../shared/types';

interface PersistedTorrent {
  readonly magnetURI: string;
  readonly savePath: string;
  readonly infoHash: string;
}

export class Persistence {
  private readonly file: string;

  constructor(userDataDir: string) {
    this.file = path.join(userDataDir, 'torrents.json');
  }

  async load(): Promise<ReadonlyArray<PersistedTorrent>> {
    try { return JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch { return []; }
  }

  async save(states: ReadonlyArray<TorrentState>): Promise<void> {
    const data: PersistedTorrent[] = states.map((s) => ({
      magnetURI: s.magnetURI,
      savePath: s.savePath,
      infoHash: s.infoHash,
    }));
    await fs.writeFile(this.file, JSON.stringify(data, null, 2), 'utf8');
  }
}
```

---

## 8. Renderer Process

### 8.1 Component Tree

```
<App>
├── <Header />
├── <AddTorrent />
│     └── (uses window.api.addTorrent + chooseSavePath)
├── <TorrentList>
│    ├── <TorrentRow torrent={t}>
│    │     ├── <ProgressBar value={t.progress} status={t.status} />
│    │     ├── <SpeedIndicator down={t.downloadSpeed} up={t.uploadSpeed} />
│    │     └── <TorrentActions onPause onResume onRemove onOpen />
│    └── ...
└── <Toaster />
```

### 8.2 Component Prop Types

```ts
// AddTorrent.tsx
export interface AddTorrentProps {
  readonly onAdded?: (infoHash: string) => void;
}

// TorrentList.tsx
export type TorrentAction = 'pause' | 'resume' | 'remove' | 'open';
export interface TorrentListProps {
  readonly torrents: ReadonlyArray<TorrentState>;
  readonly onAction: (action: TorrentAction, infoHash: string) => void;
}

// TorrentRow.tsx
export interface TorrentRowProps {
  readonly torrent: TorrentState;
  readonly onAction: (action: TorrentAction) => void;
}

// ProgressBar.tsx
export interface ProgressBarProps {
  readonly value: number;          // 0..1
  readonly status: TorrentStatus;
  readonly indeterminate?: boolean;
}

// SpeedIndicator.tsx
export interface SpeedIndicatorProps {
  readonly down: number;           // bytes/sec
  readonly up: number;             // bytes/sec
}
```

### 8.3 `src/renderer/store/torrentStore.ts`

```ts
import { create } from 'zustand';
import type { TorrentState } from '../../shared/types';

interface ErrorEntry {
  readonly id: string;
  readonly message: string;
}

interface TorrentStore {
  byHash: Record<string, TorrentState>;
  errors: ReadonlyArray<ErrorEntry>;
  upsertMany: (list: ReadonlyArray<TorrentState>) => void;
  remove: (infoHash: string) => void;
  pushError: (message: string) => void;
  dismissError: (id: string) => void;
}

export const useTorrentStore = create<TorrentStore>((set) => ({
  byHash: {},
  errors: [],

  upsertMany: (list) => set((s) => {
    const next = { ...s.byHash };
    for (const t of list) next[t.infoHash] = t;
    // remove torrents no longer reported by engine
    const presentHashes = new Set(list.map((t) => t.infoHash));
    for (const k of Object.keys(next)) if (!presentHashes.has(k)) delete next[k];
    return { byHash: next };
  }),

  remove: (infoHash) => set((s) => {
    const next = { ...s.byHash };
    delete next[infoHash];
    return { byHash: next };
  }),

  pushError: (message) => set((s) => ({
    errors: [...s.errors, { id: crypto.randomUUID(), message }],
  })),

  dismissError: (id) => set((s) => ({
    errors: s.errors.filter((e) => e.id !== id),
  })),
}));
```

### 8.4 `src/renderer/hooks/useTorrents.ts`

```ts
import { useEffect } from 'react';
import { useTorrentStore } from '../store/torrentStore';

export function useTorrents() {
  const byHash = useTorrentStore((s) => s.byHash);
  const upsertMany = useTorrentStore((s) => s.upsertMany);
  const pushError = useTorrentStore((s) => s.pushError);

  useEffect(() => {
    let mounted = true;

    window.api.listTorrents().then((r) => {
      if (mounted && r.ok) upsertMany(r.data);
    });

    const offProgress = window.api.onProgress(({ torrents }) => upsertMany(torrents));
    const offError = window.api.onError(({ message }) => pushError(message));
    const offDone = window.api.onDone(() => { /* optional: play sound or show toast */ });

    return () => {
      mounted = false;
      offProgress();
      offError();
      offDone();
    };
  }, [upsertMany, pushError]);

  return { torrents: Object.values(byHash) };
}
```

### 8.5 `src/renderer/App.tsx`

```tsx
import { AddTorrent } from './components/AddTorrent';
import { TorrentList } from './components/TorrentList';
import { Toaster } from './components/Toaster';
import { useTorrents } from './hooks/useTorrents';
import type { TorrentAction } from './components/TorrentList';

export default function App() {
  const { torrents } = useTorrents();

  const onAction = async (action: TorrentAction, infoHash: string) => {
    if (action === 'pause')  await window.api.pauseTorrent({ infoHash });
    if (action === 'resume') await window.api.resumeTorrent({ infoHash });
    if (action === 'remove') await window.api.removeTorrent({ infoHash, deleteFiles: false });
    if (action === 'open')   await window.api.openSavePath(infoHash);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-xl font-semibold">WebTorrent Desktop</h1>
      </header>
      <main className="p-6 space-y-6">
        <AddTorrent />
        <TorrentList torrents={torrents} onAction={onAction} />
      </main>
      <Toaster />
    </div>
  );
}
```

### 8.6 `src/renderer/index.html` (with CSP)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WebTorrent Desktop</title>
  </head>
  <body class="bg-slate-950">
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

### 8.7 `src/renderer/utils/format.ts`

```ts
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatETA(ms: number): string {
  if (ms < 0) return 'Unknown';
  if (ms === 0) return 'Done';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
```

---

## 9. IPC Contract Reference

| Channel | Direction | Request Type | Response Type | Notes |
|---------|-----------|--------------|---------------|-------|
| `torrent:add` | R→M invoke | `AddTorrentRequest` | `Result<AddTorrentResponse>` | Validates with zod |
| `torrent:remove` | R→M invoke | `RemoveTorrentRequest` | `Result<void>` | `deleteFiles=true` deletes blobs |
| `torrent:pause` | R→M invoke | `PauseTorrentRequest` | `Result<void>` | Idempotent |
| `torrent:resume` | R→M invoke | `ResumeTorrentRequest` | `Result<void>` | Idempotent |
| `torrent:list` | R→M invoke | `void` | `Result<TorrentState[]>` | Snapshot |
| `dialog:choose-save-path` | R→M invoke | `void` | `Result<ChooseSavePathResponse>` | Native dialog |
| `shell:open-save-path` | R→M invoke | `string` (infoHash) | `Result<void>` | Opens OS file manager |
| `torrent:progress` | M→R send | — | `ProgressBroadcast` | Every 1s |
| `torrent:done` | M→R send | — | `TorrentDoneBroadcast` | Once per torrent |
| `torrent:error` | M→R send | — | `TorrentErrorBroadcast` | Engine/network errors |

---

## 10. Error Handling Strategy

| Layer | Strategy |
|-------|----------|
| **WebTorrent engine** | Subscribe to `'error'` on both client and each torrent; forward via `EventEmitter` |
| **TorrentEngine** | All public methods return `Promise<T>` and reject with typed errors |
| **IPC handlers** | Validate input with zod; wrap all `engine.*` calls in try/catch; always return `Result<T>` envelope |
| **Preload bridge** | Pure pass-through; wraps `ipcRenderer.invoke` so renderer always sees `Result<T>` |
| **React UI** | Error boundary at `<App>` root; toasts for user-visible errors; `electron-log` for debug |

**Standard error codes:**

| Code | When |
|------|------|
| `VALIDATION` | Input fails zod schema |
| `NOT_FOUND` | infoHash not in client |
| `ADD_FAILED` | WebTorrent add rejected |
| `REMOVE_FAILED` | Destroy failed |
| `PAUSE_FAILED` / `RESUME_FAILED` | Engine state error |
| `DISK_FULL` | ENOSPC from fs |
| `PERMISSION_DENIED` | EACCES from fs |
| `NETWORK` | DHT/tracker failures (non-fatal) |

---

## 11. Testing Strategy

### 11.1 Unit Tests (Vitest)

- `shared/schemas.ts` — magnet regex edge cases, valid/invalid info hashes
- `main/torrentEngine.ts` — mock WebTorrent client; assert `toState` mapping
- `main/persistence.ts` — load/save round-trip with `os.tmpdir()`
- `renderer/store/torrentStore.ts` — `upsertMany` immutability, removal of stale torrents
- `renderer/utils/format.ts` — byte/speed/ETA formatting edge cases
- Components — `<ProgressBar>`, `<SpeedIndicator>` snapshot tests

### 11.2 Integration Tests

- IPC round-trip: spin up `ipcMain` with a fake renderer; assert `add → progress → done` flow
- Engine + persistence: add a magnet, call `shutdown`, restart engine, verify restoration

### 11.3 E2E Tests (Playwright `_electron`)

```ts
// e2e/torrent.spec.ts
test('downloads Sintel and shows 100% progress', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  // paste magnet
  await window.fill('[data-testid="magnet-input"]', SINTEL_MAGNET);
  await window.click('[data-testid="add-btn"]');
  // wait for progress to reach 100%
  await window.waitForSelector('[data-testid="progress"][data-value="1"]', { timeout: 300_000 });
  await app.close();
});
```

### 11.4 Coverage Targets

| Scope | Lines | Branches |
|-------|-------|---------|
| `shared/` | 100% | 100% |
| `main/` | 85% | 80% |
| `renderer/components/` | 75% | 70% |
| Overall | **80%** | **75%** |

Enforced in CI via `vitest --coverage` with `coverageThreshold`.

---

## 12. Implementation Phases

### Phase 1 — Setup & Prototyping (1–2 days)

**Goal:** Running Electron window with Tailwind UI and a working IPC ping.

Files to create:
- `package.json`, `tsconfig.json`, `tsconfig.node.json`, `electron.vite.config.ts`
- `tailwind.config.ts`, `postcss.config.js`, `src/renderer/styles/index.css`
- `.eslintrc.cjs`, `.prettierrc`
- `src/main/main.ts` (minimal BrowserWindow)
- `src/main/preload.ts` (ping/pong channel)
- `src/renderer/main.tsx`, `src/renderer/App.tsx` (Hello World)
- `src/shared/channels.ts` (with `'ping'`)

Tasks:
1. Scaffold: `npm create @quick-start/electron -- . --template react-ts`
2. Add Tailwind + PostCSS, configure JIT
3. Implement `'ping'` IPC round-trip; display response in UI
4. Verify `contextIsolation: true` + `sandbox: true` work end-to-end

Acceptance criteria:
- [ ] `npm run dev` opens window with Tailwind-styled content
- [ ] IPC ping returns "pong"
- [ ] ESLint and TypeScript compile with zero errors

---

### Phase 2 — Torrent Engine (2–3 days)

**Goal:** Working torrent engine with IPC channels and persistence.

Files to create/extend:
- `src/shared/types.ts`, `src/shared/channels.ts`, `src/shared/schemas.ts`
- `src/main/torrentEngine.ts`
- `src/main/persistence.ts`
- `src/main/ipcHandlers.ts`
- `src/main/logger.ts`
- `src/main/__tests__/torrentEngine.test.ts`
- `src/main/__tests__/persistence.test.ts`

Tasks:
1. Implement `TorrentEngine`: `start`, `shutdown`, `add`, `remove`, `pause`, `resume`, `list`
2. Wire `setInterval(1000)` → `'progress'` emission → IPC broadcast
3. Register all IPC handlers with zod validation + `Result<T>` envelope
4. Persist torrent list to `userData/torrents.json` on shutdown
5. Unit test state mapping with mocked WebTorrent client

Acceptance criteria:
- [ ] `engine.add('<magnet>')` resolves with `infoHash` within 30s
- [ ] Progress event fires every ~1s with torrent data
- [ ] `done` event fires when download completes
- [ ] App restart restores previously added torrents

---

### Phase 3 — UI (3–4 days)

**Goal:** Fully functional React UI connected to the engine.

Files to create:
- `src/renderer/store/torrentStore.ts`
- `src/renderer/hooks/useTorrents.ts`
- `src/renderer/components/AddTorrent.tsx`
- `src/renderer/components/TorrentList.tsx`
- `src/renderer/components/TorrentRow.tsx`
- `src/renderer/components/ProgressBar.tsx`
- `src/renderer/components/SpeedIndicator.tsx`
- `src/renderer/components/Toaster.tsx`
- `src/renderer/utils/format.ts`
- Component tests under `__tests__/`

Tasks:
1. `AddTorrent`: magnet textarea + drag-drop zone for `.torrent` files (`FileReader.readAsArrayBuffer`)
2. `chooseSavePath` flow before `addTorrent` (with default fallback to Downloads)
3. Bind Zustand store via `useTorrents`; render `TorrentList`
4. `ProgressBar` with smooth CSS transition + status badge colour
5. Action buttons (pause/resume/remove/open folder) wired to IPC
6. `Toaster` for engine error events

Acceptance criteria:
- [ ] Pasting a magnet → path picker → row appears within metadata fetch
- [ ] Progress bar animates smoothly as events arrive
- [ ] Pause/Resume/Remove/Open buttons work correctly
- [ ] Errors surface as dismissable toast notifications

---

### Phase 4 — Hardening & Packaging (2–3 days)

**Goal:** Production-ready packaged app with CI pipeline.

Files to create:
- `electron-builder.yml`
- `playwright.config.ts`, `e2e/torrent.spec.ts`
- `.github/workflows/ci.yml`

Tasks:
1. Add React error boundary; forward renderer errors to main via `'log'` IPC channel
2. Security audit: verify CSP, `contextIsolation`, path validation, zod schemas
3. E2E test: Sintel magnet download to completion
4. Configure `electron-builder` for macOS (dmg), Windows (nsis), Linux (AppImage)
5. CI: lint → typecheck → unit tests → build → E2E on PR
6. Performance pass: confirm 1Hz IPC cadence; profile React DevTools for unnecessary re-renders

Acceptance criteria:
- [ ] `npm run build && npm run dist` produces installers on all 3 platforms
- [ ] E2E test passes in CI headless mode
- [ ] All MVP checklist items verified on macOS, Windows, Linux
- [ ] Memory usage < 500 MB during active download

---

## 13. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebTorrent native deps fail to compile | Medium | High | Pin Electron + Node ABI; use `electron-rebuild`; prebuilt binaries in CI matrix |
| IPC progress storms cause UI jank | Medium | Medium | 1Hz throttle in engine; `React.memo` on TorrentRow; per-hash Zustand selectors |
| `webtorrent` accidentally imported in renderer | Low | High | ESLint rule banning `webtorrent` in `src/renderer/**` |
| Metadata never resolves (dead magnet) | Medium | Low | 60s timeout; surface "no peers found" as torrent status |
| User picks restricted path (`/System`, `C:\Windows`) | Low | Medium | `fs.access(path, fs.constants.W_OK)` check before accepting |
| Disk full mid-download | Low | High | Subscribe to `'error'`; pause torrent; show actionable toast |
| BEP-52 v2 magnet hashes (sha256, 64 hex chars) | Medium | Low | Extend regex; track webtorrent v2 upstream support |
| Memory leak from un-removed IPC listeners | Medium | Medium | Always `return () => off*()` in `useEffect`; verify with DevTools heap snapshot |
| Cross-platform path separator bugs | Medium | Medium | Always `path.join()`; never string-concatenate path fragments |
| Auto-update channel hijacked | Low | Critical | Code-sign all releases; pin GitHub Releases provider; verify checksums |

---

## 14. MVP Checklist

| # | Requirement | Done When |
|---|-------------|-----------|
| 1 | Accept a magnet link or `.torrent` file | User pastes a magnet URI **or** drops a `.torrent` file; row appears within 30s of metadata fetch; malformed inputs show clear error toast |
| 2 | Display metadata (file name, total size) | Row shows `name`, human-formatted `totalLength` (e.g., "1.42 GB"), and file count once metadata resolves |
| 3 | Show real-time download speed and progress | Progress bar updates at ~1Hz; `downloadSpeed` shown in human units (e.g., "5.32 MB/s"); peer count visible; ETA displayed |
| 4 | Assemble file on disk and stop | On `'done'`: status flips to `seeding`; file(s) exist at `savePath` with correct sizes; "Open folder" reveals them in OS file manager |

---

## 15. Quick-Start Commands

```bash
# Scaffold
npm create @quick-start/electron@latest my-torrent-client -- --template react-ts
cd my-torrent-client

# Install production deps
npm i webtorrent zustand zod electron-log clsx

# Install dev deps
npm i -D tailwindcss postcss autoprefixer vitest @testing-library/react \
         @testing-library/user-event playwright @playwright/test \
         eslint prettier typescript

# Init Tailwind
npx tailwindcss init -p

# Dev server
npm run dev

# Unit tests
npm test

# E2E tests
npm run test:e2e

# Build + package
npm run build
npm run dist
```

**Public test magnet (Sintel, Creative Commons):**
```
magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel
```
