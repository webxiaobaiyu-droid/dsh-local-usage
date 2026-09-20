/** The panel's stylesheet, injected once when the plugin loads.
 *
 * @module dsh-local-usage/client/styles
 */

/** Element id marking this plugin's injected style tag. */
export const STYLE_ID = 'dsh-local-usage/styles'

/** The complete stylesheet, scoped by the `dlu-` class prefix. */
export const styles = String.raw`
/* Usage statistics panel.
 *
 * This is the main column, not a settings page, so the calendar gets the width
 * it needs. Cells are fixed squares whose edge is measured, never fractional
 * tracks: a cell sized by its track has no stable intrinsic box to lay out
 * against, which is what makes dense grids collapse.
 *
 * The heat scale is the DeepSeek blue mixed into the surface — the neutral
 * brand token reads as grey-to-black, which says nothing about intensity. */

/* One element is both the column and the scroll container, the shape every
 * main-slot panel in this product uses. The main column is itself a column
 * flexbox with 'overflow: hidden', so a panel that clips its own overflow is
 * simply cut off: the scroll box has to be this element.
 *
 * Centring comes from 'align-items: center' plus a per-child width, never from
 * 'margin-inline: auto' — that turns a flex child into a fit-content box, so a
 * grid wider than the panel would pin it to its own overflow and the width
 * measurement behind the calendar would never settle. */
.dlu-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  box-sizing: border-box;
  block-size: 100%;
  min-block-size: 0;
  overflow: auto;
  padding: 26px clamp(24px, 4vw, 48px) 48px;
  background: var(--dsw-alias-bg-base);
}

.dlu-panel > * {
  inline-size: 100%;
  max-inline-size: 1280px;
}

.dlu-header {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 20px;
  align-items: flex-start;
  justify-content: space-between;
}

.dlu-headerText {
  min-width: 0;
}

.dlu-heading {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--dsw-alias-label-primary);
}

.dlu-subtitle {
  margin: 5px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-controls {
  display: flex;
  flex-shrink: 0;
  gap: 10px;
  align-items: center;
}

.dlu-ranges {
  display: inline-flex;
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 9px;
}

.dlu-range {
  padding: 6px 13px;
  font: inherit;
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  background: transparent;
  border: 0;
  transition: background-color 120ms ease-out;
}

.dlu-range + .dlu-range {
  border-left: 0.5px solid var(--dsw-alias-border-l2);
}

.dlu-range:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dlu-range[aria-pressed='true'] {
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-2);
}

.dlu-range:focus-visible {
  outline: 2px solid var(--dsw-alias-link);
  outline-offset: -2px;
}

/* ── Summary: one hero figure, then supporting tiles ───────────────────── */

.dlu-summary {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 0;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}

.dlu-hero {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.dlu-heroLabel {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-heroValue {
  font-size: 34px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.08;
  letter-spacing: -0.02em;
  color: var(--dsw-alias-label-primary);
}

.dlu-heroDetail {
  font-size: 11px;
  line-height: 1.4;
  color: var(--dsw-alias-label-caption);
}

.dlu-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(114px, 1fr));
  gap: 10px;
}

.dlu-tile {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 10px 12px;
  background: var(--dsw-alias-bg-layer-1);
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
}

.dlu-tileValue {
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  color: var(--dsw-alias-label-primary);
}

.dlu-tileLabel {
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-tileDetail {
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--dsw-alias-label-caption);
}

.dlu-empty {
  margin: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

/* ── Calendar ─────────────────────────────────────────────────────────── */

.dlu-calendar {
  /* One ramp for the whole figure, every step mixed into the page surface so
   * the whole scale travels with the theme.
   *
   * The empty step is a low wash of the text colour rather than a surface
   * token, because no surface token is offset from the page in both themes:
   * 'bg-layer-2' resolves to the page background itself in the light theme,
   * which left every day the profile did not spend on invisible and made the
   * calendar a scatter of blue rather than a year. Mixing ink into the surface
   * gives a neutral tile that is one quiet step off the page in either theme —
   * light grey on white, a lifted charcoal on black — and keeps the empty step
   * built the same way as the four active ones.
   *
   * It stays clearly below the first active step: that one is *blue*, and a
   * change of hue reads at a glance where a change of lightness this small
   * would not. */
  --usage-heat-0: color-mix(in oklab, var(--dsw-alias-label-primary) 6%, var(--dsw-alias-bg-base));
  --usage-heat-1: color-mix(in oklab, var(--dsw-alias-link) 18%, var(--dsw-alias-bg-base));
  --usage-heat-2: color-mix(in oklab, var(--dsw-alias-link) 38%, var(--dsw-alias-bg-base));
  --usage-heat-3: color-mix(in oklab, var(--dsw-alias-link) 62%, var(--dsw-alias-bg-base));
  --usage-heat-4: var(--dsw-alias-link);

  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px 20px 14px;
  margin: 0;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
}

.dlu-calendarCaption {
  display: flex;
  gap: 12px;
  align-items: baseline;
  justify-content: space-between;
}

.dlu-calendarHeading {
  display: flex;
  gap: 9px;
  align-items: baseline;
}

.dlu-calendarTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.dlu-calendarYear {
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-calendarTotal {
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}

.dlu-calendarScroll {
  padding: 2px 0;
}

.dlu-calendarMeasure {
  inline-size: 100%;
  min-inline-size: 0;
}

.dlu-monthRow,
.dlu-gridRow {
  display: grid;
}

.dlu-monthRow {
  margin-bottom: 6px;
}

.dlu-weekdayColumn {
  display: grid;
  padding-right: 6px;
}

.dlu-weekday {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-size: 10.5px;
  line-height: 1;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-monthLabel {
  font-size: 10.5px;
  font-weight: 500;
  line-height: 1;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}

.dlu-cells {
  display: grid;
}

/* The row wrappers exist for the accessibility tree and for explicit cell
 * placement, not for layout: a box of their own would become a grid item and
 * push every cell out of its track. */
.dlu-cellRow {
  display: contents;
}

/* Each cell is a button, so it has to shed the chrome it arrives with:
 * padding, border and background would push the square off its track and paint
 * over the heat step underneath it. */
.dlu-cell {
  padding: 0;
  font: inherit;
  cursor: pointer;
  appearance: none;
  background: none;
  border: 0;
  border-radius: 4px;
  transition: transform 100ms ease-out;
}

.dlu-cell:hover {
  transform: scale(1.15);
}

.dlu-cell:focus-visible {
  outline: 2px solid var(--dsw-alias-link);
  outline-offset: 1px;
}

.dlu-cell[data-level='0'] {
  background: var(--usage-heat-0);
}

.dlu-cell[data-level='1'] {
  background: var(--usage-heat-1);
}

.dlu-cell[data-level='2'] {
  background: var(--usage-heat-2);
}

.dlu-cell[data-level='3'] {
  background: var(--usage-heat-3);
}

.dlu-cell[data-level='4'] {
  background: var(--usage-heat-4);
}

.dlu-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-legendHint {
  font-size: 11px;
  color: var(--dsw-alias-label-caption);
}

.dlu-legendScale {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-left: auto;
}

.dlu-legendLabel {
  font-size: 10.5px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-legendLabel:first-child {
  margin-right: 2px;
}

.dlu-legendSwatch {
  inline-size: 11px;
  block-size: 11px;
  border-radius: 3px;
}

.dlu-legendSwatch[data-level='0'] {
  background: var(--usage-heat-0);
}

.dlu-legendSwatch[data-level='1'] {
  background: var(--usage-heat-1);
}

.dlu-legendSwatch[data-level='2'] {
  background: var(--usage-heat-2);
}

.dlu-legendSwatch[data-level='3'] {
  background: var(--usage-heat-3);
}

.dlu-legendSwatch[data-level='4'] {
  background: var(--usage-heat-4);
}

.dlu-legendPeak {
  font-variant-numeric: tabular-nums;
}

/* ── Day page ─────────────────────────────────────────────────────────── */

/* The drill-down replaces the panel's whole contents, so it has to carry its
 * own vertical rhythm: the panel's own gap now applies to a single child. */
.dlu-dayDetail {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* Focused when it opens, so a keyboard reader lands at the top of the new page
 * rather than on a document body that no longer holds their cell. It is a page
 * container, not a control, so it draws no ring of its own. */
.dlu-dayDetail:focus {
  outline: none;
}

.dlu-dayHeader {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 20px;
  align-items: flex-start;
  justify-content: space-between;
}

.dlu-dayTitleRow {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.dlu-dayTitle {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--dsw-alias-label-primary);
}

.dlu-dayWeekday {
  font-size: 12.5px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-projectBlock {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dlu-projectHeading {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary);
}

.dlu-projectTable {
  inline-size: 100%;
  font-size: 12px;
  border-collapse: collapse;
}

.dlu-projectTable th {
  padding: 0 0 6px;
  font-weight: 400;
  color: var(--dsw-alias-label-caption);
  text-align: left;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}

/* Two classes deep so this outranks the header rule above, which sets a
 * text-align of its own. */
.dlu-projectTable .dlu-numeric {
  text-align: right;
}

.dlu-projectTable td {
  padding: 7px 0;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}

.dlu-projectTable th.dlu-projectCell {
  padding-right: 20px;
  vertical-align: top;
}

.dlu-projectName {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}

/* The directory is context for the name above it, not the label: quiet, and
 * allowed to break anywhere, because a path has no spaces to break at. */
.dlu-projectPath {
  display: block;
  margin-top: 2px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-caption);
  overflow-wrap: anywhere;
}

/* ── Hover card ───────────────────────────────────────────────────────── */

.dlu-tooltip {
  position: fixed;
  z-index: 40;
  min-inline-size: 224px;
  padding: 12px 14px;
  pointer-events: none;
  background: var(--dsw-alias-bg-overlay);
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  transform: translate(-50%, -100%) translateY(-9px);
}

.dlu-tooltip[data-placement='below'] {
  transform: translate(-50%, 0);
}

.dlu-tooltipHead {
  display: flex;
  gap: 10px;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 8px;
  margin-bottom: 8px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}

.dlu-tooltipDate {
  font-size: 12.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}

.dlu-tooltipWeekday {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-tooltipHero {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 9px;
}

.dlu-tooltipDot {
  inline-size: 12px;
  block-size: 12px;
  flex-shrink: 0;
  border-radius: 50%;
}

.dlu-tooltipDot[data-level='0'] {
  background: var(--usage-heat-0);
}

.dlu-tooltipDot[data-level='1'] {
  background: var(--usage-heat-1);
}

.dlu-tooltipDot[data-level='2'] {
  background: var(--usage-heat-2);
}

.dlu-tooltipDot[data-level='3'] {
  background: var(--usage-heat-3);
}

.dlu-tooltipDot[data-level='4'] {
  background: var(--usage-heat-4);
}

.dlu-tooltipHeroLabel {
  flex: 1;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-tooltipHeroValue {
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
}

.dlu-tooltipRows {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
}

.dlu-tooltipRows div {
  display: flex;
  gap: 20px;
  align-items: baseline;
  justify-content: space-between;
}

.dlu-tooltipRows dt {
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-tooltipRows dd {
  margin: 0;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}

.dlu-tooltipEmpty {
  margin: 0;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
}

/* ── Status and notes ─────────────────────────────────────────────────── */

.dlu-status {
  margin: 0;
  font-size: 12.5px;
  color: var(--dsw-alias-label-secondary);
}

.dlu-failure {
  display: flex;
  gap: 12px;
  align-items: center;
}

.dlu-failure p {
  margin: 0;
  font-size: 12.5px;
  color: var(--dsw-alias-state-error-primary);
}

.dlu-notes {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-notes p {
  margin: 0;
}

.dlu-notesHeading {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
}

/* The figure carries the finding, the note beside it says what it was measured
   against; tertiary text at the same size would leave the two indistinguishable. */
.dlu-noteValue {
  margin-right: 6px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}

.dlu-warning {
  color: var(--dsw-alias-state-warn-primary);
}

.dlu-scan {
  font-variant-numeric: tabular-nums;
}

.dlu-disclosure {
  padding-top: 12px;
  margin-top: 4px;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}

.dlu-disclosureSummary {
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}

.dlu-disclosureBody {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 10px;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-disclosureBody p {
  margin: 0;
}

.dlu-pricingCaveat {
  color: var(--dsw-alias-state-warn-primary);
}

.dlu-pricingRatesLabel {
  margin-top: 3px;
  color: var(--dsw-alias-label-secondary);
}

.dlu-pricingHint {
  color: var(--dsw-alias-label-caption);
}

.dlu-priceTable {
  inline-size: 100%;
  max-inline-size: 620px;
  font-size: 11px;
  border-collapse: collapse;
}

.dlu-priceTable th {
  padding: 0 0 5px;
  font-weight: 400;
  color: var(--dsw-alias-label-caption);
  text-align: left;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}

.dlu-priceTable td {
  padding: 5px 0;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}

.dlu-numeric {
  text-align: right;
}

.dlu-priceMatch {
  color: var(--dsw-alias-label-primary);
}

.dlu-priceCurrency {
  padding-left: 10px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-caption);
}

/* Key/value facts inside a disclosure. */
.dlu-facts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 2px 0 0;
}

.dlu-facts > div {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr);
  gap: 10px;
  align-items: baseline;
}

.dlu-facts dt {
  color: var(--dsw-alias-label-caption);
}

.dlu-facts dd {
  min-width: 0;
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-facts code {
  display: block;
  overflow-wrap: anywhere;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
}

@media (max-width: 560px) {
  .dlu-panel {
    padding: 20px 16px 40px;
  }

  .dlu-heroValue {
    font-size: 28px;
  }

  /* Six columns of figures on a phone: keep them, but tighten the type and the
   * name column so the row still reads as one line. */
  .dlu-dayTitle {
    font-size: 17px;
  }

  .dlu-projectTable {
    font-size: 11px;
  }

  .dlu-projectTable td {
    padding: 5px 0;
  }

  .dlu-projectTable th.dlu-projectCell {
    padding-right: 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dlu-cell,
  .dlu-range {
    transition: none;
  }

  .dlu-cell:hover {
    transform: none;
  }
}
`
