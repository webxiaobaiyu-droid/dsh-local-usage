# Promo film

A ~47-second Chinese promo for the plugin, built entirely from this checkout:
no screen recording, no stock footage, no editor project.

| Output | What it is |
|---|---|
| `out/dsh-local-usage-promo.mp4` | 1920×1080, 30 fps, H.264 High + AAC, ~3 MB |
| `out/cover.png` | 3840×2160 upload cover |
| `out/dsh-local-usage-promo.srt` | the same captions as a sidecar track |

```sh
python3 -m venv .venv-tts && .venv-tts/bin/pip install edge-tts   # once, for the voice
node video/build.mjs                # everything, ~7 minutes
node video/build.mjs --skip-panel   # reuse the captured panel states
node video/build.mjs --skip-frames  # re-encode the existing frames
```

## The arrangement

The film is a document, not a poster. Every scene is the same page:

```
┌──────────────────────────────────────────────────────────┐
│ CALENDAR · 热力图                    weeks        52     │  section kicker left,
│                                      total   ¥3,578.99   │  machine facts right
│ 一年 52 周，一天一格                                       │  title
│ 颜色越深，那天花得越多                                      │  qualifier
│ ┌──────────────────────────────────────────────────────┐ │
│ │ the shipping panel, or a rate table, or the command  │ │  one content card
│ └──────────────────────────────────────────────────────┘ │
│ ─────────────────── hairline ─────────────────────────── │
│              一天一格，颜色越深花得越多                     │  the spoken line
└──────────────────────────────────────────────────────────┘
```

Three rules hold it together:

- **Every mark is a real value.** The fact corner carries counts, dates, rates and
  the repo path; the kicker names the section; nothing is decoration. The page has
  one accent colour, the panel's own blue, and it is spent on what the numbers
  mean.
- **One entrance per scene.** A card rises once and then holds. There is no
  floating, no pulsing, no glow: the only time-varying things after the entrance
  are the rings that point at a value and the typed install command.
- **The subtitle is the only centred element**, because the subtitle is the voice.

## How it is put together

The film shows the **shipping component**. `video/panel/` mounts
`src/client/UsagePanel.tsx` with the plugin's own stylesheet and the product's
theme tokens, and feeds it a generated corpus instead of a Host — so the pixels
are the real panel and the numbers in them are nobody's real usage.
`video/scripts/capture-panel.mjs` drives that panel through its own affordances
(range buttons, calendar cells, disclosures) and saves each state as a PNG.

`video/film/` is the edit: one 1920×1080 page with a chrome (kicker, title,
qualifier, fact corner, subtitle) written from the timings, plus one content layer
per scene. Every animated property is a pure function of time —
`window.__film.render(t)` paints the frame at `t` and the capture walks `t` at
30 fps. Nothing runs on a CSS transition or a timer, so two captures of the same
instant are identical and the picture cannot drift from the audio.

`video/narration.json` carries the script, the per-scene chrome and the fact
corner. `scripts/tts.mjs` synthesises each line with **edge-tts** — Microsoft's
neural voices, which is the difference between a person reading a script and the
macOS `say` voices' concatenation — measures it with `ffprobe`, and writes the
scene boundaries to `film/timings.js`. The cuts, the captions and the audio
offsets all read that one file, so editing the copy re-times the video instead of
desynchronising it. `--engine say` falls back to the system voice if edge-tts is
not installed.

`scripts/audio.mjs` lays each line at its measured offset and mixes a quiet
synthesised pad underneath, so the gaps between lines are not dead air. The voice
lands near -16 LUFS and the pad about 26 dB below it; `--no-bed` drops it.

## Why it is built this way

- **No screen recording.** The running GUI needs the one-time token `dsh web`
  prints, which cannot be recovered from the process, and recording a real profile
  would put real project paths and real money in a public video.
- **Text is rendered by Chrome, not by ffmpeg.** This ffmpeg has no `drawtext` and
  no `libass`, so every word — including the burned-in captions — is HTML laid out
  by Chrome and captured as pixels.
- **Frames are captured at 2x and downscaled with Lanczos.** That supersampling is
  what keeps the panel's own 13 px text readable at 1080p.

## Changing it

| Want | Edit |
|---|---|
| Copy, captions, section titles, fact corner | `narration.json` |
| Voice or speed | `narration.json` (`engine`, `voice`, `rate`), or `node video/scripts/tts.mjs --voice zh-CN-XiaoxiaoNeural --rate +0%` |
| Demo numbers, project names, spikes | `panel/fixture.ts` |
| Rates the film shows | the table markup in `film/index.html`, plus `DEFAULT_CONFIG` in `src/index.ts` if the shipped rates moved |
| Palette, type, layout | `film/film.css`; scene motion in `film/film.js` |
| Cover | `film/cover.html` |

Voices worth trying: `zh-CN-YunxiNeural` (default, young male, conversational),
`zh-CN-XiaoxiaoNeural` (warm female), `zh-CN-YunjianNeural` (energetic male),
`zh-CN-YunyangNeural` (news anchor). `edge-tts --list-voices` prints the rest.

`DSH_SRC` points at the Harness checkout the panel harness reads its theme tokens
from; `DSH_PLAYWRIGHT` overrides where `playwright-core` is loaded from. Both
default to the checkout this plugin was developed against.

## What is not in the repository

`frames/`, `probe/`, `assets/`, `out/`, `film/timings.js` and `.venv-tts/` are
generated and gitignored: the frames alone are ~1 GB. The pipeline, the copy, the
demo corpus and the film page are the sources, and they are all committed.
