/**
 * What the window spent its attempts on, stated under the calendar.
 *
 * Cost and reliability answer two halves of one question, and the panel keeps
 * them apart on purpose: the figures above are what was billed, this block is
 * what it took to get there — provider attempts that had to be repeated, tool
 * calls that came back as errors, and context compactions that failed and so
 * left their context uncompacted. A compromised run is the usual reason a window
 * costs more than its token counts suggest, so the block reads as an explanation
 * of the figures above rather than as a separate report.
 *
 * It renders nothing when the window recorded nothing. A heading that is present
 * but empty would be a claim about windows nobody asked about, and one that is
 * usually there is one readers stop seeing.
 *
 * @module dsh-local-usage/client/ReliabilityNotes
 */

import type { ReactNode } from 'react'
import type { UsageReliability } from '../types.ts'
import { css } from './classes.ts'
import type { UsageInsightsLocaleKey } from './locales.ts'
import { causeText, hasCompactions, hasToolCalls, signalOverflow, topSignals } from './reliability.ts'

/** The block's inputs: the window's counters and the panel's formatters. */
export interface ReliabilityNotesProps {
  /** The window's reliability fold. */
  readonly reliability: UsageReliability
  /** Panel translate function. */
  readonly t: (key: UsageInsightsLocaleKey, params?: Record<string, string>) => string
  /** Full integer formatter owned by the panel. */
  readonly integer: (value: number) => string
  /** Percentage formatter owned by the panel. */
  readonly percent: (value: number) => string
}

/**
 * Render one labelled figure with its explanation beside it.
 * @param props - the label, the figure, and the quieter note that qualifies it.
 * @returns the row.
 */
function Note({ label, value, detail }: {
  readonly label: string
  readonly value: string
  readonly detail: string
}): ReactNode {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span className={css.noteValue}>{value}</span>
        <span>{detail}</span>
      </dd>
    </div>
  )
}

/**
 * Render the window's reliability statement.
 * @param props - the counters, the dictionary, and the panel's formatters.
 * @returns the block, or `null` when the window recorded nothing.
 */
export function ReliabilityNotes({ reliability, t, integer, percent }: ReliabilityNotesProps): ReactNode {
  const causes = topSignals(reliability.retryCauses)
  const overflow = signalOverflow(reliability.retryCauses)
  const causeDetail = causes
    .map(row => `${causeText(row.code, t)} ${integer(row.count)}`)
    .concat(overflow === 0 ? [] : [t('moreCauses', { count: integer(overflow) })])
    .join(' · ')
  const toolCodes = topSignals(reliability.toolErrorCodes).map(row => row.code).join(' · ')
  const toolDetail = toolCodes.length === 0
    ? t('toolErrorNote', {
      errors: integer(reliability.toolErrors),
      calls: integer(reliability.toolCalls),
    })
    : `${t('toolErrorNote', {
      errors: integer(reliability.toolErrors),
      calls: integer(reliability.toolCalls),
    })} · ${toolCodes}`

  const rows = [
    reliability.retries === 0
      ? null
      : (
        <Note
          key="retries"
          label={t('retries')}
          value={t('countTimes', { count: integer(reliability.retries) })}
          detail={causeDetail}
        />
      ),
    reliability.toolErrors === 0 || !hasToolCalls(reliability)
      ? null
      : (
        <Note
          key="tools"
          label={t('toolErrors')}
          value={percent(reliability.toolErrors / reliability.toolCalls)}
          detail={toolDetail}
        />
      ),
    reliability.compactionFailures === 0 || !hasCompactions(reliability)
      ? null
      : (
        <Note
          key="compaction"
          label={t('compactionFailures')}
          value={t('countTimes', { count: integer(reliability.compactionFailures) })}
          detail={t('compactionNote', { attempts: integer(reliability.compactions) })}
        />
      ),
  ].filter(row => row !== null)

  if (rows.length === 0) return null

  return (
    <section aria-label={t('reliability')}>
      <h3 className={css.notesHeading}>{t('reliability')}</h3>
      <dl className={css.facts}>{rows}</dl>
    </section>
  )
}
