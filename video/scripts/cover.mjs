/**
 * Render the upload covers: one static frame per page in `film/cover*.html`.
 *
 * Bilibili asks for a 16:9 cover, and the one frame the film opens on is a
 * question rather than a product shot, so the covers are their own pages.
 * The 4:3 variant re-stacks the same story for feeds that crop tall.
 *
 * Usage: node video/scripts/cover.mjs
 *
 * @module dsh-local-usage/video/scripts/cover
 */

import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const PLAYWRIGHT = process.env.DSH_PLAYWRIGHT
  ?? '/Users/openSource/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js'
const { chromium } = require(PLAYWRIGHT)

const VIDEO_ROOT = fileURLToPath(new URL('..', import.meta.url))
await mkdir(`${VIDEO_ROOT}/out`, { recursive: true })

/** Every cover the pipeline ships, as (page, CSS viewport, output name). */
const COVERS = [
  { html: 'cover.html', width: 1920, height: 1080, out: 'cover.png' },
  { html: 'cover-16x9.html', width: 1920, height: 1080, out: 'cover-16x9.png' },
  { html: 'cover-4x3.html', width: 1600, height: 1200, out: 'cover-4x3.png' },
]

const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] })
for (const cover of COVERS) {
  const page = await browser.newPage({
    viewport: { width: cover.width, height: cover.height },
    deviceScaleFactor: 2,
  })
  await page.goto(`file://${VIDEO_ROOT}/film/${cover.html}`, { waitUntil: 'load' })
  await page.waitForTimeout(300)
  const out = `${VIDEO_ROOT}/out/${cover.out}`
  await page.screenshot({ path: out })
  await page.close()
  console.log(`cover: ${out} (${cover.width * 2}x${cover.height * 2} PNG)`)
}
await browser.close()
