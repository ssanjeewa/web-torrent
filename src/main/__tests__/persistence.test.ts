// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Persistence } from '../persistence'
import type { TorrentState } from '../../shared/types'

let tmpDir: string
let persistence: Persistence

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wt-test-'))
  persistence = new Persistence(tmpDir)
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

const makeState = (overrides: Partial<TorrentState> = {}): TorrentState => ({
  infoHash: 'a'.repeat(40),
  magnetURI: 'magnet:?xt=urn:btih:' + 'a'.repeat(40),
  name: 'Test Torrent',
  status: 'downloading',
  totalLength: 1_000_000,
  downloaded: 500_000,
  uploaded: 0,
  downloadSpeed: 1000,
  uploadSpeed: 0,
  progress: 0.5,
  numPeers: 5,
  timeRemaining: 500_000,
  ratio: 0,
  savePath: '/tmp/downloads',
  files: [],
  addedAt: Date.now(),
  ...overrides
})

describe('Persistence', () => {
  it('returns empty array when file does not exist', async () => {
    const result = await persistence.load()
    expect(result).toEqual([])
  })

  it('saves and loads torrents correctly', async () => {
    const state = makeState()
    await persistence.save([state])

    const loaded = await persistence.load()
    expect(loaded).toHaveLength(1)
    expect(loaded[0]).toEqual({
      magnetURI: state.magnetURI,
      savePath: state.savePath,
      infoHash: state.infoHash
    })
  })

  it('handles multiple torrents', async () => {
    const states = [
      makeState({ infoHash: 'a'.repeat(40) }),
      makeState({ infoHash: 'b'.repeat(40), magnetURI: 'magnet:?xt=urn:btih:' + 'b'.repeat(40) })
    ]
    await persistence.save(states)

    const loaded = await persistence.load()
    expect(loaded).toHaveLength(2)
  })

  it('filters out states without magnetURI', async () => {
    const state = makeState({ magnetURI: '' })
    await persistence.save([state])

    const loaded = await persistence.load()
    expect(loaded).toHaveLength(0)
  })

  it('returns empty array when file contains invalid JSON', async () => {
    await fs.writeFile(path.join(tmpDir, 'torrents.json'), 'not-json')
    const result = await persistence.load()
    expect(result).toEqual([])
  })

  it('returns empty array when file contains non-array JSON', async () => {
    await fs.writeFile(path.join(tmpDir, 'torrents.json'), JSON.stringify({ key: 'value' }))
    const result = await persistence.load()
    expect(result).toEqual([])
  })

  it('overwrites existing file on save', async () => {
    const first = makeState({ infoHash: 'a'.repeat(40) })
    await persistence.save([first])

    const second = makeState({ infoHash: 'b'.repeat(40), magnetURI: 'magnet:?xt=urn:btih:' + 'b'.repeat(40) })
    await persistence.save([second])

    const loaded = await persistence.load()
    expect(loaded).toHaveLength(1)
    expect(loaded[0].infoHash).toBe('b'.repeat(40))
  })
})
