import { formatSpeed } from '../utils/format'

export interface SpeedIndicatorProps {
  readonly down: number
  readonly up: number
}

export function SpeedIndicator({ down, up }: SpeedIndicatorProps) {
  return (
    <div className="flex items-center gap-3 tabular-nums">
      <span>↓ {formatSpeed(down)}</span>
      <span>↑ {formatSpeed(up)}</span>
    </div>
  )
}
