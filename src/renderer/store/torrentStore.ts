import { create } from 'zustand'
import type { TorrentState } from '../../shared/types'

interface ErrorEntry {
  readonly id: string
  readonly message: string
}

interface TorrentStore {
  byHash: Record<string, TorrentState>
  errors: ReadonlyArray<ErrorEntry>
  upsertMany: (list: ReadonlyArray<TorrentState>) => void
  remove: (infoHash: string) => void
  pushError: (message: string) => void
  dismissError: (id: string) => void
}

export const useTorrentStore = create<TorrentStore>((set) => ({
  byHash: {},
  errors: [],

  upsertMany: (list) =>
    set((s) => {
      const next = { ...s.byHash }
      for (const t of list) next[t.infoHash] = t
      // Remove torrents no longer reported by the engine
      const present = new Set(list.map((t) => t.infoHash))
      for (const k of Object.keys(next)) if (!present.has(k)) delete next[k]
      return { byHash: next }
    }),

  remove: (infoHash) =>
    set((s) => {
      const next = { ...s.byHash }
      delete next[infoHash]
      return { byHash: next }
    }),

  pushError: (message) =>
    set((s) => ({
      errors: [...s.errors, { id: crypto.randomUUID(), message }]
    })),

  dismissError: (id) =>
    set((s) => ({
      errors: s.errors.filter((e) => e.id !== id)
    }))
}))
