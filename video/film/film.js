/**
 * The film's timeline.
 *
 * `render(t)` is total: for any time in `[0, duration]` it writes every animated
 * property the frame needs — the chrome's strings, each layer's opacity, the
 * rings, the typing. Scene boundaries and copy come from `timings.js`, which the
 * narration step generates from measured audio, so retiming the voice re-times
 * the picture without touching this file.
 *
 * Nothing here reads the clock: the caller owns `t`, which is what makes the
 * capture reproducible frame for frame.
 *
 * @module dsh-local-usage/video/film
 */

const TIMINGS = window.__TIMINGS

/** Element lookup that fails loudly: a renamed node must break the build, not the frame. */
function need(id) {
  const node = document.getElementById(id)
  if (node === null) throw new Error(`film: #${id} is missing`)
  return node
}

const stage = need('stage')
const chrome = {
  kicker: need('kicker'),
  title: need('title'),
  qualifier: need('qualifier'),
  facts: need('facts'),
}
const subs = need('subs')
const subsLine = need('subs-line')
const progress = need('progress')

const layers = {
  intro: need('layer-intro'),
  source: need('layer-source'),
  calendar: need('layer-calendar'),
  day: need('layer-day'),
  pricing: need('layer-pricing'),
  install: need('layer-install'),
  outro: need('layer-outro'),
}

/** Smoothstep over `[from, to]`, clamped outside it. */
function ramp(t, from, to) {
  const p = Math.min(1, Math.max(0, (t - from) / (to - from)))
  return p * p * (3 - 2 * p)
}

/** Opacity and lift of an element entering at `from` and settling at `to`. */
function enter(node, t, from, to, distance = 20) {
  const p = ramp(t, from, to)
  node.style.opacity = String(p)
  node.style.transform = `translateY(${((1 - p) * distance).toFixed(2)}px)`
}

/** Place a ring and fade it in across its own window. */
function ring(node, t, from, to, box) {
  node.style.left = `${box.left}px`
  node.style.top = `${box.top}px`
  node.style.width = `${box.width}px`
  node.style.height = `${box.height}px`
  node.style.opacity = String(ramp(t, from, to))
}

/* Geometry in stage pixels, derived from each capture's own CSS size.
 *  - the calendar closeup is 1322x279 shown at 1712 wide (k = 1.295);
 *  - the day page is 1680x441 shown at 1712 (k = 1.019);
 *  - the panel band behind the hover card is the same shot, scrolled to y 300. */

const CAL = { left: 104, top: 424, k: 1712 / 1322 }
const DAY = { left: 104, top: 424, k: 1712 / 1680 }
const BAND = { left: 104, top: 424, k: 1712 / 1680, scroll: 300 }

/** Translate a rectangle from a capture's own CSS pixels into stage pixels. */
function place(frame, box) {
  return {
    left: Math.round(frame.left + box.x * frame.k),
    top: Math.round(frame.top + (box.y - (frame.scroll ?? 0)) * frame.k),
    width: Math.round(box.w * frame.k),
    height: Math.round(box.h * frame.k),
  }
}

const RINGS = {
  total: place(CAL, { x: 1188, y: 12, w: 124, h: 42 }),
  grid: place(CAL, { x: 30, y: 92, w: 1276, h: 160 }),
  tooltip: place(BAND, { x: 1292, y: 312, w: 219, h: 151 }),
  'day-tiles': place(DAY, { x: 226, y: 158, w: 1263, h: 96 }),
  'day-projects': place(DAY, { x: 226, y: 272, w: 1263, h: 140 }),
}

/** The install line the CTA types out: the npm package name is the short form. */
const INSTALL = 'dsh plugin add dsh-local-usage'

/** One scene's reveal: a single entrance, then the frame holds. */
const PAINTERS = {
  intro: t => {
    enter(need('shot-intro'), t, 0.3, 0.9, 24)
  },
  source: t => {
    enter(need('logline'), t, 0.3, 0.85, 18)
    const notes = [...need('source-notes').children]
    notes.forEach((note, index) => enter(note, t, 0.95 + index * 0.65, 1.4 + index * 0.65, 14))
  },
  calendar: t => {
    enter(need('shot-calendar'), t, 0.3, 0.9, 24)
    ring(need('ring-total'), t, 1.3, 1.75, RINGS.total)
    ring(need('ring-grid'), t, 3.1, 3.55, RINGS.grid)
  },
  day: t => {
    const board = need('shot-tooltip')
    const page = need('shot-day')
    const opened = ramp(t, 2.4, 2.8)
    board.style.opacity = String(1 - opened)
    page.style.opacity = String(opened)
    // The hover ring belongs to the band; it leaves with it when the page opens.
    ring(need('ring-tooltip'), t, 0.55, 1.0, RINGS.tooltip)
    need('ring-tooltip').style.opacity = String(ramp(t, 0.55, 1.0) * (1 - opened))
    ring(need('ring-day-tiles'), t, 3.3, 3.75, RINGS['day-tiles'])
    ring(need('ring-day-projects'), t, 4.8, 5.25, RINGS['day-projects'])
    // The page itself is the entrance for the second half of the scene.
    page.style.transform = `translateY(${((1 - opened) * 16).toFixed(2)}px)`
  },
  pricing: t => {
    enter(need('rate-card'), t, 0.3, 0.9, 22)
  },
  install: t => {
    enter(need('code'), t, 0.3, 0.8, 18)
    const typed = Math.round(INSTALL.length * ramp(t, 1.0, 2.6))
    need('typed').textContent = INSTALL.slice(0, typed)
    need('caret').style.opacity = typed >= INSTALL.length && Math.floor(t * 2) % 2 === 1 ? '0' : '1'
    // The other way in: the client's own dialog, once the command has typed out.
    enter(need('dialog-shot'), t, 2.9, 3.5, 22)
    enter(need('dialog-caption'), t, 3.6, 4.0, 12)
    const hints = [...need('install-hints').children]
    hints.forEach((hint, index) => enter(hint, t, 2.7 + index * 0.4, 3.2 + index * 0.4, 12))
  },
  outro: t => {
    enter(need('npm-card'), t, 0.3, 0.9, 22)
  },
}

/** The film's total length, in seconds. */
const duration = TIMINGS.duration

/** Facts the chrome is currently showing, so the DOM is only touched on a cut. */
let shownScene = null

/** Write the chrome for one scene: the strings that identify where the film is. */
function setChrome(scene) {
  chrome.kicker.textContent = scene.kicker
  chrome.title.textContent = scene.title
  chrome.qualifier.textContent = scene.qualifier
  chrome.facts.replaceChildren(...scene.facts.flatMap(([key, value]) => {
    const dt = document.createElement('dt')
    dt.textContent = key
    const dd = document.createElement('dd')
    dd.textContent = value
    return [dt, dd]
  }))
  stage.dataset.theme = scene.id === 'install' || scene.id === 'outro' ? 'night' : 'day'
  shownScene = scene.id
}

/**
 * Paint one frame.
 * @param t - seconds since the first frame.
 */
function render(t) {
  const time = Math.min(duration, Math.max(0, t))
  let active = TIMINGS.scenes[0]
  for (const scene of TIMINGS.scenes) {
    if (time >= scene.start && time < scene.end) active = scene
    // The last scene also owns the tail past its own end, so the final frames
    // keep their chrome while the picture fades out.
    if (scene === TIMINGS.scenes[TIMINGS.scenes.length - 1] && time >= scene.start) active = scene
  }
  if (shownScene !== active.id) setChrome(active)

  // A layer crossfades: out over the last 0.4s of its slot, in over its first.
  for (const scene of TIMINGS.scenes) {
    const fadeIn = ramp(time, scene.start, scene.start + 0.4)
    const fadeOut = scene.end >= duration ? 0 : ramp(time, scene.end - 0.4, scene.end)
    layers[scene.id].style.opacity = String(fadeIn * (1 - fadeOut))
    PAINTERS[scene.id]?.(time - scene.start)
  }

  // The chrome dips at a cut, which is what makes the swap read as a cut rather
  // than as a glitch.
  const chromeIn = ramp(time, active.start, active.start + 0.35)
  const chromeOut = active.end >= duration ? 0 : ramp(time, active.end - 0.26, active.end - 0.02)
  const chromeOpacity = chromeIn * (1 - chromeOut)
  for (const node of Object.values(chrome)) node.style.opacity = String(chromeOpacity)
  need('rule').style.opacity = String(chromeOpacity)

  // Captions ride the voice, not the scene.
  const captionOn = time >= active.voiceStart - 0.15 && time <= active.voiceEnd + 0.5
  subsLine.textContent = active.caption
  subs.style.opacity = captionOn
    ? String(ramp(time, active.voiceStart - 0.15, active.voiceStart + 0.25))
    : '0'

  progress.style.width = `${((time / duration) * 1920).toFixed(1)}px`
}

window.__film = { duration, render }
render(0)
