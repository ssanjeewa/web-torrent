import { describe, it, expect } from 'vitest'
import { formatBytes, formatSpeed, formatETA } from '../utils/format'

describe('formatBytes', () => {
  it('returns "0 B" for 0', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
  })

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB')
  })

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
  })

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('formats with decimals', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })
})

describe('formatSpeed', () => {
  it('appends /s suffix', () => {
    expect(formatSpeed(1024)).toBe('1 KB/s')
  })

  it('handles zero speed', () => {
    expect(formatSpeed(0)).toBe('0 B/s')
  })
})

describe('formatETA', () => {
  it('returns "Unknown" for negative values', () => {
    expect(formatETA(-1)).toBe('Unknown')
  })

  it('returns "Done" for 0', () => {
    expect(formatETA(0)).toBe('Done')
  })

  it('formats seconds', () => {
    expect(formatETA(30_000)).toBe('30s')
  })

  it('formats minutes and seconds', () => {
    expect(formatETA(90_000)).toBe('1m 30s')
  })

  it('formats hours and minutes', () => {
    expect(formatETA(3 * 3600_000 + 30 * 60_000)).toBe('3h 30m')
  })
})
