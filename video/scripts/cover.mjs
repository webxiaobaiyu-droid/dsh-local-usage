/**
 * Render the upload cover: one static frame from `film/cover.html`.
 *
 * Bilibili asks for a 16:9 cover, and the one frame the film opens on is a
 * question rather than a product shot, so the cover is its own page.
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

const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 })
await page.goto(`file://${VIDEO_ROOT}/film/cover.html`, { waitUntil: 'load' })
await page.waitForTimeout(300)
const out = `${VIDEO_ROOT}/out/cover.png`
await page.screenshot({ path: out })
await browser.close()
console.log(`cover: ${out} (3840x2160 PNG)`)
