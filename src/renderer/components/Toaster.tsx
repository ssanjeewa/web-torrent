import { useTorrentStore } from '../store/torrentStore'

export function Toaster() {
  const errors = useTorrentStore((s) => s.errors)
  const dismissError = useTorrentStore((s) => s.dismissError)

  if (errors.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50 max-w-sm">
      {errors.map((error) => (
        <div
          key={error.id}
          role="alert"
          className="flex items-start gap-3 bg-red-950 border border-red-800 rounded-lg px-4 py-3 shadow-lg"
        >
          <p className="text-sm text-red-200 flex-1">{error.message}</p>
          <button
            onClick={() => dismissError(error.id)}
            aria-label="Dismiss"
            className="text-red-400 hover:text-red-200 text-xl leading-none mt-0.5 shrink-0"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
