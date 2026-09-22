/**
 * Capture the real panel's states as PNGs for the film.
 *
 * Runs against the Vite harness in `video/panel` (start it first, or let
 * `video/build.mjs` own it) and writes `video/assets/panel-<state>.png`. Every
 * state is reached through the panel's own affordances — a range click, a
 * calendar cell, a disclosure — so the pixels are the shipping component's.
 *
 * Usage: node video/scripts/capture-panel.mjs [--port 5199] [--out video/assets]
 *
 * @module dsh-local-usage/video/scripts/capture-panel
 */

import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
/** Playwright lives in the Harness checkout's store, not in this package. */
const PLAYWRIGHT = process.env.DSH_PLAYWRIGHT
  ?? '/Users/openSource/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js'

const args = process.argv.slice(2)
/** Read one `--name value` argument. */
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

const PORT = Number(arg('port', '5199'))
const OUT = arg('out', fileURLToPath(new URL('../assets', import.meta.url)))
/** Viewport the panel is laid out in; the product's main column is this wide. */
const VIEWPORT = { width: 1680, height: 1180 }
/** Retina-ish capture: the film zooms into these, so they need headroom. */
const SCALE = 2

const { chromium } = require(PLAYWRIGHT)

/**
 * The deepest-shaded day the calendar is currently showing: the film's hero cell.
 * @param page - the loaded harness page.
 * @returns the `data-day` key of the latest level-4 cell.
 */
async function peakDay(page) {
  return page.evaluate(() => {
    const cells = [...document.querySelectorAll('.dlu-cell[data-level="4"]')]
    const last = cells[cells.length - 1] ?? document.querySelector('.dlu-cell[data-level="3"]')
    return last?.getAttribute('data-day') ?? null
  })
}

/** Open one `<details>` disclosure by the text of its summary. */
async function openDisclosure(page, text) {
  await page.evaluate(label => {
    const summary = [...document.querySelectorAll('summary')]
      .find(node => (node.textContent ?? '').trim() === label)
    summary?.closest('details')?.setAttribute('open', '')
  }, text)
}

await mkdir(OUT, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ['--force-color-profile=srgb', '--font-render-hinting=none'],
})
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: SCALE })
page.on('pageerror', error => { console.error('[pageerror]', String(error).slice(0, 300)) })

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => Boolean(window.__panel), null, { timeout: 30_000 })
await page.evaluate(() => window.__panel.ready)

/** Screenshot one element after settling, and report its size. */
async function shot(name, selector = '.dlu-panel') {
  await page.waitForTimeout(120)
  const target = page.locator(selector).first()
  const box = await target.boundingBox()
  await target.screenshot({ path: `${OUT}/panel-${name}.png` })
  console.log(`  panel-${name}.png  ${Math.round(box?.width ?? 0)}x${Math.round(box?.height ?? 0)} (css px)`)
}

// 1. The year view, which is the panel's headline surface.
await page.evaluate(() => window.__panel.setRange('全年'))
await shot('year-light')
await shot('calendar-light', '.dlu-calendar')

// 2. The same view in the product's dark theme.
await page.evaluate(() => window.__panel.setTheme('dark'))
await shot('year-dark')
await page.evaluate(() => window.__panel.setTheme('light'))

// 3. A hover card on the busiest day: the drill-down affordance.
const peak = await peakDay(page)
if (peak === null) throw new Error('capture-panel: the calendar shows no shaded day')
console.log(`  hover card on ${peak}`)
await page.hover(`.dlu-cell[data-day="${peak}"]`)
await shot('tooltip-light')
// Park the pointer: the hover card is positioned by the cursor and would
// otherwise sit on top of every later capture.
await page.mouse.move(8, 8)
await page.waitForTimeout(200)

// 4. One day's own page, split by working directory.
await page.evaluate(day => window.__panel.openDay(day), peak)
await shot('day-light')
await page.evaluate(() => window.__panel.setTheme('dark'))
await shot('day-dark')
await page.evaluate(() => window.__panel.setTheme('light'))
await page.evaluate(() => window.__panel.back())

// 5. The two disclosures that carry the panel's provenance.
await page.evaluate(() => window.__panel.setRange('全年'))
await openDisclosure(page, '计价方式')
await shot('pricing-light')
await openDisclosure(page, '用量依据')
await shot('provenance-light')

await browser.close()
console.log(`captured panel states into ${OUT}`)
