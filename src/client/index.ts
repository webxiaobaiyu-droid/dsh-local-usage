/**
 * Usage statistics, browser half: the sidebar's Usage entry, the full-width
 * panel it opens, and the stylesheet both need.
 *
 * A global panel rather than a settings page: a year of days needs the main
 * column's width, and what a profile has spent is not a preference.
 *
 * The panel talks to its own Host half over one Fetch route the plugin
 * registers, so this package installs without touching the product's Remote
 * assembly.
 *
 * @module dsh-local-usage/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the `main` keyed slot's MainPanelId brand and the root-scoped
// `usePanelInfo` the panel reads its selection from.
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the sidebar's SlotMap merge (the 'sidebar.panellist' entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { UsagePanel } from './UsagePanel.tsx'
import type { UsagePanelInjected } from './UsagePanel.tsx'
import { UsagePanelIcon } from './UsagePanelIcon.tsx'
import { en, zh, type UsageInsightsLocaleKey } from './locales.ts'
import { STYLE_ID, styles } from './styles.ts'
import { normalizeReport } from './wire-report.ts'
import type { WireReport } from './wire-report.ts'

export type { UsagePanelInjected, UsagePanelProps } from './UsagePanel.tsx'
export type { UsageInsightsLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Usage statistics panel copy. */
    'usage': UsageInsightsLocaleKey
  }
}

/** Dictionary namespace owned by this panel. */
export const NS = 'usage'

/** The id shared by the sidebar entry and the main panel it opens. */
export const PANEL_ID = 'usage' as MainPanelId

/** Host route this panel reads its report from. */
export const REPORT_PATH = '/api/dsh-local-usage/report'

/** Services required by the sidebar and main-slot registrations. */
export const inject = ['slots', 'locale']

/**
 * Inject this plugin's stylesheet once.
 *
 * A plugin served outside the product's build has to carry and inject its own
 * sheet; the tag is keyed so a reload replaces rather than accumulates.
 *
 * @returns the disposer that removes the tag this call installed; unloading the
 * plugin therefore leaves no orphaned sheet behind.
 */
function injectStyles(): () => void {
  const existing = document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)
  if (existing !== null) return () => {}
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-local-usage'
  tag.dataset.pluginCss = STYLE_ID
  tag.textContent = styles
  document.head.appendChild(tag)
  return () => {
    tag.remove()
  }
}

/**
 * Contribute the Usage entry to the sidebar with the panel it opens.
 * @param ctx - Client plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-local-usage: dictionaries')
  ctx.effect(() => injectStyles(), 'dsh-local-usage: stylesheet')

  const t = ctx.locale.bind(NS)
  const injected = (): UsagePanelInjected => ({
    panelId: PANEL_ID,
    // Read through the service on every call rather than captured once: the
    // panel formats figures during render, and the renderer re-renders this
    // entry whenever the locale revision moves, so the id it reads is always
    // the one the dictionary around it was resolved from.
    locale: () => ctx.locale.getLocale().active,
    report: async (refresh, from, to) => {
      const url = new URL(REPORT_PATH, window.location.origin)
      url.searchParams.set('from', String(from))
      url.searchParams.set('to', String(to))
      if (refresh) url.searchParams.set('refresh', '1')
      const response = await fetch(url, { credentials: 'include' })
      if (!response.ok) {
        throw new Error(`usage report failed: HTTP ${String(response.status)}`)
      }
      return normalizeReport(await response.json() as WireReport)
    },
  })

  // Ordered after Plugins: reading what was spent is an audit of work already
  // configured, and it follows the entries that shape how work is run.
  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: injected,
  }, UsagePanel))
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 10,
    label: () => t('nav'),
    locale: NS,
  }, UsagePanelIcon))
}
