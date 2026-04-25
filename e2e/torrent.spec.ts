import { test, expect, _electron as electron } from '@playwright/test'
import path from 'node:path'

// Public domain Creative Commons torrent for testing
const SINTEL_MAGNET =
  'magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel'

test.describe('WebTorrent Desktop E2E', () => {
  test('app launches and shows empty state', async () => {
    const app = await electron.launch({
      args: [path.join(__dirname, '..', 'out', 'main', 'main.js')]
    })

    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await expect(window.locator('h1')).toContainText('WebTorrent Desktop')
    await expect(window.locator('[data-testid="magnet-input"]')).toBeVisible()
    await expect(window.getByText('No active torrents')).toBeVisible()

    await app.close()
  })

  test('shows validation feedback for invalid magnet', async () => {
    const app = await electron.launch({
      args: [path.join(__dirname, '..', 'out', 'main', 'main.js')]
    })

    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await window.fill('[data-testid="magnet-input"]', 'not-a-magnet')
    await window.click('[data-testid="add-btn"]')

    // Validation error toast should appear
    await expect(window.locator('[role="alert"]')).toBeVisible({ timeout: 5000 })

    await app.close()
  })

  /**
   * Full download integration test.
   * Skipped in CI unless WEBTORRENT_E2E=1 is set (requires real network + time).
   */
  test.skip('downloads Sintel torrent to completion', async () => {
    const app = await electron.launch({
      args: [path.join(__dirname, '..', 'out', 'main', 'main.js')]
    })

    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    await window.fill('[data-testid="magnet-input"]', SINTEL_MAGNET)
    await window.click('[data-testid="add-btn"]')

    // Wait for progress to reach 100% (5 minute timeout for large torrent)
    await window.waitForSelector('[data-testid="progress"][data-value="1"]', {
      timeout: 300_000
    })

    await app.close()
  })
})
