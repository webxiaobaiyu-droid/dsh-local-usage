/**
 * The reader's price cards, one per model.
 *
 * Prices belong to models, not to routes: a model sold through four vendors is
 * the same model at the same price, and pricing is the one thing that should not
 * be re-entered per vendor. Each card therefore states its model's name, whether
 * it prices peak separately, and both sets of prices — four numbers inside a peak
 * window and four outside it, or one set when the switch is off.
 *
 * Consumption is not edited here and is not folded into these numbers: the route
 * table beside this editor states what each route spent, so a reader can see
 * which routes one card now covers without the two figures being merged.
 *
 * @module dsh-local-usage/client/RateEditor
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { UsageModelPrice, UsagePricingUpdate } from '../types.ts'
import {
  RATE_FIELDS,
  draftsFrom,
  pendingUpdate,
  type ModelDraft,
  type ModelDrafts,
  type PriceSet,
  type RateField,
} from './rate-draft.ts'
import { css } from './classes.ts'

/** How long the "saved" confirmation stays up. */
const CONFIRMATION_MS = 2200

/** The dictionary key of each bucket's column label. */
const FIELD_KEYS: Record<RateField, 'pricingColumnInput' | 'pricingColumnCacheRead' | 'pricingColumnCacheWrite' | 'pricingColumnOutput'> = {
  input: 'pricingColumnInput',
  cacheRead: 'pricingColumnCacheRead',
  cacheWrite: 'pricingColumnCacheWrite',
  output: 'pricingColumnOutput',
}

/** Props for the card editor. */
export interface RateEditorProps {
  /** The cards in match order; the fallback card has an empty `match`. */
  readonly models: readonly UsageModelPrice[]
  /** Currency every price is expressed in, shown once beside the save action. */
  readonly currency: string
  /** Panel translate function. */
  readonly t: PropsLocale<'usage'>['t']
  /** Persist one update; rejects with a message the editor shows. */
  readonly onSave: (update: UsagePricingUpdate) => Promise<void>
}

/**
 * Render the editable price cards.
 * @param props - the cards, currency, dictionary and the save action.
 * @returns the editor.
 */
export function RateEditor({ models, currency, t, onSave }: RateEditorProps): ReactNode {
  const [drafts, setDrafts] = useState<ModelDrafts>(() => draftsFrom(models))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)

  // A new report re-seeds the fields: after a save the values in effect are the
  // ones just written, and a configuration change brings new cards.
  useEffect(() => { setDrafts(draftsFrom(models)) }, [models])

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => { setSaved(false) }, CONFIRMATION_MS)
    return () => { clearTimeout(timer) }
  }, [saved])

  const pending = useMemo(() => pendingUpdate(drafts, models), [drafts, models])
  const canSave = pending.status === 'ready' && !busy

  /** Write one field of one card as typed. */
  function write(model: string, set: PriceSet, field: RateField, value: string): void {
    setSaved(false)
    setFailure(undefined)
    setDrafts(current => {
      const draft = current[model] ?? blankDraft()
      return { ...current, [model]: { ...draft, [set]: { ...draft[set], [field]: value } } }
    })
  }

  /** Turn one card's peak pricing on or off. */
  function switchPeak(model: string, peakEnabled: boolean): void {
    setSaved(false)
    setFailure(undefined)
    setDrafts(current => {
      const draft = current[model] ?? blankDraft()
      return { ...current, [model]: { ...draft, peakEnabled } }
    })
  }

  /** Put one card's fields back to the prices in effect, dropping unsaved edits. */
  function discard(model: string): void {
    const card = models.find(candidate => candidate.match === model)
    if (card === undefined) return
    setSaved(false)
    setFailure(undefined)
    setDrafts(current => ({ ...current, [model]: draftsFrom([card])[model] ?? blankDraft() }))
  }

  /** Commit one update. */
  async function commit(update: UsagePricingUpdate): Promise<void> {
    setBusy(true)
    setFailure(undefined)
    try {
      await onSave(update)
      setSaved(true)
    } catch (error: unknown) {
      setFailure(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }

  // Stated rather than omitted: a card list that empties itself when a window
  // recorded nothing is indistinguishable from an editor that was removed.
  if (models.length === 0) {
    return (
      <section className={css.editor}>
        <h4 className={css.editorTitle}>{t('pricingModelsTitle')}</h4>
        <p className={css.editorHint}>{t('pricingEditorEmpty')}</p>
      </section>
    )
  }

  return (
    <section className={css.editor}>
      <h4 className={css.editorTitle}>{t('pricingModelsTitle')}</h4>
      <p className={css.editorHint}>{t('pricingModelsHint')}</p>
      <div className={css.editorCards}>
        {models.map(card => {
          const draft = drafts[card.match] ?? blankDraft()
          const invalid = pending.status === 'invalid' && pending.model === card.match ? pending : undefined
          const name = card.match === '' ? t('pricingFallback') : card.match
          return (
            <fieldset key={card.match} className={css.editorCard}>
              <legend className={css.editorCardName}>
                <code className={css.priceMatch} title={name}>{name}</code>
              </legend>
              <div className={css.editorCardRow}>
                <label className={css.editorToggle}>
                  <input
                    type="checkbox"
                    checked={draft.peakEnabled}
                    disabled={busy}
                    onChange={event => { switchPeak(card.match, event.target.checked) }}
                  />
                  <span>{t('pricingPeakEnabled')}</span>
                </label>
                <button
                  type="button"
                  className={css.rankMore}
                  disabled={busy}
                  onClick={() => { discard(card.match) }}
                >
                  {t('pricingReset')}
                </button>
              </div>
              {draft.peakEnabled ? (
                <PriceSet_
                  card={card}
                  set="peak"
                  label={t('pricingPeakPrices')}
                  draft={draft}
                  invalid={invalid?.set === 'peak' ? invalid.field : undefined}
                  busy={busy}
                  t={t}
                  write={write}
                />
              ) : null}
              <PriceSet_
                card={card}
                set="offPeak"
                label={draft.peakEnabled ? t('pricingOffPeakPrices') : t('pricingFlatPrice')}
                draft={draft}
                invalid={invalid?.set === 'offPeak' ? invalid.field : undefined}
                busy={busy}
                t={t}
                write={write}
              />
            </fieldset>
          )
        })}
      </div>
      <div className={css.editorActions}>
        <button
          type="button"
          className={css.rankMore}
          disabled={!canSave}
          onClick={() => {
            if (pending.status !== 'ready') return
            void commit(pending.update)
          }}
        >
          {t('pricingSave')}
        </button>
        <span className={css.priceCurrency}>{currency} / 1M</span>
        {pending.status === 'invalid'
          ? <span className={css.editorError} role="alert">{t('pricingInvalid')}</span>
          : saved
            ? <span className={css.editorStatus} role="status">{t('pricingSaved')}</span>
            : null}
        {failure === undefined ? null : (
          <span className={css.editorError} role="alert">{t('pricingSaveFailed', { message: failure })}</span>
        )}
      </div>
    </section>
  )
}

/** One set of four prices, labelled and bound to its card. */
function PriceSet_({ card, set, label, draft, invalid, busy, t, write }: {
  readonly card: UsageModelPrice
  readonly set: PriceSet
  readonly label: string
  readonly draft: ModelDraft
  /** The field of this set that holds something which is not a price. */
  readonly invalid: RateField | undefined
  readonly busy: boolean
  readonly t: PropsLocale<'usage'>['t']
  readonly write: (model: string, set: PriceSet, field: RateField, value: string) => void
}): ReactNode {
  return (
    <div className={css.editorPriceRow}>
      <span className={css.editorPriceLabel}>{label}</span>
      <div className={css.editorPriceFields}>
        {RATE_FIELDS.map(field => (
          <label key={field} className={css.editorPriceField}>
            <span className={css.visuallyHidden}>
              {`${card.match === '' ? 'fallback' : card.match} ${label} ${t(FIELD_KEYS[field])}`}
            </span>
            <input
              className={css.editorField}
              type="text"
              inputMode="decimal"
              aria-label={`${card.match === '' ? 'fallback' : card.match} ${label} ${t(FIELD_KEYS[field])}`}
              aria-invalid={invalid === field}
              placeholder={t(FIELD_KEYS[field])}
              value={draft[set][field]}
              disabled={busy}
              onChange={event => { write(card.match, set, field, event.target.value) }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

/** A blank card, used for a card the drafts have not caught up with. */
function blankDraft(): ModelDraft {
  const blank = (): Record<RateField, string> =>
    Object.fromEntries(RATE_FIELDS.map(field => [field, ''])) as unknown as Record<RateField, string>
  return { peakEnabled: false, peak: blank(), offPeak: blank() }
}
