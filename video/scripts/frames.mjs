/**
 * Walk the film's timeline and write one image per output frame.
 *
 * The page owns the animation: this script only advances `window.__film.render`
 * and captures. Frames are JPEG, because they are intermediate — the encoder
 * consumes them and deletes them — and 2x, because the film is downscaled to
 * 1080p at the end, which is what keeps the panel's own text crisp.
 *
 * Usage:
 *   node video/scripts/frames.mjs                    # every frame at 30 fps
 *   node video/scripts/frames.mjs --probe 3,12,20    # single instants, for review
 *
 * @module dsh-local-usage/video/scripts/frames
 */

import { mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const PLAYWRIGHT = process.env.DSH_PLAYWRIGHT
  ?? '/Users/openSource/deepseek-harness/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core/index.js'
const { chromium } = require(PLAYWRIGHT)

const args = process.argv.slice(2)
/** Read one `--name value` argument. */
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

const VIDEO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const FILM = `${VIDEO_ROOT}/film/index.html`
const FPS = Number(arg('fps', '30'))
const SCALE = Number(arg('scale', '2'))
const probe = arg('probe', null)
const OUT = arg('out', probe === null ? `${VIDEO_ROOT}/frames` : `${VIDEO_ROOT}/probe`)
const QUALITY = Number(arg('quality', '92'))

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] })
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: SCALE,
})
page.on('pageerror', error => { console.error('[pageerror]', String(error).slice(0, 400)) })
await page.goto(`file://${FILM}`, { waitUntil: 'load' })
await page.waitForFunction(() => Boolean(window.__film), null, { timeout: 20_000 })
const duration = await page.evaluate(() => window.__film.duration)

/** Capture the frame at `t` into `name`. */
async function capture(t, name) {
  await page.evaluate(time => window.__film.render(time), t)
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: QUALITY })
}

if (probe !== null) {
  const times = probe.split(',').map(value => Number(value.trim()))
  for (const [index, t] of times.entries()) {
    await capture(t, String(index).padStart(2, '0'))
    console.log(`  probe ${String(t).padStart(6)}s → ${String(index).padStart(2, '0')}.jpg`)
  }
  console.log(`probed ${times.length} frames into ${OUT} (film is ${duration.toFixed(2)}s)`)
} else {
  const total = Math.round(duration * FPS)
  const started = Date.now()
  for (let index = 0; index < total; index += 1) {
    await capture(index / FPS, `f${String(index).padStart(5, '0')}`)
    if (index % 120 === 0) {
      const done = (index + 1) / total
      const eta = done > 0 ? (Date.now() - started) / done * (1 - done) / 1000 : 0
      console.log(`  frame ${index + 1}/${total}  ${(done * 100).toFixed(0)}%  eta ${eta.toFixed(0)}s`)
    }
  }
  console.log(`wrote ${total} frames at ${FPS} fps into ${OUT} (${duration.toFixed(2)}s)`)
}

await browser.close()
