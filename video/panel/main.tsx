/**
 * Standalone mount of the real panel, fed by the synthetic corpus.
 *
 * The film shows the shipping component rather than a redrawn lookalike: this
 * entry imports `UsagePanel` and the plugin's own stylesheet from `src/`, and
 * supplies only the three seats the product's slot renderer would have supplied
 * — the dictionary, the locale id, and the report reader. Everything below the
 * mount point is therefore the same code the browser half ships.
 *
 * The mount exposes `window.__panel` for the capture script: `ready` resolves
 * once the panel has painted its first report, and `setRange`/`openDay` drive
 * the panel through the same DOM affordances a reader would use.
 *
 * @module dsh-local-usage/video/panel/main
 */

// The product's own token sheets, so the panel's `--dsw-alias-*` reads resolve
// to the real light theme instead of falling back to nothing.
import '@dsh-theme/base.css'
import '@dsh-theme/design-platform.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { UsagePanel } from '../../src/client/UsagePanel.tsx'
import type { UsagePanelProps } from '../../src/client/UsagePanel.tsx'
import { zh } from '../../src/client/locales.ts'
import { styles } from '../../src/client/styles.ts'
import { makeReport } from './fixture.ts'

const styleTag = document.createElement('style')
styleTag.dataset.pluginCss = 'dsh-local-usage'
styleTag.textContent = styles
document.head.appendChild(styleTag)

/** Dictionary lookup with the locale runtime's own `{name}` substitution. */
function translate(key: string, params?: Record<string, string>): string {
  const template = (zh as Record<string, string>)[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match)
}

/** Wait one paint, so a click's effect is on screen before the next capture. */
function nextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => { requestAnimationFrame(() => { resolve() }) })
  })
}

const props = {
  panelId: 'usage',
  locale: () => 'zh',
  report: (refresh: boolean, from: number, to: number) => {
    void refresh
    return Promise.resolve(makeReport(from, to))
  },
  t: translate,
  usePanelInfo: (selector: (info: { activePanelId: string }) => unknown) => selector({ activePanelId: 'usage' }),
} as unknown as UsagePanelProps

const host = document.getElementById('root')
if (host === null) throw new Error('video/panel: #root is missing from index.html')
createRoot(host).render(<StrictMode><UsagePanel {...props} /></StrictMode>)

/** Capture-side handle: scene states are driven through real panel affordances. */
interface PanelHandle {
  /** Resolves once the calendar has painted a priced report. */
  ready: Promise<void>
  /** Click one of the range buttons by its visible label. */
  setRange: (label: string) => Promise<void>
  /** Open the day page for one calendar cell, addressed by its `data-day` key. */
  openDay: (day: string) => Promise<void>
  /** Leave the day page. */
  back: () => Promise<void>
  /** Switch the product theme the panel renders under. */
  setTheme: (theme: 'light' | 'dark') => Promise<void>
}

declare global {
  interface Window { __panel: PanelHandle }
}

/** Click a button whose trimmed text equals `label`. */
async function clickByText(label: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const buttons = [...document.querySelectorAll('button')]
    const hit = buttons.find(button => (button.textContent ?? '').trim() === label)
    if (hit !== undefined) {
      hit.click()
      await nextPaint()
      await new Promise(resolve => setTimeout(resolve, 120))
      return
    }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`video/panel: no button labelled "${label}"`)
}

window.__panel = {
  ready: (async () => {
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (document.querySelector('.dlu-heroValue') !== null
        && document.querySelector('.dlu-cell') !== null) {
        await nextPaint()
        return
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error('video/panel: panel never painted a report')
  })(),
  setRange: clickByText,
  openDay: async (day: string) => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const hit = document.querySelector<HTMLButtonElement>(`.dlu-cell[data-day="${day}"]`)
      if (hit !== null) {
        hit.click()
        await nextPaint()
        await new Promise(resolve => setTimeout(resolve, 160))
        return
      }
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    throw new Error(`video/panel: no calendar cell for "${day}"`)
  },
  back: () => clickByText('返回日历'),
  setTheme: async (theme: 'light' | 'dark') => {
    if (theme === 'dark') document.body.dataset.dsDarkTheme = ''
    else delete document.body.dataset.dsDarkTheme
    await nextPaint()
    await new Promise(resolve => setTimeout(resolve, 80))
  },
}
