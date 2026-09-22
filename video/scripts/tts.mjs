/**
 * Render the narration and publish the timings.
 *
 * Two engines, one output contract:
 *  - `edge` (default): Microsoft's neural voices through `edge-tts`. These are
 *    the ones that sound like a person reading a script; the macOS `say` voices
 *    are concatenative and it shows.
 *  - `say`: the system voice, used as a fallback when `edge-tts` is not
 *    installed, so the pipeline still builds without it.
 *
 * Either way every line is measured with `ffprobe` and the scene boundaries are
 * written to `assets/timings.json` and `film/timings.js`. The film's cuts, its
 * captions and the audio offsets all read that one file, so editing the copy
 * re-times the video instead of desynchronising it.
 *
 * Usage:
 *   node video/scripts/tts.mjs
 *   node video/scripts/tts.mjs --engine say --voice Tingting
 *   EDGE_TTS_BIN=.venv-tts/bin/edge-tts node video/scripts/tts.mjs
 *
 * @module dsh-local-usage/video/scripts/tts
 */

import { execFile } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)

const args = process.argv.slice(2)
/** Read one `--name value` argument. */
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

/** Silence before the voice starts in a scene. */
const LEAD_IN_SECONDS = Number(arg('lead', '0.7'))
/** Silence after the voice ends, so a cut never clips a syllable. */
const HOLD_SECONDS = Number(arg('hold', '0.95'))
/** Extra air after the final scene, which the end card fades through. */
const OUTRO_SECONDS = Number(arg('outro', '1.5'))

const VIDEO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGE_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const ASSETS = `${VIDEO_ROOT}/assets`
const AUDIO = `${ASSETS}/audio`
const script = JSON.parse(await readFile(`${VIDEO_ROOT}/narration.json`, 'utf8'))
const engine = arg('engine', script.engine ?? 'edge')
const voice = arg('voice', script.voice ?? 'zh-CN-YunxiNeural')
const rate = arg('rate', String(script.rate ?? '+6%'))

/** Seconds of one media file, measured rather than assumed. */
async function durationOf(path) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path,
  ])
  return Number(stdout.trim())
}

/** Locate the `edge-tts` console script without assuming where it was installed. */
async function edgeBinary() {
  const explicit = process.env.EDGE_TTS_BIN ?? arg('edge-tts', null)
  if (explicit !== null) return explicit
  for (const candidate of [`${PACKAGE_ROOT}/.venv-tts/bin/edge-tts`, 'edge-tts']) {
    try {
      await run(candidate, ['--version'])
      return candidate
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

/** One line of narration as a 48 kHz mono WAV. */
async function speak(text, out, binary) {
  if (engine === 'say') {
    const aiff = `${out}.aiff`
    await run('say', ['-v', voice, '-r', rate.replace(/[^0-9]/g, '') || '185', '-o', aiff, text])
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-ar', '48000', '-ac', '1', out])
    await rm(aiff, { force: true })
    return
  }
  const mp3 = `${out}.mp3`
  await run(binary, ['--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', mp3])
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp3, '-ar', '48000', '-ac', '1', out])
  await rm(mp3, { force: true })
}

const binary = engine === 'say' ? null : await edgeBinary()
if (engine !== 'say' && binary === null) {
  console.error('tts: edge-tts not found — install it (python3 -m venv .venv-tts && '
    + '.venv-tts/bin/pip install edge-tts) or pass --engine say')
  process.exit(1)
}

await rm(AUDIO, { recursive: true, force: true })
await mkdir(AUDIO, { recursive: true })

const scenes = []
for (const [index, scene] of script.scenes.entries()) {
  const stem = `${String(index).padStart(2, '0')}-${scene.id}`
  const wav = `${AUDIO}/${stem}.wav`
  await speak(scene.text, wav, binary)
  const speech = await durationOf(wav)
  scenes.push({
    id: scene.id,
    kicker: scene.kicker,
    title: scene.title,
    qualifier: scene.qualifier,
    facts: scene.facts,
    text: scene.text,
    caption: scene.caption ?? scene.text,
    file: `assets/audio/${stem}.wav`,
    speech,
    leadIn: index === 0 ? 0.35 : LEAD_IN_SECONDS,
    hold: index === script.scenes.length - 1 ? HOLD_SECONDS + OUTRO_SECONDS : HOLD_SECONDS,
  })
}

let cursor = 0
const timeline = scenes.map(scene => {
  const start = cursor
  const end = start + scene.leadIn + scene.speech + scene.hold
  cursor = end
  return {
    ...scene,
    start,
    end,
    voiceStart: start + scene.leadIn,
    voiceEnd: start + scene.leadIn + scene.speech,
  }
})

const payload = { engine, voice, rate, duration: cursor, scenes: timeline }
await writeFile(`${ASSETS}/timings.json`, `${JSON.stringify(payload, null, 2)}\n`)

// The film page is loaded over `file://` while frames are captured, where a
// `fetch` of the JSON would be blocked. A generated script is the one form the
// page can read from disk without a server.
await mkdir(`${VIDEO_ROOT}/film`, { recursive: true })
await writeFile(`${VIDEO_ROOT}/film/timings.js`,
  `/** Generated by video/scripts/tts.mjs — scene boundaries measured from the narration. */\n`
  + `window.__TIMINGS = ${JSON.stringify(payload, null, 2)}\n`)

for (const scene of timeline) {
  console.log(`  ${scene.id.padEnd(9)} ${scene.speech.toFixed(2)}s  →  ${scene.start.toFixed(2)}–${scene.end.toFixed(2)}s`)
}
console.log(`narration total ${cursor.toFixed(2)}s across ${timeline.length} scenes (${engine}: ${voice} @ ${rate})`)
