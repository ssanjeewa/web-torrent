import { describe, it, expect, beforeEach } from 'vitest'
import { useTorrentStore } from '../store/torrentStore'
import type { TorrentState } from '../../shared/types'

const makeState = (infoHash: string, overrides: Partial<TorrentState> = {}): TorrentState => ({
  infoHash,
  magnetURI: `magnet:?xt=urn:btih:${infoHash}`,
  name: 'Test',
  status: 'downloading',
  totalLength: 1000,
  downloaded: 500,
  uploaded: 0,
  downloadSpeed: 100,
  uploadSpeed: 0,
  progress: 0.5,
  numPeers: 2,
  timeRemaining: 5000,
  ratio: 0,
  savePath: '/tmp',
  files: [],
  addedAt: Date.now(),
  ...overrides
})

beforeEach(() => {
  useTorrentStore.setState({ byHash: {}, errors: [] })
})

describe('torrentStore', () => {
  describe('upsertMany', () => {
    it('adds new torrents', () => {
      const t = makeState('a'.repeat(40))
      useTorrentStore.getState().upsertMany([t])
      const state = useTorrentStore.getState()
      expect(Object.keys(state.byHash)).toHaveLength(1)
      expect(state.byHash['a'.repeat(40)]).toEqual(t)
    })

    it('updates existing torrents immutably', () => {
      const t1 = makeState('a'.repeat(40))
      useTorrentStore.getState().upsertMany([t1])
      const beforeByHash = useTorrentStore.getState().byHash

      const t2 = makeState('a'.repeat(40), { progress: 0.9 })
      useTorrentStore.getState().upsertMany([t2])
      const afterByHash = useTorrentStore.getState().byHash

      expect(afterByHash['a'.repeat(40)].progress).toBe(0.9)
      expect(beforeByHash).not.toBe(afterByHash)
    })

    it('removes torrents no longer present', () => {
      const t1 = makeState('a'.repeat(40))
      const t2 = makeState('b'.repeat(40))
      useTorrentStore.getState().upsertMany([t1, t2])
      useTorrentStore.getState().upsertMany([t1])

      const state = useTorrentStore.getState()
      expect(Object.keys(state.byHash)).toHaveLength(1)
      expect(state.byHash['b'.repeat(40)]).toBeUndefined()
    })

    it('handles empty list by clearing all torrents', () => {
      useTorrentStore.getState().upsertMany([makeState('a'.repeat(40))])
      useTorrentStore.getState().upsertMany([])
      expect(Object.keys(useTorrentStore.getState().byHash)).toHaveLength(0)
    })
  })

  describe('remove', () => {
    it('removes a torrent by hash', () => {
      useTorrentStore.getState().upsertMany([makeState('a'.repeat(40))])
      useTorrentStore.getState().remove('a'.repeat(40))
      expect(useTorrentStore.getState().byHash['a'.repeat(40)]).toBeUndefined()
    })

    it('is idempotent for unknown hash', () => {
      useTorrentStore.getState().remove('unknown'.padEnd(40, '0'))
      expect(Object.keys(useTorrentStore.getState().byHash)).toHaveLength(0)
    })
  })

  describe('errors', () => {
    it('pushes an error with unique id', () => {
      useTorrentStore.getState().pushError('Something went wrong')
      const { errors } = useTorrentStore.getState()
      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('Something went wrong')
      expect(errors[0].id).toBeTruthy()
    })

    it('dismisses an error by id', () => {
      useTorrentStore.getState().pushError('Error 1')
      useTorrentStore.getState().pushError('Error 2')
      const { errors } = useTorrentStore.getState()
      useTorrentStore.getState().dismissError(errors[0].id)
      expect(useTorrentStore.getState().errors).toHaveLength(1)
      expect(useTorrentStore.getState().errors[0].message).toBe('Error 2')
    })
  })
})
