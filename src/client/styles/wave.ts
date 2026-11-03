/**
 * The range wave and its axis.
 *
 * A fragment of the one sheet the panel injects; order is preserved by
 * `styles.ts`, which assembles these strings once.
 *
 * @module dsh-local-usage/client/styles/wave
 */

export const wave = String.raw`/* ── The range's wave ─────────────────────────────────────────────────── */

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
  /* The tables take the same measure as the cards above them: a block inset on
   * both sides reads as a different surface, and its figures stop lining up with
   * anything else on the page. */
  inline-size: 100%;
}

/* Two tables of the same four columns, laid out by the same shares: a route's
 * cost and a directory's cost sit in the same column, so the block can be read
 * down as one grid rather than as two tables that happen to be stacked. */
.dlu-statsTable {
  table-layout: fixed;
}

.dlu-statsColName {
  inline-size: 58%;
}

.dlu-statsColTokens {
  inline-size: 16%;
}

.dlu-statsColCost {
  inline-size: 14%;
}

.dlu-statsColCount {
  inline-size: 12%;
}

/* The second line of a figure cell says what the figure means rather than
 * repeating another one: the share of the prompt served from cache, and the cost
 * of one million tokens. Two rows of the same model can differ thirtyfold on
 * these alone, which is exactly the question a cost column cannot answer. */
.dlu-statsNote {
  display: block;
  margin-top: 1px;
  font-size: 10.5px;
  line-height: 1.3;
  color: var(--dsw-alias-label-tertiary);
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

`
