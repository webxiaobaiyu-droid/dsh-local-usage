/**
 * Mux the captured frames and the narration into the deliverable.
 *
 * The frames were rendered at 2x, so the encode downscales with Lanczos — that
 * supersampling is what keeps the panel's own 13px text readable in the 1080p
 * output. H.264 High + AAC in MP4 with a fast-start index is the combination
 * Bilibili accepts without a re-encode.
 *
 * Usage: node video/scripts/encode.mjs [--out video/out/promo.mp4]
 *
 * @module dsh-local-usage/video/scripts/encode
 */

import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const run = promisify(execFile)
const args = process.argv.slice(2)
/** Read one `--name value` argument. */
function arg(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}

const VIDEO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const FRAMES = arg('frames', `${VIDEO_ROOT}/frames`)
const AUDIO = arg('audio', `${VIDEO_ROOT}/assets/narration.wav`)
const OUT = arg('out', `${VIDEO_ROOT}/out/dsh-local-usage-promo.mp4`)
const FPS = Number(arg('fps', '30'))
const CRF = arg('crf', '18')

await mkdir(fileURLToPath(new URL('../out', import.meta.url)), { recursive: true })

await run('ffmpeg', [
  '-y', '-loglevel', 'warning', '-stats',
  '-framerate', String(FPS),
  '-start_number', '0', '-i', `${FRAMES}/f%05d.jpg`,
  '-i', AUDIO,
  '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF,
  '-profile:v', 'high', '-level', '4.2',
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-movflags', '+faststart',
  '-shortest',
  OUT,
])

const probe = async (entries, path) => {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-show_entries', entries, '-of', 'default=nw=1', path,
  ])
  return stdout.trim()
}
console.log(`encoded ${OUT}`)
console.log((await probe('format=duration,size,bit_rate', OUT)).replace(/\n/g, '  '))
console.log((await probe('stream=codec_name,width,height,r_frame_rate,sample_rate,channels', OUT)).replace(/\n/g, '  '))
