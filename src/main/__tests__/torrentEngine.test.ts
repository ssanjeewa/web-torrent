// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TorrentEngine } from '../torrentEngine'
import type { Persistence } from '../persistence'

const INFO_HASH = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2'

const makeMockTorrent = (overrides = {}) => ({
  infoHash: INFO_HASH,
  magnetURI: `magnet:?xt=urn:btih:${INFO_HASH}`,
  name: 'Test Torrent',
  length: 1_000_000,
  downloaded: 500_000,
  uploaded: 0,
  downloadSpeed: 2000,
  uploadSpeed: 0,
  progress: 0.5,
  numPeers: 3,
  timeRemaining: 250_000,
  ratio: 0,
  path: '/tmp/downloads',
  files: [{ name: 'video.mp4', path: 'video.mp4', length: 1_000_000, progress: 0.5 }],
  done: false,
  ready: true,
  pause: vi.fn(),
  resume: vi.fn(),
  destroy: vi.fn((_opts, cb) => cb?.()),
  on: vi.fn(),
  ...overrides
})

const makeMockClient = (torrent = makeMockTorrent()) => ({
  torrents: [torrent],
  add: vi.fn((_id, _opts, cb) => cb?.(torrent)),
  get: vi.fn(() => torrent),
  destroy: vi.fn((cb) => cb?.()),
  on: vi.fn()
})

vi.mock('webtorrent', () => ({
  default: vi.fn()
}))

const makeDeps = () => ({
  persistence: {
    load: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined)
  } as unknown as Persistence,
  log: {
    info: vi.fn(),
    error: vi.fn()
  }
})

describe('TorrentEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts and sets up tick interval', async () => {
    const mockTorrent = makeMockTorrent()
    const mockClient = makeMockClient(mockTorrent)
    const { default: WebTorrent } = await import('webtorrent')
    vi.mocked(WebTorrent).mockImplementation(() => mockClient as unknown as InstanceType<typeof WebTorrent>)

    const engine = new TorrentEngine(makeDeps())
    await engine.start()

    expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function))
    await engine.shutdown()
  })

  it('maps torrent to TorrentState correctly', async () => {
    const mockTorrent = makeMockTorrent()
    const mockClient = makeMockClient(mockTorrent)
    const { default: WebTorrent } = await import('webtorrent')
    vi.mocked(WebTorrent).mockImplementation(() => mockClient as unknown as InstanceType<typeof WebTorrent>)

    const engine = new TorrentEngine(makeDeps())
    await engine.start()

    await engine.add({
      source: { kind: 'magnet', uri: `magnet:?xt=urn:btih:${INFO_HASH}` },
      savePath: '/tmp/downloads'
    })

    const [state] = engine.list()
    expect(state.infoHash).toBe(INFO_HASH)
    expect(state.name).toBe('Test Torrent')
    expect(state.status).toBe('downloading')
    expect(state.progress).toBe(0.5)
    expect(state.numPeers).toBe(3)
    expect(state.files).toHaveLength(1)
    expect(state.savePath).toBe('/tmp/downloads')

    await engine.shutdown()
  })

  it('marks torrent as paused after pause()', async () => {
    const mockTorrent = makeMockTorrent()
    const mockClient = makeMockClient(mockTorrent)
    const { default: WebTorrent } = await import('webtorrent')
    vi.mocked(WebTorrent).mockImplementation(() => mockClient as unknown as InstanceType<typeof WebTorrent>)

    const engine = new TorrentEngine(makeDeps())
    await engine.start()

    await engine.add({
      source: { kind: 'magnet', uri: `magnet:?xt=urn:btih:${INFO_HASH}` },
      savePath: '/tmp'
    })

    engine.pause(INFO_HASH)
    expect(mockTorrent.pause).toHaveBeenCalled()
    const [state] = engine.list()
    expect(state.status).toBe('paused')

    await engine.shutdown()
  })

  it('marks torrent as downloading after resume()', async () => {
    const mockTorrent = makeMockTorrent()
    const mockClient = makeMockClient(mockTorrent)
    const { default: WebTorrent } = await import('webtorrent')
    vi.mocked(WebTorrent).mockImplementation(() => mockClient as unknown as InstanceType<typeof WebTorrent>)

    const engine = new TorrentEngine(makeDeps())
    await engine.start()

    await engine.add({
      source: { kind: 'magnet', uri: `magnet:?xt=urn:btih:${INFO_HASH}` },
      savePath: '/tmp'
    })

    engine.pause(INFO_HASH)
    engine.resume(INFO_HASH)
    expect(mockTorrent.resume).toHaveBeenCalled()
    const [state] = engine.list()
    expect(state.status).toBe('downloading')

    await engine.shutdown()
  })

  it('returns -1 for timeRemaining when Infinity', async () => {
    const mockTorrent = makeMockTorrent({ timeRemaining: Infinity })
    const mockClient = makeMockClient(mockTorrent)
    const { default: WebTorrent } = await import('webtorrent')
    vi.mocked(WebTorrent).mockImplementation(() => mockClient as unknown as InstanceType<typeof WebTorrent>)

    const engine = new TorrentEngine(makeDeps())
    await engine.start()
    await engine.add({
      source: { kind: 'magnet', uri: `magnet:?xt=urn:btih:${INFO_HASH}` },
      savePath: '/tmp'
    })

    const [state] = engine.list()
    expect(state.timeRemaining).toBe(-1)

    await engine.shutdown()
  })

  it('restores torrents from persistence on start', async () => {
    const mockTorrent = makeMockTorrent()
    const mockClient = makeMockClient(mockTorrent)
    const { default: WebTorrent } = await import('webtorrent')
    vi.mocked(WebTorrent).mockImplementation(() => mockClient as unknown as InstanceType<typeof WebTorrent>)

    const deps = makeDeps()
    deps.persistence.load = vi.fn().mockResolvedValue([
      { infoHash: INFO_HASH, magnetURI: `magnet:?xt=urn:btih:${INFO_HASH}`, savePath: '/tmp' }
    ])

    const engine = new TorrentEngine(deps)
    await engine.start()

    expect(mockClient.add).toHaveBeenCalledTimes(1)

    await engine.shutdown()
  })
})
