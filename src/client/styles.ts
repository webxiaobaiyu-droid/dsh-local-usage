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
 * measurement behind the calendar would never settle.
 *
 * It is also the panel's query container, which is how the rules below keep the
 * layout a function of its width rather than of the figures inside it. Nothing
 * positions against it: the popovers anchor to their own host, and the calendar
 * card is portalled to the document. */
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
  container-type: inline-size;
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
  /* A row that can wrap: the range chips, the two reference buttons and the
   * recount button are 576px of fixed content, which is wider than a narrow
   * panel and used to push the whole page sideways instead of moving down. */
  flex-wrap: wrap;
  display: flex;
  /* Not flex-shrink: 0: that let the row keep its 576px of fixed content and
   * overhang a narrow panel instead of wrapping inside it. Free to shrink, the
   * chips and the buttons move onto a second line as the panel narrows. */
  min-inline-size: 0;
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

/* The figures are the header of the page, not the page: the hero and its tiles
 * share one row so the calendar below them starts high on the screen. */
.dlu-summary {
  display: grid;
  grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
  gap: 10px 22px;
  align-items: center;
  padding: 12px 0;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}

.dlu-hero {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 22px;
  border-right: 0.5px solid var(--dsw-alias-border-l2);
}

.dlu-heroLabel {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--dsw-alias-label-tertiary);
}

/* The headline figure: exact to the last digit, and never broken across lines —
 * a money amount split over two lines is unreadable, and it changes the height
 * of the block the whole page hangs off.
 *
 * A total that outgrows the type is set a step smaller rather than allowed to
 * push the tiles aside. The height is pinned to the largest step, so which step
 * a figure lands in cannot change how tall the strip is: the reader switching
 * from a day to a year sees the digits change, not the page move. */
.dlu-heroValue {
  display: block;
  min-block-size: 30px;
  font-size: 27px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.08;
  letter-spacing: -0.02em;
  white-space: nowrap;
  color: var(--dsw-alias-label-primary);
}

.dlu-heroValue[data-room='long'] {
  font-size: 21px;
  line-height: 30px;
}

.dlu-heroValue[data-room='overflowing'] {
  font-size: 16.5px;
  line-height: 30px;
  letter-spacing: -0.01em;
}

.dlu-heroDetail {
  font-size: 11px;
  line-height: 1.4;
  color: var(--dsw-alias-label-caption);
}

/* Figures still on screen after the selection moved on.
 *
 * Only the figures fade, never the box: the strip keeps its exact height and the
 * calendar below it keeps its place, which is the whole reason the previous
 * report is left mounted instead of being replaced by a placeholder. The fade is
 * slow enough to read as a state and not as a glitch, and it is only ever reached
 * when the fold behind it has outlived the flicker threshold. The ranking's own
 * header is left at full strength: it is the line that says what is happening. */
.dlu-summary .dlu-hero,
.dlu-summary .dlu-tiles,
.dlu-rank .dlu-rankList,
.dlu-rank .dlu-rankRowHead,
.dlu-rank .dlu-rankMore {
  transition: opacity 140ms ease-out;
}

.dlu-summary[data-stale='true'] .dlu-hero,
.dlu-summary[data-stale='true'] .dlu-tiles,
.dlu-rank[data-stale='true'] .dlu-rankList,
.dlu-rank[data-stale='true'] .dlu-rankRowHead,
.dlu-rank[data-stale='true'] .dlu-rankMore {
  opacity: 0.45;
}

/* Seven tiles, in a column count the panel's width decides and nothing else.
 *
 * This is the rule that keeps a big figure from moving the page. The hero's
 * track is sized by its own content, so a seven-figure total beside these tiles
 * leaves them less room — and with an auto-fitting grid that narrower room is
 * what decides how many rows they take, which is a change in the strip's height
 * caused by the data. Pinning the count to the container makes the row count a
 * property of the panel, and the figures inside a tile adapt instead.
 *
 * 'minmax(0, 1fr)' rather than a pixel floor, for the same reason: a floor is
 * what turns a narrow panel into a row that overflows it. */
.dlu-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

@container (min-width: 440px) {
  .dlu-tiles {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@container (min-width: 640px) {
  .dlu-tiles {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@container (min-width: 920px) {
  .dlu-tiles {
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }
}

.dlu-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 7px 9px;
  background: var(--dsw-alias-bg-layer-1);
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
}

/* One figure per line, clipped rather than wrapped if it ever outgrows its tile:
 * the tokens in here are already at a compact scale, so a value that cannot fit
 * is a case worth losing a digit of rather than a reason to move the page. The
 * exact figure is one hover or one drill-down away. */
.dlu-tileValue {
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-primary);
}

.dlu-tileLabel {
  overflow: hidden;
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-tileDetail {
  overflow: hidden;
  font-size: 10.5px;
  line-height: 1.4;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-caption);
}

.dlu-empty {
  margin: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

/* A directory that opens onto its own sessions: the whole cell is the control,
 * so the hit target is the row a reader is already pointing at. */
.dlu-projectToggle {
  display: block;
  inline-size: 100%;
  padding: 0;
  font: inherit;
  color: inherit;
  text-align: start;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.dlu-projectToggle:focus-visible {
  outline: 2px solid var(--dsw-alias-link);
  outline-offset: 2px;
}

.dlu-projectToggleHint {
  display: block;
  margin-top: 1px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-caption);
}

/* One session of an opened directory, indented under it and set a step quieter
 * than the directory it belongs to. */
.dlu-sessionInTable th,
.dlu-sessionInTable td {
  padding-block: 5px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-sessionInTable .dlu-sessionName {
  display: block;
  padding-left: 16px;
  font-size: 11.5px;
  font-weight: 400;
}

/* The price cards, one per model.

 * A card is a block rather than a table row: it states two sets of four prices
 * and a switch, which is nine controls, and nine columns of a table would be
 * unreadable at the width this popover has. Stacked, each card reads as one
 * model's price sheet. */
.dlu-editorCards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dlu-editorCard {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-inline-size: 0;
  margin: 0;
  padding: 10px 12px 11px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
}

.dlu-editorCardName {
  padding: 0 5px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-primary);
}

.dlu-editorCardRow {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.dlu-editorToggle {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}

.dlu-editorToggle input {
  inline-size: 13px;
  block-size: 13px;
  margin: 0;
  accent-color: var(--dsw-alias-link);
}

/* Each set of four prices: the label states which half of the day the numbers
 * are for, and the four fields line up across cards so they can be compared
 * down the block. */
.dlu-editorPriceRow {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.dlu-editorPriceLabel {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-editorPriceFields {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.dlu-editorPriceField {
  display: flex;
  min-inline-size: 0;
}

.dlu-editorPriceField .dlu-editorField {
  inline-size: 100%;
}

/* ── The range's wave ─────────────────────────────────────────────────── */

/* The range's own shape, under the calendar: the calendar answers a year, this
 * answers the window the reader selected. */
.dlu-wave {
  /* Border-box, like the rest of the app: with the default content-box the wave
   * and the calendar came out 42px wider than the panel's content box once their
   * own padding and border were added, and the panel — which scrolls — answered
   * with a 21px horizontal scrollbar for a figure that fits. */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 16px 20px 14px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
}

.dlu-waveCaption {
  display: flex;
  gap: 9px;
  align-items: baseline;
}

.dlu-waveTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.dlu-waveScope {
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-waveTotal {
  margin-left: auto;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
}

/* The drawing's box. Fixed height so a window with one point and a window with
 * three hundred are the same figure, and the page does not resize as ranges
 * change. */
.dlu-waveFrame {
  position: relative;
  block-size: 132px;
}

.dlu-waveSvg {
  display: block;
  inline-size: 100%;
  block-size: 100%;
}

/* The fill travels with the theme: the brand blue mixed into the page, dark at
 * the crest and dissolving into the surface at the baseline. */
.dlu-waveStopTop {
  stop-color: var(--dsw-alias-link);
  stop-opacity: 0.42;
}

.dlu-waveStopBottom {
  stop-color: var(--dsw-alias-link);
  stop-opacity: 0.04;
}

.dlu-waveLine {
  fill: none;
  stroke: var(--dsw-alias-link);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dlu-waveEmpty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

/* Waiting: the logo's whale at the centre of the frame, breathing a column of
 * water over its head. Drawn in CSS pixels rather than in the figure's own
 * coordinates, which have no aspect ratio to keep. */
.dlu-waveSpout {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  align-items: center;
  justify-content: center;
}

.dlu-waveSpoutWhale {
  fill: var(--dsw-alias-link);
  transform-origin: 50% 62%;
  /* Two motions at two speeds: it rises on the breath and rolls slowly, which is
   * what floating looks like. One oscillation alone reads as a pulsing icon. */
  animation:
    dlu-breath 3.6s ease-in-out infinite,
    dlu-float 6.4s ease-in-out infinite;
}

.dlu-waveSpoutWater {
  /* Up against the belly: a waterline an animal is not touching reads as a
   * second object rather than as the water it is in. */
  margin-block-start: -5px;
}

.dlu-waveSpoutRipple {
  fill: none;
  stroke: var(--dsw-alias-link);
  stroke-width: 0.9;
  transform-box: fill-box;
  transform-origin: 50% 50%;
  animation: dlu-ripple 3.4s ease-out infinite;
}

.dlu-waveSpoutRipple[data-lag='true'] {
  animation-delay: -1.7s;
}

/* Anchored at the foot of the column — the whale's head — so the water climbs. */
.dlu-waveSpoutJet {
  fill: var(--dsw-alias-link);
  transform-origin: 50% 100%;
  animation: dlu-spout 3.6s ease-in-out infinite;
}

/* Anchored at the column's tip, so a scale is the drops travelling outward from
 * it. The breath, the column and the break are one event on one clock. */
.dlu-waveSpoutSpray {
  fill: var(--dsw-alias-link);
  transform-origin: 13px 5.6px;
  animation: dlu-spray 3.6s ease-out infinite;
}

/* The animal breathes, and the water answers: the column climbs with the breath
 * and falls with it, so the two read as one motion rather than as a spinner
 * beside a picture. */
@keyframes dlu-breath {
  0%, 100% {
    transform: translateY(0) scale(0.99);
  }

  50% {
    transform: translateY(-1.5px) scale(1.01);
  }
}

@keyframes dlu-spout {
  0%, 100% {
    opacity: 0.55;
    transform: scaleY(0.34);
  }

  45% {
    opacity: 1;
    transform: scaleY(1);
  }

  70% {
    opacity: 0.85;
    transform: scaleY(0.7);
  }
}

/* A slow roll about its own middle, as if the water were moving under it. */
@keyframes dlu-float {
  0%, 100% {
    rotate: -1.4deg;
  }

  50% {
    rotate: 1.4deg;
  }
}

/* A ring leaving the body: it widens as it goes and thins to nothing. */
@keyframes dlu-ripple {
  0% {
    opacity: 0.5;
    transform: scale(0.42);
  }

  70% {
    opacity: 0.16;
  }

  100% {
    opacity: 0;
    transform: scale(1.35);
  }
}

/* Outward and gone: the drops leave the tip as a crown and thin to nothing, so
 * the column reads as breaking rather than as stopping. */
@keyframes dlu-spray {
  0%, 10% {
    opacity: 0;
    transform: scale(0.3);
  }

  34% {
    opacity: 0.95;
    transform: scale(0.8);
  }

  58% {
    opacity: 0.45;
    transform: scale(1.2);
  }

  82%, 100% {
    opacity: 0;
    transform: scale(1.5);
  }
}

/* The window listed under the figure: by model, then by project. Two tables in
 * one block, because they are the same table asking two questions, and the
 * spacing between them is what says they are separate answers rather than one
 * long list. */
.dlu-statsBlock {
  display: flex;
  flex-direction: column;
  gap: 18px;
  /* A table is read down its columns, and columns spread across a full-width
   * panel stop being comparable: the eye has to travel to pair a route with its
   * cost. Held to a measure and centred under the figure, the same rows read as a
   * table rather than as four lists side by side. */
  inline-size: 100%;
  max-inline-size: 860px;
  margin-inline: auto;
}

.dlu-tableBlock {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dlu-tableHeading {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

/* What a truncated table left out, said rather than implied: a table that stops
 * at eight rows without saying so reads as a window with eight routes. */
.dlu-tableNote {
  margin: 0;
  font-size: 11px;
  color: var(--dsw-alias-label-caption);
}

/* The route or directory column of these tables has more to say than the day
 * page's does — a fallback-rate badge rides beside the name — so it keeps the
 * row's line box from growing by seating the badge on the baseline. */
.dlu-tableBlock .dlu-unpricedBadge {
  margin-left: 8px;
  vertical-align: baseline;
}

/* The axis names several points, not just the ends. Each label is placed on the
 * share of the width its point sits at, and the two ends are pulled inward so a
 * label under the first or last bucket stays inside the figure. */
.dlu-waveTicks {
  position: relative;
  block-size: 15px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-caption);
}

.dlu-waveTick {
  position: absolute;
  inset-block-start: 0;
  white-space: nowrap;
  transform: translateX(-50%);
}

.dlu-waveTick[data-edge='start'] {
  transform: none;
}

.dlu-waveTick[data-edge='end'] {
  transform: translateX(-100%);
}

.dlu-wavePeak {
  color: var(--dsw-alias-label-tertiary);
}

/* ── The range's detail view ──────────────────────────────────────────── */

/* A page rather than a figure: the front panel states the range, this one takes
 * it apart. It reuses the day page's frame and tables so the two read as the same
 * surface, and adds only what its own blocks need. */
.dlu-breakdown {
  display: flex;
  flex-direction: column;
  gap: 22px;
}

/* The front page's way in, set as a text control: an icon would have to be
 * learned, and this is navigation rather than a tool. */
.dlu-breakout {
  padding: 5px 11px;
  font: inherit;
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  background: transparent;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 9px;
  transition: background-color 120ms ease-out;
}

.dlu-breakout:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dlu-breakout:focus-visible {
  outline: 2px solid var(--dsw-alias-link);
  outline-offset: 1px;
}

.dlu-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 16px;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
}

.dlu-blockTitle {
  margin: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.dlu-blockHint {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}

/* Readings wrap rather than count: unlike the front page's strip, whose height
 * a figure must not be able to change, this grid has room to reflow and a
 * reading that needs two lines may have them. */
.dlu-readings {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 8px;
}

.dlu-reading {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 9px 11px;
  background: var(--dsw-alias-bg-layer-1);
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
}

.dlu-readingLabel {
  font-size: 11px;
  line-height: 1.4;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-readingValue {
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  color: var(--dsw-alias-label-primary);
}

.dlu-readingDetail {
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--dsw-alias-label-caption);
  /* A caption may wrap: an address or a share plus a count is worth two lines
   * where a figure is not. */
  overflow-wrap: anywhere;
}

/* Bars: the label and the value are fixed so the track is the only thing whose
 * length carries meaning, and a long label cannot shorten the chart. */
.dlu-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dlu-barRow {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 84px;
  gap: 10px;
  align-items: center;
  font-size: 11.5px;
}

.dlu-barLabel {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-barTrack {
  block-size: 8px;
  overflow: hidden;
  background: color-mix(in oklab, var(--dsw-alias-label-primary) 8%, transparent);
  border-radius: 999px;
}

.dlu-barFill {
  display: block;
  block-size: 100%;
  background: var(--dsw-alias-link);
  border-radius: inherit;
}

.dlu-barValue {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-align: right;
  color: var(--dsw-alias-label-secondary);
}

/* The detail view's tables: the day page's table, named for this page so a
 * change to one does not silently restyle the other. */
.dlu-table {
  inline-size: 100%;
  font-size: 12px;
  border-collapse: collapse;
}

.dlu-table th {
  padding: 0 0 6px;
  font-weight: 400;
  color: var(--dsw-alias-label-caption);
  text-align: left;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}

.dlu-table td {
  padding: 7px 0;
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}

.dlu-table th.dlu-cellName {
  padding-right: 20px;
  font-weight: 500;
  vertical-align: top;
  color: var(--dsw-alias-label-primary);
}

.dlu-table .dlu-numeric {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-align: right;
}

/* A route no configured card claimed: it is priced at the fallback rate, and
 * the badge is what stops that figure reading as a matched price. */
.dlu-unpricedBadge {
  display: inline-block;
  margin-left: 8px;
  padding: 0 6px;
  font-size: 10px;
  line-height: 1.6;
  color: var(--dsw-alias-label-caption);
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
}

.dlu-sessionList {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dlu-sessionRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 2px 12px;
  align-items: baseline;
  padding: 7px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}

.dlu-sessionName {
  overflow: hidden;
  font-size: 12.5px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--dsw-alias-label-primary);
}

.dlu-sessionFigures {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
}

/* ── Calendar ─────────────────────────────────────────────────────────── */

/* Border-box for the same reason as the wave below: the figure paints its own
 * padding, and the panel must not grow a scrollbar for it. */
.dlu-calendar {
  box-sizing: border-box;

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
  /* One line, like every other figure: this one sits in a caption beside the
   * window label, and a wrapped total would change the figure's height. */
  white-space: nowrap;
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
 * text-align of its own. One line per figure: a large amount widens its column
 * and lets the directory name column absorb it, rather than folding the row. */
.dlu-projectTable .dlu-numeric {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
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

/* ── The loading frame ────────────────────────────────────────────────── */

/* The read's own account of itself: one sentence, and a bar that is either a
 * measured share of the work or a sweep standing in for a size nobody knows
 * yet. It sits where the figures will, not floating over them. */
.dlu-loading {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-bottom: 2px;
}

.dlu-loadingText {
  margin: 0;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}

.dlu-loadingTrack {
  position: relative;
  overflow: hidden;
  block-size: 3px;
  background: color-mix(in oklab, var(--dsw-alias-label-primary) 10%, var(--dsw-alias-bg-base));
  border-radius: 2px;
}

.dlu-loadingFill {
  block-size: 100%;
  background: var(--dsw-alias-link);
  border-radius: inherit;
  /* A measured share is a figure, so it takes the panel's bar transition rather
   * than a fresh animation: it should slide to the new count, not restart. */
  transition: inline-size 220ms ease-out;
}

/* Unmeasured: no number to draw, so a third of the track sweeps instead. */
.dlu-loadingTrack[data-measured='false'] .dlu-loadingFill {
  inline-size: 33%;
  animation: dlu-sweep 1.5s ease-in-out infinite;
}

@keyframes dlu-sweep {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(300%);
  }
}

/* A placeholder for a figure: the height and rhythm of the line it stands in
 * for, and nothing else. Ghosts of the *frame* are drawn as the frame, so this
 * is only ever a stand-in for a number or a word. */
/* A placeholder for a figure: the height and rhythm of the line it stands in
 * for, and nothing else.
 *
 * Each ghost is the height of the *line box* it replaces, with the difference
 * carried as a block margin rather than as a taller bar: a text line is mostly
 * leading, and a placeholder drawn at the line's full height would read as a
 * filled block. Matching the box is what keeps the frame from settling when the
 * real line arrives — the whole point of drawing one. */
.dlu-skelLine {
  display: block;
  block-size: 10px;
  background: color-mix(in oklab, var(--dsw-alias-label-primary) 9%, var(--dsw-alias-bg-base));
  border-radius: 4px;
}

/* The hero's label: 12.5px at 1.4. */
.dlu-skelLine[data-width='short'] {
  inline-size: 46px;
  block-size: 9px;
  margin-block: 4.25px;
}

/* The headline figure: pinned to the same 30px block the real one reserves. */
.dlu-skelLine[data-width='hero'] {
  inline-size: 132px;
  block-size: 24px;
  margin-block: 3px;
}

/* The peak note under it: 11px at 1.4. */
.dlu-skelLine[data-width='detail'] {
  inline-size: 108px;
  block-size: 9px;
  margin-block: 3.2px;
}

/* A tile's value: 14.5px at 1.2. */
.dlu-skelLine[data-width='value'] {
  inline-size: 70%;
  margin-block: 3.7px;
}

/* A tile's label: 11px at 1.4. */
.dlu-skelLine[data-width='label'] {
  inline-size: 48%;
  block-size: 8px;
  margin-block: 3.7px;
}

.dlu-skelLine[data-width='total'] {
  inline-size: 72px;
}

.dlu-skelLine[data-width='heading'] {
  inline-size: 112px;
  block-size: 12px;
}

.dlu-skelLine[data-width='scope'] {
  inline-size: 148px;
  block-size: 9px;
}

/* A ranked directory's name: 12.5px. */
.dlu-skelLine[data-width='name'] {
  inline-size: 62%;
  block-size: 9px;
  margin-block: 3px;
}

/* Its path underneath: 10.5px, plus the 1px the real one is offset by. */
.dlu-skelLine[data-width='path'] {
  inline-size: 78%;
  block-size: 8px;
  margin-block: 2.3px;
  margin-block-start: 3.3px;
}

.dlu-skelLine[data-width='cell'] {
  inline-size: 40px;
  block-size: 9px;
  margin-left: auto;
}

/* The calendar's ghost cell: the size and radius of a real one, in the empty
 * step's own colour, so the year reads as a year with nothing in it yet rather
 * than as a different figure. */
.dlu-cellGhost {
  display: block;
  background: color-mix(in oklab, var(--dsw-alias-label-primary) 4%, var(--dsw-alias-bg-base));
  border-radius: 4px;
}

/* The ranking's ghost bars: the shape of the list, which is the one thing about
 * it that can be drawn before it arrives. Its own class rather than the real
 * fill's, so the shipped bars keep their colour. */
.dlu-skelBar {
  display: block;
  block-size: 100%;
  background: color-mix(in oklab, var(--dsw-alias-label-primary) 9%, var(--dsw-alias-bg-base));
  border-radius: inherit;
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

/* Every right-aligned figure in a table: one line, so a large amount widens its
 * column instead of folding the row in half. */
.dlu-numeric {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
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


/* ── Header tools: the rate table and the provenance block ────────────── */

.dlu-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dlu-popoverHost {
  position: relative;
  display: inline-flex;
}

.dlu-iconButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  inline-size: 28px;
  block-size: 28px;
  padding: 0;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  cursor: pointer;
}

.dlu-iconButton:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dlu-iconButton:focus-visible {
  outline: 2px solid var(--dsw-alias-link);
  outline-offset: 1px;
}

.dlu-iconButton[aria-expanded='true'] {
  color: var(--dsw-alias-link);
  border-color: var(--dsw-alias-link);
}

/* Waiting on the report behind it: still a control, visibly not yet a live one.
 * It keeps its box, so the header does not reflow when the read lands. */
.dlu-iconButton[data-disabled='true'] {
  color: var(--dsw-alias-label-caption);
  cursor: default;
  opacity: 0.5;
}

.dlu-iconButton[data-disabled='true']:hover {
  color: var(--dsw-alias-label-caption);
  background: transparent;
}

/* Anchored to the trigger and scrollable: the rate panel carries a table and an
 * editor, and neither is allowed to push the panel off the bottom of the frame. */
.dlu-popoverPanel {
  position: absolute;
  z-index: 30;
  inset-block-start: calc(100% + 8px);
  inset-inline-end: 0;
  inline-size: var(--dlu-popover-inline, 560px);
  max-block-size: min(70vh, 640px);
  max-inline-size: calc(100vw - 32px);
  overflow: auto;
  padding: 14px 16px 16px;
  text-align: start;
  background: var(--dsw-alias-bg-overlay);
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  box-shadow: 0 18px 44px rgb(0 0 0 / 0.18);
}

/* The eight pixels between the trigger and the panel are the panel's, not a
 * gap. Without this the pointer leaves the host while crossing them, the panel
 * closes under the hand travelling towards it, and the reference material is
 * unreachable by hover — which is the whole gesture. A transparent strip above
 * the panel makes the crossing one continuous hit area. */
.dlu-popoverPanel::before {
  content: '';
  position: absolute;
  inset-block-start: -8px;
  inset-inline: 0;
  block-size: 8px;
}

.dlu-popoverTitle {
  margin: 0 0 8px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

/* ── Project ranking ──────────────────────────────────────────────────── */

.dlu-rank {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px 14px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 16px;
}

.dlu-rankHead {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: baseline;
  justify-content: space-between;
}

.dlu-rankTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.dlu-rankScope {
  margin: 0;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-rankList {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* One grid for the column heads and every row, so a number's meaning is stated
 * once at the top instead of beside each figure. */
.dlu-rankRow {
  display: grid;
  /* The three figure columns are sized to what they hold rather than to a fixed
   * pixel count: a four-figure cost in a 92px track is a wrapped number, and a
   * wrapped number is both unreadable and a row that changed height. The name
   * and bar tracks absorb the difference, so the row stays one line. */
  grid-template-columns:
    30px minmax(0, 1fr) minmax(80px, 1.3fr)
    minmax(86px, max-content) minmax(92px, max-content) minmax(54px, max-content);
  gap: 12px;
  align-items: center;
  padding: 6px 0;
}

.dlu-rankRowHead {
  padding-block: 0 5px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-caption);
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}

.dlu-rankPlace {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-caption);
}

.dlu-rankName {
  min-width: 0;
}

.dlu-rankNameText {
  display: block;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}

.dlu-rankPath {
  display: block;
  margin-top: 1px;
  font-size: 10.5px;
  color: var(--dsw-alias-label-caption);
  overflow-wrap: anywhere;
}

/* The bar is the share of the leader, so the ranking stays readable when one
 * project dominates: scaled to the total, every other row would be a sliver. */
.dlu-rankBar {
  block-size: 8px;
  overflow: hidden;
  background: color-mix(in oklab, var(--dsw-alias-label-primary) 9%, transparent);
  border-radius: 999px;
}

.dlu-rankBarFill {
  display: block;
  block-size: 100%;
  background: var(--dsw-alias-link);
  border-radius: inherit;
}

.dlu-rankTokens,
.dlu-rankCost,
.dlu-rankSessions {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
  text-align: right;
}

.dlu-rankCost {
  font-weight: 500;
  color: var(--dsw-alias-label-primary);
}

.dlu-rankMore {
  align-self: flex-start;
  padding: 5px 10px;
  font-size: 11.5px;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  cursor: pointer;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
}

.dlu-rankMore:hover:not(:disabled) {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-interactive-bg-hover);
}

.dlu-rankMore:focus-visible {
  outline: 2px solid var(--dsw-alias-link);
  outline-offset: 1px;
}

.dlu-rankMore:disabled {
  cursor: default;
  opacity: 0.5;
}

/* ── Rate editor ──────────────────────────────────────────────────────── */

.dlu-editor {
  padding-top: 12px;
  margin-top: 14px;
  border-top: 0.5px dashed var(--dsw-alias-border-l2);
}

.dlu-editorTitle {
  margin: 0 0 4px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary);
}

.dlu-editorHint {
  margin: 0 0 10px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-editorTable {
  inline-size: 100%;
  font-size: 11.5px;
  border-collapse: collapse;
}

.dlu-editorTable th {
  padding: 0 0 6px;
  font-weight: 400;
  color: var(--dsw-alias-label-caption);
  text-align: left;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}

.dlu-editorTable .dlu-numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.dlu-editorTable td {
  padding: 5px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1);
}

.dlu-editorTable th[scope='row'] {
  max-inline-size: 168px;
  padding-right: 8px;
}

.dlu-editorSource {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: var(--dsw-alias-label-caption);
}

.dlu-editorSource[data-source='override'] {
  color: var(--dsw-alias-link);
}

.dlu-editorField {
  inline-size: 60px;
  padding: 3px 6px;
  font: inherit;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
  text-align: right;
  background: var(--dsw-alias-bg-base);
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
}

.dlu-editorField:focus-visible {
  outline: 2px solid var(--dsw-alias-link);
  outline-offset: 0;
}

.dlu-editorField[aria-invalid='true'] {
  border-color: var(--dsw-alias-state-error-primary);
}

.dlu-editorActions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-top: 10px;
}

.dlu-editorStatus {
  font-size: 11px;
  color: var(--dsw-alias-label-tertiary);
}

.dlu-editorError {
  font-size: 11px;
  color: var(--dsw-alias-state-error-primary);
}

.dlu-visuallyHidden {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 720px) {
  /* One figure per row: the hero stops sharing a line with its tiles, and the
   * ranking drops the bar rather than crushing six columns into a phone. */
  .dlu-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .dlu-hero {
    padding-right: 0;
    border-right: 0;
  }

  .dlu-rankRow {
    grid-template-columns: 26px minmax(0, 1fr) 84px 62px;
  }

  .dlu-rankBar,
  .dlu-rankSessions {
    display: none;
  }

  /* A narrow viewport has no room for a 640px panel anchored to a trigger, so
   * the panel becomes a sheet under the header instead of overflowing it. */
  .dlu-popoverPanel {
    position: fixed;
    inset-inline: 16px;
    inset-block-start: 88px;
    inline-size: auto;
    max-inline-size: none;
    max-block-size: calc(100vh - 150px);
  }
}

@media (max-width: 560px) {
  .dlu-panel {
    padding: 20px 16px 40px;
  }

  .dlu-heroValue {
    font-size: 24px;
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
  /* A spout that cannot move is still a spout: it holds the column up. */
  .dlu-waveSpoutWhale,
  .dlu-waveSpoutJet,
  .dlu-waveSpoutSpray,
  .dlu-waveSpoutRipple {
    animation: none;
  }

  /* Held mid-breath: a crown of drops over the column. */
  .dlu-waveSpoutSpray {
    opacity: 0.9;
    transform: scale(0.95);
  }

  /* A still ring states the waterline; an invisible one states nothing. */
  .dlu-waveSpoutRipple {
    opacity: 0.3;
    transform: scale(0.8);
  }

  .dlu-waveSpoutJet {
    opacity: 0.85;
  }

    opacity: 1;
  }

    .dlu-wavePlot {
    animation: none;
  }

  .dlu-cell,
  .dlu-range,
  .dlu-loadingFill,
  .dlu-summary .dlu-hero,
  .dlu-summary .dlu-tiles,
  .dlu-rank .dlu-rankList,
  .dlu-rank .dlu-rankRowHead,
  .dlu-rank .dlu-rankMore {
    transition: none;
  }

  .dlu-cell:hover {
    transform: none;
  }

  /* A sweep that cannot be read as motion is not a progress bar; a still, dimmed
   * track says the same thing without moving. */
  .dlu-loadingTrack[data-measured='false'] .dlu-loadingFill {
    inline-size: 100%;
    opacity: 0.35;
    animation: none;
  }
}
`
