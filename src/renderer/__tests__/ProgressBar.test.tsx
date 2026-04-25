import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBar } from '../components/ProgressBar'

describe('ProgressBar', () => {
  it('renders with correct width', () => {
    render(<ProgressBar value={0.5} status="downloading" />)
    const bar = screen.getByTestId('progress')
    expect(bar).toHaveStyle({ width: '50%' })
  })

  it('clamps value at 100%', () => {
    render(<ProgressBar value={1.5} status="seeding" />)
    const bar = screen.getByTestId('progress')
    expect(bar).toHaveStyle({ width: '100%' })
  })

  it('clamps value at 0%', () => {
    render(<ProgressBar value={-0.1} status="error" />)
    const bar = screen.getByTestId('progress')
    expect(bar).toHaveStyle({ width: '0%' })
  })

  it('applies correct color class for downloading', () => {
    render(<ProgressBar value={0.3} status="downloading" />)
    expect(screen.getByTestId('progress')).toHaveClass('bg-blue-500')
  })

  it('applies correct color class for seeding', () => {
    render(<ProgressBar value={1} status="seeding" />)
    expect(screen.getByTestId('progress')).toHaveClass('bg-green-500')
  })

  it('applies pulse animation when indeterminate', () => {
    render(<ProgressBar value={0} status="metadata" indeterminate />)
    expect(screen.getByTestId('progress')).toHaveClass('animate-pulse')
  })
})
