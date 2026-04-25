import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/__tests__/setup.ts'],
    environmentMatchGlobs: [
      ['src/main/**', 'node']
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        branches: 75
      },
      exclude: [
        'node_modules/**',
        'out/**',
        'dist/**',
        'e2e/**',
        '**/*.config.*',
        '**/__tests__/**'
      ]
    }
  }
})
