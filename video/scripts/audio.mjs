/**
 * Build the film's audio track from the measured narration.
 *
 * Each scene's voice is placed at the exact offset the picture was cut to:
 * `voiceStart` from `timings.json`, which is also what the captions read. A quiet
 * synthesised bed runs underneath, so the gaps between lines are not dead air —
 * the reference these cuts follow keeps audio continuous for its whole length.
 * The bed is three sine partials an octave and a fifth apart, slowed and
 * low-passed into a pad, sitting roughly 28 dB under the voice.
 *
 * Usage: node video/scripts/audio.mjs [--no-bed]
 *
 * @module dsh-local-usage/video/scripts/audio
 */

import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const VIDEO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ASSETS = `${VIDEO_ROOT}/assets`
const AUDIO = `${ASSETS}/audio`
const timings = JSON.parse(await readFile(`${ASSETS}/timings.json`, 'utf8'))
const withBed = !process.argv.includes('--no-bed')

/** Loudness target: -16 LUFS is what a web video platform expects. */
const LOUDNESS = 'loudnorm=I=-16:TP=-1.5:LRA=11'
/**
 * Bed gain. The pad leaves the filter chain around -41 dBFS, so this puts it near
 * -45 dBFS: about 24 dB under the voice, present in the gaps without competing
 * with the narration.
 */
const BED_GAIN = 0.65

/** One silent segment of `seconds`, encoded exactly like the narration. */
async function silence(seconds, path) {
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=mono`,
    '-t', seconds.toFixed(6), '-c:a', 'pcm_s16le', path,
  ])
}

await mkdir(AUDIO, { recursive: true })
const parts = []
let cursor = 0
for (const [index, scene] of timings.scenes.entries()) {
  const lead = scene.voiceStart - cursor
  if (lead > 0.0001) {
    const path = `${AUDIO}/gap-${index}.wav`
    await silence(lead, path)
    parts.push(path)
  }
  parts.push(`${VIDEO_ROOT}/${scene.file}`)
  cursor = scene.voiceEnd
}
const tail = timings.duration - cursor
if (tail > 0.0001) {
  const path = `${AUDIO}/gap-tail.wav`
  await silence(tail, path)
  parts.push(path)
}

const listPath = `${AUDIO}/concat.txt`
await writeFile(listPath, `${parts.map(path => `file '${path}'`).join('\n')}\n`)
const joined = `${AUDIO}/joined.wav`
await run('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-f', 'concat', '-safe', '0', '-i', listPath,
  '-c:a', 'pcm_s16le', joined,
])

const out = `${ASSETS}/narration.wav`
const voice = `${AUDIO}/voice.wav`
await run('ffmpeg', [
  '-y', '-loglevel', 'error', '-i', joined,
  '-af', LOUDNESS, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', voice,
])
await rm(joined, { force: true })

if (withBed) {
  const seconds = timings.duration.toFixed(3)
  const bed = `${AUDIO}/bed.wav`
  await run('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `sine=frequency=110:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=164.81:duration=${seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=220:duration=${seconds}`,
    '-filter_complex',
    '[0]volume=0.5[a];[1]volume=0.32[b];[2]volume=0.18[c];'
    + '[a][b][c]amix=inputs=3:duration=longest,'
    + 'tremolo=f=0.1:d=0.45,lowpass=f=780,aecho=0.8:0.7:140|290:0.32|0.16[bed]',
    '-map', '[bed]', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', bed,
  ])
  await run('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', voice, '-i', bed,
    '-filter_complex', `[1]volume=${BED_GAIN}[quiet];[0][quiet]amix=inputs=2:duration=first:normalize=0[out]`,
    '-map', '[out]', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', out,
  ])
  await rm(bed, { force: true })
} else {
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', voice, '-c:a', 'pcm_s16le', out])
}
await rm(voice, { force: true })

const { stdout } = await run('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', out,
])
await rm(joined, { force: true })
console.log(`audio: ${out}  ${Number(stdout.trim()).toFixed(2)}s (film is ${timings.duration.toFixed(2)}s)`)
