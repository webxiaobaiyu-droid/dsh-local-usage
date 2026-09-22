/**
 * Write a sidecar SRT from the same timings the captions were burned with.
 *
 * The film already carries burned-in captions; this file exists so the same text
 * can be uploaded as a toggleable subtitle track, and so the narration is
 * greppable without listening to the audio.
 *
 * Usage: node video/scripts/subtitles.mjs [--out video/out/promo.srt]
 *
 * @module dsh-local-usage/video/scripts/subtitles
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
/** Read one `--name value` argument. */
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

const VIDEO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const timings = JSON.parse(await readFile(`${VIDEO_ROOT}/assets/timings.json`, 'utf8'))

/** `HH:MM:SS,mmm` as SRT wants it. */
function stamp(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000))
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor(ms % 3_600_000 / 60_000)
  const secs = Math.floor(ms % 60_000 / 1000)
  const millis = ms % 1000
  const pad = (value, width) => String(value).padStart(width, '0')
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(millis, 3)}`
}

const blocks = timings.scenes.map((scene, index) => [
  String(index + 1),
  `${stamp(scene.voiceStart - 0.15)} --> ${stamp(scene.voiceEnd + 0.5)}`,
  scene.caption,
].join('\n'))

await mkdir(`${VIDEO_ROOT}/out`, { recursive: true })
const out = arg('out', `${VIDEO_ROOT}/out/dsh-local-usage-promo.srt`)
await writeFile(out, `${blocks.join('\n\n')}\n`)
console.log(`subtitles: ${out} (${blocks.length} cues)`)
