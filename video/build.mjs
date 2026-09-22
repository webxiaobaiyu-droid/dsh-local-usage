/**
 * Build the promo film end to end.
 *
 * Steps, in order, because each one consumes the previous one's output:
 *   1. serve `video/panel` (the real panel, synthetic data) and capture its states;
 *   2. synthesise the narration and measure it, which fixes the timeline;
 *   3. walk the film's timeline and write one image per frame;
 *   4. lay the narration onto the timeline's own offsets;
 *   5. mux the two into the MP4.
 *
 * Usage:
 *   node video/build.mjs                       # everything
 *   node video/build.mjs --skip-panel          # reuse the captured panel states
 *   node video/build.mjs --skip-frames         # re-encode from existing frames
 *
 * @module dsh-local-usage/video/build
 */

import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const argv = process.argv.slice(2)
const VIDEO_ROOT = fileURLToPath(new URL('.', import.meta.url))
const PACKAGE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PORT = Number(process.env.PANEL_PORT ?? 5199)
/** Vitest brings Vite into the store; the package does not depend on it directly. */
const VITE = `${PACKAGE_ROOT}/node_modules/.pnpm/vite@8.3.0/node_modules/vite/bin/vite.js`

/** Run one stage, streaming its output, and fail the build on a non-zero exit. */
async function stage(title, file, args = []) {
  console.log(`\n== ${title}`)
  await run(process.execPath, [file, ...args], { cwd: PACKAGE_ROOT, stdio: 'inherit' })
}

/** Poll the harness until it answers, so the capture never races the dev server. */
async function waitForPort(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // Not listening yet.
    }
    if (Date.now() > deadline) throw new Error(`build: ${url} never came up`)
    await new Promise(resolve => setTimeout(resolve, 250))
  }
}

let vite
try {
  if (!argv.includes('--skip-panel')) {
    console.log('== panel harness')
    vite = spawn(process.execPath, [VITE, '--config', 'video/panel/vite.config.mjs'], {
      cwd: PACKAGE_ROOT,
      stdio: ['ignore', 'ignore', 'inherit'],
    })
    await waitForPort(`http://127.0.0.1:${PORT}/`)
    await stage('capture panel states', `${VIDEO_ROOT}/scripts/capture-panel.mjs`)
  } else {
    console.log('== panel harness (skipped)')
  }

  await stage('narration', `${VIDEO_ROOT}/scripts/tts.mjs`)
  if (!argv.includes('--skip-frames')) {
    await stage('frames', `${VIDEO_ROOT}/scripts/frames.mjs`)
  } else {
    console.log('\n== frames (skipped)')
  }
  await stage('audio', `${VIDEO_ROOT}/scripts/audio.mjs`)
  await stage('subtitles', `${VIDEO_ROOT}/scripts/subtitles.mjs`)
  await stage('cover', `${VIDEO_ROOT}/scripts/cover.mjs`)
  await stage('encode', `${VIDEO_ROOT}/scripts/encode.mjs`)
} finally {
  if (vite !== undefined && vite.exitCode === null) {
    vite.kill('SIGTERM')
    console.log('\npanel harness stopped')
  }
}
