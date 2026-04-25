# WebTorrent Desktop

A secure, open-source BitTorrent client for macOS built with Electron, React, and TypeScript — powered by the [WebTorrent](https://webtorrent.io) engine.

**Developed by [Sanjeewa Silva](https://github.com/ssanjeewa)**

---

## What Is This?

WebTorrent Desktop is a native macOS torrent client that runs as a desktop application using web technologies. Unlike browser-based torrent tools that are sandboxed to WebRTC-only peers, this app runs WebTorrent in Electron's Node.js main process — giving it full access to the file system, TCP/UDP networking, and the standard BitTorrent DHT peer network.

### Key Features

- **Add torrents** via magnet link (paste) or `.torrent` file (drag-and-drop or file picker)
- **Real-time progress** — download speed, upload speed, peer count, ETA, and progress bar updated every second
- **Pause / Resume / Stop Seeding** at any stage including during metadata fetch
- **Per-file priority** — mark individual files as High, Normal, or Skip before or during download
- **File browser** — expand any torrent row to see all files with individual progress bars
- **Persistent sessions** — torrents are saved on shutdown and restored on next launch
- **Native save-path picker** — choose exactly where each torrent downloads
- **Open folder** — reveal the download location in Finder with one click
- **Security-first renderer** — `contextIsolation`, `sandbox`, `nodeIntegration: false`, strict CSP

---

## How It Works

The app is split into two Electron processes that communicate over a typed IPC bridge:

```
┌─────────────────────────────────────────────────────────┐
│                   Electron Application                   │
│                                                         │
│  Main Process (Node.js)          Renderer (React/Vite)  │
│  ─────────────────────           ───────────────────    │
│  WebTorrent engine               Zustand state store     │
│  File system access              Tailwind CSS UI         │
│  Native dialogs                  Typed window.api        │
│  IPC handlers (zod validated)    ← contextBridge         │
│                                                         │
│  ← DHT · Trackers · TCP/UTP/WebRTC peers                │
└─────────────────────────────────────────────────────────┘
```

**Data flow:**

1. User pastes a magnet link and clicks **Add**
2. A native folder picker opens (`dialog.showOpenDialog`)
3. The renderer sends `torrent:add` via `ipcRenderer.invoke` — validated with Zod before the engine touches it
4. The WebTorrent engine adds the torrent and begins fetching metadata from the DHT / peers
5. Every 1 second the engine snapshots all torrent states and broadcasts them to the renderer via `webContents.send`
6. Zustand updates immutably → only the changed rows re-render

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 31 |
| Build system | electron-vite 2 + Vite 5 |
| Torrent engine | WebTorrent 2 (ESM, BitTorrent + WebRTC) |
| UI framework | React 18 + TypeScript 5 |
| Styling | Tailwind CSS 3 |
| State | Zustand 4 |
| IPC validation | Zod 3 |
| Logging | electron-log 5 |
| Testing | Vitest + Playwright |
| Packaging | electron-builder |

---

## Installation

### Prerequisites

- **macOS 12 (Monterey) or later**
- **Node.js 20 LTS** — [download](https://nodejs.org)
- **npm 9+** (bundled with Node.js)

### 1. Clone the repository

```bash
git clone https://github.com/ssanjeewa/webtorrent-desktop.git
cd webtorrent-desktop
```

### 2. Install dependencies

```bash
npm install
```

> Native dependencies are rebuilt for Electron automatically via the `postinstall` script.

---

## Running the App

### Development mode

```bash
npm run dev
```

Opens the Electron window with Vite HMR. DevTools open automatically. Logs stream to the terminal.

### Production build

```bash
npm run build
```

Compiles TypeScript, bundles the renderer, and outputs to `out/`.

### Package for distribution

```bash
# macOS (DMG — universal x64 + arm64)
npm run dist:mac

# All platforms
npm run dist
```

Packaged installers are written to `dist/`.

---

## Running Tests

```bash
# Unit tests (Vitest)
npm test

# Unit tests with coverage report
npm run test:coverage

# End-to-end tests (Playwright + Electron)
npm run test:e2e
```

---

## Project Structure

```
src/
├── main/                  # Node.js main process
│   ├── main.ts            # Electron window bootstrap
│   ├── preload.ts         # contextBridge API surface (window.api)
│   ├── torrentEngine.ts   # WebTorrent wrapper + state snapshots
│   ├── ipcHandlers.ts     # IPC channel registration + Zod validation
│   ├── persistence.ts     # Save / restore torrents.json
│   └── logger.ts          # electron-log configuration
│
├── renderer/              # React frontend (Chromium)
│   ├── App.tsx
│   ├── components/
│   │   ├── AddTorrent.tsx      # Magnet input + drag-and-drop zone
│   │   ├── TorrentList.tsx     # List of active torrents
│   │   ├── TorrentRow.tsx      # Single torrent card with actions
│   │   ├── FileList.tsx        # Per-file breakdown (collapsible)
│   │   ├── FileItem.tsx        # File row with mini progress + priority
│   │   ├── PrioritySelector.tsx # High / Normal / Skip toggle
│   │   ├── ProgressBar.tsx
│   │   ├── SpeedIndicator.tsx
│   │   └── Toaster.tsx         # Error notifications
│   ├── hooks/
│   │   └── useTorrents.ts      # Subscribes to IPC progress broadcasts
│   ├── store/
│   │   └── torrentStore.ts     # Zustand store (immutable updates)
│   └── utils/
│       └── format.ts           # Bytes, speed, ETA formatters
│
└── shared/                # Isomorphic — no Node or browser APIs
    ├── types.ts            # TorrentState, TorrentAPI, Result<T>, …
    ├── channels.ts         # IPC channel name constants
    └── schemas.ts          # Zod schemas for IPC input validation
```

---

## Security

This application is built with Electron security best practices:

| Setting | Value | Why |
|---------|-------|-----|
| `contextIsolation` | `true` | Renderer cannot access Node.js APIs directly |
| `nodeIntegration` | `false` | No `require()` in the renderer |
| `sandbox` | `true` | Renderer runs in OS-level sandbox |
| `webSecurity` | `true` | No mixed content or cross-origin relaxation |
| Content-Security-Policy | Strict | Blocks inline scripts and external resources |
| IPC input validation | Zod schemas | All renderer input validated before reaching the engine |
| `contextBridge` | Narrow typed API | Only explicitly whitelisted methods exposed to the renderer |

The renderer process has **zero** direct access to the file system, network, or WebTorrent engine. All communication goes through the validated `window.api` bridge.

---

## License

MIT License

Copyright (c) 2026 Sanjeewa Silva

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
