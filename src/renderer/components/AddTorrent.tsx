import { ChangeEvent, DragEvent, useRef, useState } from 'react'
import clsx from 'clsx'
import type { AddTorrentRequest } from '../../shared/types'
import { useTorrentStore } from '../store/torrentStore'

export interface AddTorrentProps {
  readonly onAdded?: (infoHash: string) => void
}

export function AddTorrent({ onAdded }: AddTorrentProps) {
  const [magnet, setMagnet] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pushError = useTorrentStore((s) => s.pushError)

  const doAdd = async (source: AddTorrentRequest['source']) => {
    setIsAdding(true)
    try {
      const pathResult = await window.api.chooseSavePath()
      if (!pathResult.ok) {
        pushError(pathResult.error.message)
        return
      }
      const savePath = pathResult.data.path
      if (!savePath) return // user cancelled dialog

      const result = await window.api.addTorrent({ source, savePath })
      if (result.ok) {
        setMagnet('')
        onAdded?.(result.data.infoHash)
      } else {
        pushError(result.error.message)
      }
    } finally {
      setIsAdding(false)
    }
  }

  const handleSubmitMagnet = () => {
    const uri = magnet.trim()
    if (!uri) return
    doAdd({ kind: 'magnet', uri })
  }

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.torrent')) {
      pushError('Please select a .torrent file')
      return
    }
    const buffer = await file.arrayBuffer()
    doAdd({ kind: 'file', buffer, fileName: file.name })
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="space-y-3">
      {/* Magnet input row */}
      <div className="flex gap-2">
        <input
          type="text"
          data-testid="magnet-input"
          value={magnet}
          onChange={(e) => setMagnet(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmitMagnet()}
          placeholder="Paste magnet link (magnet:?xt=urn:btih:…)"
          disabled={isAdding}
          className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          data-testid="add-btn"
          onClick={handleSubmitMagnet}
          disabled={!magnet.trim() || isAdding}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
        >
          {isAdding ? 'Adding…' : 'Add'}
        </button>
      </div>

      {/* Drag-and-drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isAdding && fileInputRef.current?.click()}
        className={clsx(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          isAdding
            ? 'opacity-50 cursor-not-allowed border-slate-700'
            : isDragging
              ? 'border-blue-500 bg-blue-500/10 cursor-copy'
              : 'border-slate-700 hover:border-slate-500 cursor-pointer'
        )}
      >
        <p className="text-sm text-slate-400">
          Drop a <span className="text-slate-200 font-medium">.torrent</span> file here, or{' '}
          <span className="text-blue-400 underline">click to browse</span>
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".torrent"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
