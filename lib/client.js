window.__ModuleLoader__.load({
	id: "dsh-local-usage",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/heatmap-grid.ts
		/**
		* Calendar geometry: the rolling window, its column count, and the month
		* markers above it.
		*
		* Pure and date-in only, so the arithmetic that decides where every cell lands
		* is testable without a browser. The window opens on a Sunday and closes on the
		* day the panel treats as today, which keeps every column a whole week and lets
		* a narrow panel drop leading columns without splitting one.
		*
		* @module dsh-local-usage/client/heatmap-grid
		*/
		const MS_PER_DAY$2 = 864e5;
		const DAYS_PER_WEEK = 7;
		/** Local midnight of one instant. */
		function midnight(time) {
			const date = new Date(time);
			return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
		}
		/** Local `YYYY-MM-DD` key for one instant. */
		function dayKey(time) {
			const date = new Date(time);
			return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
		}
		/**
		* Inclusive bounds of the calendar window: `weeks` whole columns ending with
		* the week that contains `now`, opening on a Sunday.
		* @param now - the instant the panel treats as today.
		* @param weeks - number of week columns to span.
		* @returns `[from, to]` in Unix epoch milliseconds.
		*/
		function heatmapWindow(now, weeks) {
			const today = midnight(now);
			const elapsed = new Date(today).getDay();
			return [today - ((weeks - 1) * DAYS_PER_WEEK + elapsed) * MS_PER_DAY$2, today + MS_PER_DAY$2 - 1];
		}
		/**
		* Column count spanning an inclusive day range, rounded up to whole weeks.
		* @param from - first day, Unix epoch milliseconds.
		* @param to - last day inclusive, Unix epoch milliseconds.
		* @returns the number of week columns.
		*/
		function heatmapColumns(from, to) {
			const days = (midnight(to) - midnight(from)) / MS_PER_DAY$2 + 1;
			return Math.max(1, Math.ceil(days / DAYS_PER_WEEK));
		}
		/**
		* Month labels for the last twelve months that fall inside the visible columns.
		* @param windowStart - first rendered day, Unix epoch milliseconds (a Sunday).
		* @param to - last rendered day inclusive, Unix epoch milliseconds.
		* @param columns - visible column count.
		* @returns one marker per month, ascending by column.
		*/
		function monthMarkers(windowStart, to, columns) {
			const markers = [];
			const used = /* @__PURE__ */ new Set();
			const end = new Date(midnight(to));
			for (let back = 11; back >= 0; back -= 1) {
				const month = new Date(end.getFullYear(), end.getMonth() - back, 1);
				const index = Math.floor((midnight(month.getTime()) - windowStart) / MS_PER_DAY$2 / DAYS_PER_WEEK);
				if (index < 0 || index >= columns || used.has(index)) continue;
				used.add(index);
				markers.push({
					key: `${String(month.getFullYear())}-${String(month.getMonth())}`,
					month: month.getMonth() + 1,
					index
				});
			}
			return markers.sort((left, right) => left.index - right.index);
		}
		//#endregion
		//#region src/client/classes.ts
		/** Class names owned by this plugin's stylesheet.
		*
		* Plain prefixed names rather than CSS Modules: a plugin served outside the
		* product's build has to compile and inject its own sheet, and a build-time
		* class map is machinery this package can do without.
		*
		* @module dsh-local-usage/client/classes
		*/
		/** Every class the panel's stylesheet defines. */
		const css = {
			calendar: "dlu-calendar",
			calendarCaption: "dlu-calendarCaption",
			calendarHeading: "dlu-calendarHeading",
			calendarMeasure: "dlu-calendarMeasure",
			calendarScroll: "dlu-calendarScroll",
			calendarTitle: "dlu-calendarTitle",
			calendarTotal: "dlu-calendarTotal",
			calendarYear: "dlu-calendarYear",
			cell: "dlu-cell",
			cells: "dlu-cells",
			controls: "dlu-controls",
			disclosure: "dlu-disclosure",
			disclosureBody: "dlu-disclosureBody",
			disclosureSummary: "dlu-disclosureSummary",
			empty: "dlu-empty",
			facts: "dlu-facts",
			failure: "dlu-failure",
			gridRow: "dlu-gridRow",
			header: "dlu-header",
			headerText: "dlu-headerText",
			heading: "dlu-heading",
			hero: "dlu-hero",
			heroDetail: "dlu-heroDetail",
			heroLabel: "dlu-heroLabel",
			heroValue: "dlu-heroValue",
			legend: "dlu-legend",
			legendHint: "dlu-legendHint",
			legendLabel: "dlu-legendLabel",
			legendPeak: "dlu-legendPeak",
			legendScale: "dlu-legendScale",
			legendSwatch: "dlu-legendSwatch",
			monthLabel: "dlu-monthLabel",
			monthRow: "dlu-monthRow",
			notes: "dlu-notes",
			numeric: "dlu-numeric",
			panel: "dlu-panel",
			priceCurrency: "dlu-priceCurrency",
			priceMatch: "dlu-priceMatch",
			priceTable: "dlu-priceTable",
			pricingCaveat: "dlu-pricingCaveat",
			pricingHint: "dlu-pricingHint",
			pricingRatesLabel: "dlu-pricingRatesLabel",
			range: "dlu-range",
			ranges: "dlu-ranges",
			scan: "dlu-scan",
			status: "dlu-status",
			subtitle: "dlu-subtitle",
			summary: "dlu-summary",
			tile: "dlu-tile",
			tileDetail: "dlu-tileDetail",
			tileLabel: "dlu-tileLabel",
			tileValue: "dlu-tileValue",
			tiles: "dlu-tiles",
			tooltip: "dlu-tooltip",
			tooltipDate: "dlu-tooltipDate",
			tooltipDot: "dlu-tooltipDot",
			tooltipEmpty: "dlu-tooltipEmpty",
			tooltipHead: "dlu-tooltipHead",
			tooltipHero: "dlu-tooltipHero",
			tooltipHeroLabel: "dlu-tooltipHeroLabel",
			tooltipHeroValue: "dlu-tooltipHeroValue",
			tooltipRows: "dlu-tooltipRows",
			tooltipWeekday: "dlu-tooltipWeekday",
			warning: "dlu-warning",
			weekday: "dlu-weekday",
			weekdayColumn: "dlu-weekdayColumn"
		};
		//#endregion
		//#region src/client/CalendarHeatmap.tsx
		/**
		* The year in usage: one cell per day, shaded by what that day cost.
		*
		* There is no charting library in this product and adding one is out of bounds,
		* so the calendar is a CSS grid of fixed-size cells — never fractional tracks,
		* because a cell whose box depends on its track width has no stable intrinsic
		* size to lay out against. A ResizeObserver measures the panel instead: while a
		* year of weeks fits at the minimum cell edge the cells grow to fill it, and
		* below that the grid keeps the minimum edge and drops its oldest weeks. Either
		* way the grid never scrolls sideways.
		*
		* Shading is a quantile ramp over the window's active days (median, then 75th
		* and 90th percentiles), so the scale adapts to how the profile actually spends
		* instead of assuming a distribution.
		*
		* @module dsh-local-usage/client/CalendarHeatmap
		*/
		const MS_PER_DAY$1 = 864e5;
		const WEEKDAY_ROWS = 7;
		/** Narrowest cell edge; below the width that fits a year of them the grid trims weeks. */
		const MIN_CELL_SIZE = 15;
		const CELL_GAP = 4;
		/** Weekday-label gutter, measured in the same fixed pixels as the cells. */
		const LABEL_WIDTH = 20;
		/** Tooltip clamp so a card on an edge column stays on screen. */
		const TOOLTIP_HALF_WIDTH = 150;
		/** Approximate card height; below this viewport offset the card flips under the cell. */
		const TOOLTIP_FLIP_ABOVE = 320;
		/** Sunday-first weekday names, matching the `wd.*` dictionary keys. */
		const WEEKDAY_KEYS = [
			"wd.0",
			"wd.1",
			"wd.2",
			"wd.3",
			"wd.4",
			"wd.5",
			"wd.6"
		];
		/** Compact row gutter labels, matching the `wdShort.*` dictionary keys. */
		const WEEKDAY_SHORT_KEYS = [
			"wdShort.0",
			"wdShort.1",
			"wdShort.2",
			"wdShort.3",
			"wdShort.4",
			"wdShort.5",
			"wdShort.6"
		];
		/** Tokens of one day row. */
		function tokensOf$1(row) {
			return row.uncachedInputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens;
		}
		/** Linear-interpolated quantile of an ascending, non-empty sample. */
		function quantile(sorted, q) {
			if (sorted.length === 0) return 0;
			const position = (sorted.length - 1) * q;
			const base = Math.floor(position);
			const left = sorted[base] ?? 0;
			return left + ((sorted[Math.min(sorted.length - 1, base + 1)] ?? left) - left) * (position - base);
		}
		/** The cell edge that fills `width`, never below the minimum. */
		function cellSizeFor(width, columns) {
			const gaps = Math.max(0, columns - 1) * CELL_GAP;
			const available = Math.max(0, width - LABEL_WIDTH - gaps);
			return Math.max(1, Math.floor(available / columns) || 1);
		}
		/** Track the widest cell edge the container can carry, and how many weeks then fit. */
		function useResponsiveGrid(totalColumns) {
			const containerRef = (0, react.useRef)(null);
			const [state, setState] = (0, react.useState)({
				cellSize: MIN_CELL_SIZE,
				columns: totalColumns
			});
			(0, react.useEffect)(() => {
				const element = containerRef.current;
				if (element === null || totalColumns <= 0) return;
				const update = () => {
					const width = element.clientWidth;
					const fitted = Math.floor((width - LABEL_WIDTH + CELL_GAP) / 19);
					const columns = Math.max(1, Math.min(totalColumns, fitted || 1));
					setState(columns >= totalColumns ? {
						cellSize: cellSizeFor(width, totalColumns),
						columns: totalColumns
					} : {
						cellSize: MIN_CELL_SIZE,
						columns
					});
				};
				update();
				const observer = new ResizeObserver(update);
				observer.observe(element);
				return () => {
					observer.disconnect();
				};
			}, [totalColumns]);
			return {
				containerRef,
				...state
			};
		}
		/**
		* Render the calendar grid plus its legend and hover card.
		* @param props - the window, its day rows, the selected range, formatters, and copy.
		* @returns the calendar figure.
		*/
		function CalendarHeatmap({ from, to, days, totalCost, peak, t, formatCost, formatInteger, formatDay }) {
			const [hover, setHover] = (0, react.useState)(void 0);
			const first = midnight(from);
			const last = midnight(to);
			const totalColumns = heatmapColumns(first, last);
			const byDay = (0, react.useMemo)(() => new Map(days.map((row) => [row.day, row])), [days]);
			const grid = (0, react.useMemo)(() => {
				const columns = [];
				for (let column = 0; column < totalColumns; column += 1) {
					const week = [];
					for (let row = 0; row < WEEKDAY_ROWS; row += 1) {
						const time = first + (column * WEEKDAY_ROWS + row) * MS_PER_DAY$1;
						if (time > last) {
							week.push(null);
							continue;
						}
						const day = dayKey(time);
						week.push({
							day,
							row: byDay.get(day)
						});
					}
					columns.push(week);
				}
				return columns;
			}, [
				byDay,
				first,
				last,
				totalColumns
			]);
			const levels = (0, react.useMemo)(() => {
				const active = days.map((row) => tokensOf$1(row)).filter((value) => value > 0).sort((a, b) => a - b);
				return {
					t1: quantile(active, .5),
					t2: quantile(active, .75),
					t3: quantile(active, .9)
				};
			}, [days]);
			const { containerRef, cellSize, columns: visibleColumns } = useResponsiveGrid(totalColumns);
			const visible = grid.slice(-visibleColumns);
			const visibleStart = first + (totalColumns - visibleColumns) * WEEKDAY_ROWS * MS_PER_DAY$1;
			const markers = (0, react.useMemo)(() => monthMarkers(visibleStart, last, visibleColumns).map((marker) => ({
				...marker,
				label: t("monthLabel", { n: String(marker.month) })
			})), [
				last,
				t,
				visibleColumns,
				visibleStart
			]);
			const trackTemplate = `${String(LABEL_WIDTH)}px repeat(${String(visibleColumns)}, ${String(cellSize)}px)`;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
				className: css.calendar,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figcaption", {
						className: css.calendarCaption,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.calendarHeading,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.calendarTitle,
								children: t("calendar")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.calendarYear,
								children: t("calendarWindow")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: css.calendarTotal,
							children: formatCost(totalCost)
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.calendarScroll,
						onMouseLeave: () => {
							setHover(void 0);
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							ref: containerRef,
							className: css.calendarMeasure,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: css.monthRow,
								style: {
									gridTemplateColumns: trackTemplate,
									columnGap: CELL_GAP
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}), markers.map((marker) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: css.monthLabel,
									"aria-hidden": "true",
									style: { gridColumnStart: marker.index + 2 },
									children: marker.label
								}, marker.key))]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: css.gridRow,
								style: {
									gridTemplateColumns: trackTemplate,
									columnGap: CELL_GAP
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: css.weekdayColumn,
									"aria-hidden": "true",
									style: {
										gridTemplateRows: `repeat(${String(WEEKDAY_ROWS)}, ${String(cellSize)}px)`,
										rowGap: CELL_GAP
									},
									children: WEEKDAY_SHORT_KEYS.map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.weekday,
										children: t(key)
									}, key))
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: css.cells,
									role: "grid",
									"aria-label": t("calendar"),
									style: {
										gridColumn: "2 / -1",
										gridAutoFlow: "column",
										gridTemplateRows: `repeat(${String(WEEKDAY_ROWS)}, ${String(cellSize)}px)`,
										gridTemplateColumns: `repeat(${String(visibleColumns)}, ${String(cellSize)}px)`,
										gap: CELL_GAP
									},
									children: visible.map((week, column) => week.map((cell, row) => {
										if (cell === null) return null;
										const tokens = cell.row === void 0 ? 0 : tokensOf$1(cell.row);
										const level = tokens <= 0 ? 0 : tokens <= levels.t1 ? 1 : tokens <= levels.t2 ? 2 : tokens <= levels.t3 ? 3 : 4;
										const time = visibleStart + (column * WEEKDAY_ROWS + row) * MS_PER_DAY$1;
										const weekday = new Date(time).getDay();
										const label = t("dayLabel", {
											day: formatDay(cell.day),
											weekday: t(WEEKDAY_KEYS[weekday] ?? "wd.0"),
											cost: formatCost(cell.row?.cost ?? 0),
											tokens: formatInteger(tokens),
											calls: formatInteger(cell.row?.calls ?? 0)
										});
										return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: css.cell,
											"data-level": level,
											role: "gridcell",
											"aria-label": label,
											style: {
												inlineSize: cellSize,
												blockSize: cellSize
											},
											onMouseEnter: (event) => {
												const rect = event.currentTarget.getBoundingClientRect();
												setHover({
													key: cell.day,
													weekday,
													row: cell.row,
													level,
													x: Math.min(Math.max(rect.left + rect.width / 2, TOOLTIP_HALF_WIDTH), window.innerWidth - TOOLTIP_HALF_WIDTH),
													y: rect.top,
													placement: rect.top < TOOLTIP_FLIP_ABOVE ? "below" : "above"
												});
											},
											onMouseLeave: () => {
												setHover(void 0);
											}
										}, cell.day);
									}))
								})]
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.legend,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.legendHint,
								children: t("calendarHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: css.legendScale,
								"aria-label": t("calendar"),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.legendLabel,
										children: t("legendLess")
									}),
									[
										0,
										1,
										2,
										3,
										4
									].map((level) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.legendSwatch,
										"data-level": level
									}, level)),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.legendLabel,
										children: t("legendMore")
									})
								]
							}),
							peak === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.legendPeak,
								children: t("peakDay", {
									day: formatDay(peak.day),
									cost: formatCost(peak.cost)
								})
							})
						]
					}),
					hover === void 0 ? null : (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.tooltip,
						role: "tooltip",
						"data-placement": hover.placement,
						style: {
							left: hover.x,
							top: hover.placement === "above" ? hover.y : hover.y + cellSize + 8
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.tooltipHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.tooltipDate,
								children: formatDay(hover.key)
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.tooltipWeekday,
								children: t(WEEKDAY_KEYS[hover.weekday] ?? "wd.0")
							})]
						}), hover.row === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.tooltipEmpty,
							children: t("noUsageDay")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.tooltipHero,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: css.tooltipDot,
									"data-level": hover.level,
									"aria-hidden": "true"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: css.tooltipHeroLabel,
									children: t("cost")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: css.tooltipHeroValue,
									children: formatCost(hover.row.cost)
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
							className: css.tooltipRows,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("totalTokens") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatInteger(tokensOf$1(hover.row)) })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("inputTokens") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatInteger(hover.row.uncachedInputTokens) })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("outputTokens") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatInteger(hover.row.outputTokens) })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("cacheRead") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatInteger(hover.row.cacheReadTokens) })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("calls") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatInteger(hover.row.calls) })] })
							]
						})] })]
					}), document.body)
				]
			});
		}
		//#endregion
		//#region src/client/format.ts
		/**
		* Locale-aware rendering of the figures on the panel.
		*
		* Copy and figures are two different things, and only one of them is
		* translatable. A dictionary entry can say what a number *means*; it cannot say
		* how that number is written, because symbol placement, grouping, the decimal
		* mark and the compact scale are properties of the reader's language, not of
		* the sentence. So every figure is formatted here against the active locale
		* while every sentence around it comes from the dictionary.
		*
		* No locale means no formatting: these functions take the bare BCP 47-style id
		* the locale service reports and hand it straight to `Intl`, which resolves a
		* region-less tag (`zh`, `en`) on its own and falls back to the default locale
		* for a well-formed tag it does not know. Only a structurally invalid tag or
		* currency code throws, and that is an operator's configuration rather than a
		* defect, so each formatter is built once, cached, and allowed to stay absent —
		* a caller then renders the figure plainly instead of failing the panel.
		*
		* @module dsh-local-usage/client/format
		*/
		const costFormatters = /* @__PURE__ */ new Map();
		const tokenFormatters = /* @__PURE__ */ new Map();
		const integerFormatters = /* @__PURE__ */ new Map();
		const rateFormatters = /* @__PURE__ */ new Map();
		const dayFormatters = /* @__PURE__ */ new Map();
		/**
		* Build one formatter once, caching a rejected construction as absent.
		*
		* The cache is what keeps a bad configuration from throwing on every render:
		* `Intl` rejects an unknown currency code and a malformed locale tag with a
		* `RangeError`, and both are values an operator supplies.
		* @param cache - the per-kind formatter cache.
		* @param key - cache key; must carry every input the built formatter depends on.
		* @param build - constructs the formatter.
		* @returns the formatter, or `undefined` when it cannot be built.
		*/
		function resolve(cache, key, build) {
			const hit = cache.get(key);
			if (hit !== void 0) return hit ?? void 0;
			let built;
			try {
				built = build();
			} catch {
				built = null;
			}
			cache.set(key, built);
			return built ?? void 0;
		}
		/**
		* Fraction digits a money figure is worth: enough that a sub-cent day does not
		* read as a flat zero, and no more.
		* @param value - the figure about to be rendered.
		* @returns the fraction width to format it with.
		*/
		function costDigits(value) {
			const magnitude = Math.abs(value);
			if (magnitude === 0) return 2;
			if (magnitude < .01) return 4;
			if (magnitude < 1) return 3;
			return 2;
		}
		/**
		* Render one money figure in the report's own currency.
		* @param value - the figure.
		* @param currency - ISO currency code the report states; never converted.
		* @param locale - active locale id.
		* @returns the formatted figure, or `CODE 0.00` when the currency is unknown.
		*/
		function formatCost(value, currency, locale) {
			const digits = costDigits(value);
			const formatter = resolve(costFormatters, `${locale}\u0000${currency}\u0000${String(digits)}`, () => new Intl.NumberFormat(locale, {
				style: "currency",
				currency,
				minimumFractionDigits: digits,
				maximumFractionDigits: digits
			}));
			return formatter === void 0 ? `${currency} ${value.toFixed(digits)}` : formatter.format(value);
		}
		/** Compact fallback for a locale whose formatter could not be built. */
		function plainTokens(value) {
			if (value < 1e3) return String(Math.round(value));
			if (value < 1e6) return `${trim(value / 1e3, 1)}K`;
			return `${trim(value / 1e6, 2)}M`;
		}
		/** Drop trailing zeros from a fixed-point figure. */
		function trim(value, digits) {
			return value.toFixed(digits).replace(/\.?0+$/, "");
		}
		/**
		* Render a token count at the compact scale of the reader's language.
		*
		* The scale is not a decoration: English counts in K/M/B while Chinese counts
		* in 万/亿, and a Chinese panel reading `214.87M` is exactly the untranslated
		* figure this module exists to remove. English output is unchanged by the
		* switch, because `Intl` compact notation resolves to the same K/M/B it
		* replaced.
		* @param value - token count.
		* @param locale - active locale id.
		* @returns the compact count.
		*/
		function formatTokens(value, locale) {
			const formatter = resolve(tokenFormatters, locale, () => new Intl.NumberFormat(locale, {
				notation: "compact",
				maximumFractionDigits: 2
			}));
			return formatter === void 0 ? plainTokens(value) : formatter.format(value);
		}
		/**
		* Render a whole figure in full, grouped the way the reader's language groups.
		*
		* This is the drill-down form, for the figures a reader counts rather than
		* compares: the hover card's per-bucket tokens, a day's call count, the number
		* of sessions scanned. A compact count answers "roughly how much" and the
		* hover card exists to answer "exactly how much", which a rounded scale cannot;
		* every such figure is a whole number, so this one formatter serves them all.
		* @param value - the whole figure.
		* @param locale - active locale id.
		* @returns every digit, with locale-appropriate grouping.
		*/
		function formatInteger(value, locale) {
			const rounded = Math.round(value);
			const formatter = resolve(integerFormatters, locale, () => new Intl.NumberFormat(locale));
			return formatter === void 0 ? String(rounded) : formatter.format(rounded);
		}
		/**
		* Render one configured rate for the price table.
		*
		* Four significant digits rather than a fixed fraction width, because rates
		* span from a per-million input price down to a cache-read price four orders
		* below it. A fixed width rounds the cheap end away and `String(value)` renders
		* it in exponential notation — `2e-7` is not a price a reader can check.
		* @param value - currency units per one million tokens.
		* @param locale - active locale id.
		* @returns the rate as written in the active locale.
		*/
		function formatRate(value, locale) {
			if (value === 0) return "0";
			const formatter = resolve(rateFormatters, locale, () => new Intl.NumberFormat(locale, { maximumSignificantDigits: 4 }));
			return formatter === void 0 ? String(value) : formatter.format(value);
		}
		/** Local midnight of one `YYYY-MM-DD` day key, or `undefined` when malformed. */
		function dayTime(day) {
			const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
			if (matched === null) return void 0;
			const time = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])).getTime();
			return Number.isFinite(time) ? time : void 0;
		}
		/**
		* Render one day key as a date the reader's language writes.
		*
		* The wire carries days as `YYYY-MM-DD` because that is a sortable key, not
		* because it is readable; a reader should not have to decode ISO order to find
		* out which day they are hovering.
		* @param day - the report's day key.
		* @param locale - active locale id.
		* @returns the localized date, or the key itself when it cannot be parsed.
		*/
		function formatDay(day, locale) {
			const time = dayTime(day);
			if (time === void 0) return day;
			const formatter = resolve(dayFormatters, locale, () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }));
			return formatter === void 0 ? day : formatter.format(time);
		}
		//#endregion
		//#region src/client/DataSourceNotes.tsx
		/** One labelled fact inside the disclosure. */
		function Fact({ label, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children })] });
		}
		/**
		* Render the provenance disclosure.
		* @param props - the report's live counts, the host facts, the calendar window, and the dictionary.
		* @returns the disclosure block.
		*/
		function DataSourceNotes({ report, weeks, locale, t }) {
			const counts = t("dataCounts", {
				count: formatInteger(report.scannedSessions, locale),
				unreadable: report.unreadableSessions === 0 ? "" : t("unreadableNote", { count: formatInteger(report.unreadableSessions, locale) }),
				source: report.cached ? t("dataCountsCached") : t("dataCountsFresh")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: css.disclosure,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
					className: css.disclosureSummary,
					children: t("dataTitle")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.disclosureBody,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("dataIntro") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
							className: css.facts,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)(Fact, {
									label: t("dataWhereLabel"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: t("dataWherePath") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("dataWhereValue") })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fact, {
									label: t("dataHowLabel"),
									children: t("dataHowValue")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fact, {
									label: t("dataScopeLabel"),
									children: t("dataScopeValue")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fact, {
									label: t("dataWindowLabel"),
									children: t("dataWindowValue", {
										weeks: String(weeks),
										days: String(weeks * 7)
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fact, {
									label: t("dataExcludedLabel"),
									children: t("dataExcludedValue")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Fact, {
									label: t("dataFlowLabel"),
									children: t("dataFlow")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.pricingHint,
							children: counts
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/PricingNotes.tsx
		/** One rate card row. */
		function PriceRow({ row, label, currency, locale }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
					className: css.priceMatch,
					children: label
				}) }),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
					className: css.numeric,
					children: formatRate(row.input, locale)
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
					className: css.numeric,
					children: formatRate(row.cacheRead, locale)
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
					className: css.numeric,
					children: formatRate(row.cacheWrite, locale)
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
					className: css.numeric,
					children: formatRate(row.output, locale)
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
					className: css.priceCurrency,
					children: currency
				})
			] });
		}
		/**
		* Render the pricing disclosure.
		* @param props - the report whose rates are in effect, the dictionary, and the open state.
		* @returns the disclosure block.
		*/
		function PricingNotes({ report, locale, t }) {
			const schedule = report.peakWindows.length === 0 ? void 0 : t("pricingPeakSchedule", {
				windows: report.peakWindows.join(t("listSeparator")),
				weekdayScope: report.peakWeekdaysOnly ? t("pricingWeekdaysOnly") : t("pricingEveryDay"),
				multiplier: String(report.peakMultiplier)
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
				className: css.disclosure,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", {
					className: css.disclosureSummary,
					children: t("pricingTitle")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.disclosureBody,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("pricingFormula") }),
						schedule === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: schedule }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("pricingSource") }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.pricingCaveat,
							children: t("pricingNotBill")
						}),
						report.prices.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.pricingRatesLabel,
							children: t("pricingRates", { currency: report.currency })
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
							className: css.priceTable,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									children: t("pricingColumnMatch")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: css.numeric,
									children: t("pricingColumnInput")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: css.numeric,
									children: t("pricingColumnCacheRead")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: css.numeric,
									children: t("pricingColumnCacheWrite")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "col",
									className: css.numeric,
									children: t("pricingColumnOutput")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { scope: "col" })
							] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tbody", { children: [report.prices.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PriceRow, {
								row,
								label: row.match,
								currency: report.currency,
								locale
							}, row.match)), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PriceRow, {
								row: report.fallbackPrice,
								label: t("pricingFallback"),
								currency: report.currency,
								locale
							})] })]
						})] }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.pricingHint,
							children: t("pricingUnknownRoute")
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/UsagePanel.tsx
		/**
		* Usage statistics panel: the year in spend, with a range lens over it.
		*
		* This is a global panel rather than a settings page: the calendar needs the
		* main column's width to show a whole year without scrolling, and what the
		* profile has spent is not a preference. It spans the current year and fills in
		* as the year passes; the range selector narrows the figures and rings the days
		* it covers, so the frame stays put while the reading changes.
		*
		* Everything is fetched per session fold the Host already cached, so switching
		* ranges re-prices instead of re-reading logs.
		*
		* The panel owns no copy and no formatting of its own: sentences come from the
		* `usage` dictionary and figures from `format.ts`, both resolved against the
		* active locale. A locale switch therefore costs one re-render and re-reads
		* nothing, because the Host's report is language-neutral — it carries counts
		* and a day key, never a rendered string.
		*
		* @module dsh-local-usage/client/UsagePanel
		*/
		const MS_PER_DAY = 864e5;
		/** Weeks the calendar spans: one rolling year of columns ending with this week. */
		const WINDOW_WEEKS = 52;
		/** Ranges offered, in selection order. */
		const RANGES = [
			{
				id: "day",
				key: "rangeDay"
			},
			{
				id: "week",
				key: "range7"
			},
			{
				id: "month",
				key: "rangeMonth"
			},
			{
				id: "quarter",
				key: "rangeQuarter"
			},
			{
				id: "year",
				key: "rangeYear"
			}
		];
		/** Local midnight of one instant. */
		function startOfDay(time) {
			const date = new Date(time);
			return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
		}
		/** First instant of the month containing `time`. */
		function startOfMonth(time) {
			const date = new Date(time);
			return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
		}
		/** First instant of the quarter containing `time`. */
		function startOfQuarter(time) {
			const date = new Date(time);
			return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1).getTime();
		}
		/** First instant of the year containing `time`. */
		function startOfYear(time) {
			return new Date(new Date(time).getFullYear(), 0, 1).getTime();
		}
		/**
		* Inclusive bounds of one selected range, all ending with today.
		* @param id - range id.
		* @param now - the instant the panel treats as today.
		* @returns the range's `[from, to]` in Unix epoch milliseconds.
		*/
		function rangeBounds(id, now) {
			const today = startOfDay(now);
			const end = today + MS_PER_DAY - 1;
			if (id === "day") return [today, end];
			if (id === "week") return [today - 6 * MS_PER_DAY, end];
			if (id === "month") return [startOfMonth(now), end];
			if (id === "quarter") return [startOfQuarter(now), end];
			return [startOfYear(now), end];
		}
		/** One labelled figure in the summary strip. */
		function Tile({ value, label, detail }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.tile,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.tileValue,
						children: value
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.tileLabel,
						children: label
					}),
					detail === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.tileDetail,
						children: detail
					})
				]
			});
		}
		/**
		* Contain a render failure to this panel.
		*
		* The slot renderer already keeps a crashing occupant from unmounting the app,
		* but its crash face is an empty element — indistinguishable from a blank page.
		* This boundary inside the panel turns any failure into the panel's own error
		* message with its own retry, so a bug here costs the reader a sentence.
		*/
		var PanelBoundary = class extends react.Component {
			state = { failed: false };
			static getDerivedStateFromError() {
				return { failed: true };
			}
			componentDidCatch(error) {
				console.error("usage panel crashed:", error);
			}
			render() {
				return this.state.failed ? this.props.fallback : this.props.children;
			}
		};
		/** Tokens of one day row. */
		function tokensOf(row) {
			return row.uncachedInputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens;
		}
		/**
		* Render the Usage statistics panel.
		* @param props - panel runtime, dictionary, and the injected report reader.
		* @returns the panel content.
		*/
		function UsagePanel({ panelId, locale, report, t, usePanelInfo }) {
			const [rangeId, setRangeId] = (0, react.useState)("month");
			const [request, setRequest] = (0, react.useState)(0);
			const [state, setState] = (0, react.useState)({ status: "idle" });
			const active = usePanelInfo((info) => info.activePanelId) === panelId;
			const now = (0, react.useMemo)(() => Date.now(), []);
			const [gridFrom, gridTo] = (0, react.useMemo)(() => heatmapWindow(now, WINDOW_WEEKS), [now]);
			const [rangeFrom, rangeTo] = (0, react.useMemo)(() => rangeBounds(rangeId, now), [rangeId, now]);
			const rangeIsWindow = rangeFrom === gridFrom && rangeTo === gridTo;
			(0, react.useEffect)(() => {
				if (!active) return;
				let current = true;
				setState({ status: "loading" });
				(async () => {
					const gridReport = await report(request > 0, gridFrom, gridTo);
					return {
						gridReport,
						summary: rangeIsWindow ? gridReport : await report(false, rangeFrom, rangeTo)
					};
				})().then(({ gridReport, summary }) => {
					if (current) setState({
						status: "ready",
						grid: gridReport,
						summary
					});
				}, () => {
					if (current) setState({ status: "error" });
				});
				return () => {
					current = false;
				};
			}, [
				active,
				report,
				request,
				gridFrom,
				gridTo,
				rangeFrom,
				rangeTo,
				rangeIsWindow
			]);
			const activeLocale = locale();
			const currency = state.status === "ready" ? state.grid.currency : "CNY";
			const money = (value) => formatCost(value, currency, activeLocale);
			const tokens = (value) => formatTokens(value, activeLocale);
			const integer = (value) => formatInteger(value, activeLocale);
			const gridDays = state.status === "ready" ? state.grid.days : [];
			const peak = gridDays.reduce((best, day) => best === void 0 || day.cost > best.cost ? day : best, void 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				className: css.panel,
				"aria-busy": state.status === "loading",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(PanelBoundary, {
					fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.status,
						role: "alert",
						children: t("error")
					}),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: css.header,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: css.headerText,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									className: css.heading,
									children: t("heading")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: css.subtitle,
									children: t("subtitle")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: css.controls,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: css.ranges,
									role: "group",
									"aria-label": t("rangeLabel"),
									children: RANGES.map((candidate) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: css.range,
										"aria-pressed": candidate.id === rangeId,
										onClick: () => {
											setRangeId(candidate.id);
										},
										children: t(candidate.key)
									}, candidate.id))
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									disabled: state.status === "loading",
									onClick: () => {
										setRequest((value) => value + 1);
									},
									children: t("refresh")
								})]
							})]
						}),
						state.status === "loading" || state.status === "idle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.status,
							role: "status",
							children: t("loading")
						}) : null,
						state.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.failure,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								role: "alert",
								children: t("error")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								onClick: () => {
									setRequest((value) => value + 1);
								},
								children: t("retry")
							})]
						}) : null,
						state.status === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryStrip, {
								report: state.summary,
								t,
								money,
								tokens,
								integer
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CalendarHeatmap, {
								from: gridFrom,
								to: gridTo,
								days: gridDays,
								totalCost: state.grid.totals.cost,
								peak,
								t,
								formatCost: money,
								formatInteger: (value) => formatInteger(value, activeLocale),
								formatDay: (day) => formatDay(day, activeLocale)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
								className: css.notes,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PricingNotes, {
										report: state.grid,
										locale: activeLocale,
										t
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(DataSourceNotes, {
										report: state.grid,
										weeks: WINDOW_WEEKS,
										locale: activeLocale,
										t
									}),
									state.grid.unpricedRoutes.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: css.warning,
										role: "note",
										children: t("unpriced", { list: state.grid.unpricedRoutes.join(", ") })
									})
								]
							})
						] }) : null
					]
				})
			});
		}
		/** The selected range's figures: one hero number, then the supporting tiles. */
		function SummaryStrip({ report, t, money, tokens, integer }) {
			const { totals } = report;
			const rangeTokens = report.days.reduce((sum, day) => sum + tokensOf(day), 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: css.summary,
				"aria-label": t("rangeLabel"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.hero,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.heroLabel,
								children: t("totalCost")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.heroValue,
								children: money(totals.cost)
							}),
							report.peakMultiplier <= 1 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.heroDetail,
								children: t("peakNote", { multiplier: String(report.peakMultiplier) })
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.tiles,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: tokens(rangeTokens),
								label: t("totalTokens")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: tokens(totals.uncachedInputTokens),
								label: t("inputTokens")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: tokens(totals.outputTokens),
								label: t("outputTokens")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: tokens(totals.cacheReadTokens),
								label: t("cacheRead"),
								detail: `${t("cacheWrite")} ${tokens(totals.cacheWriteTokens)}`
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: integer(totals.calls),
								label: t("calls")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: integer(totals.sessions),
								label: t("sessions")
							})
						]
					}),
					totals.calls === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.empty,
						children: t("noUsage")
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/UsagePanelIcon.tsx
		/**
		* Render three rising bars at the size the sidebar asks for.
		* @param props - the sidebar's icon share: the requested edge and whether the panel is selected.
		* @returns the glyph element.
		*/
		function UsagePanelIcon({ size }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M3.5 12.5V9.7",
						stroke: "currentColor",
						strokeWidth: "1.9",
						strokeLinecap: "round"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M8 12.5V6.1",
						stroke: "currentColor",
						strokeWidth: "1.9",
						strokeLinecap: "round"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M12.5 12.5V3.2",
						stroke: "currentColor",
						strokeWidth: "1.9",
						strokeLinecap: "round"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M2.2 14.4H13.8",
						stroke: "currentColor",
						strokeWidth: "1.25",
						strokeLinecap: "round"
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/**
		* Copy dictionaries for the Usage statistics panel.
		*
		* Every user-visible string on the panel lives here, in both shipped locales:
		* the panel renders no literal of its own, so adding a language is a dictionary
		* registration rather than a component change. Figures are not copy, so they
		* are formatted by `format.ts` against the active locale instead — a translated
		* string wraps a number, it never renders one.
		*
		* Placeholders are `{name}`; the locale runtime substitutes them by name and
		* leaves an unknown name in place, so a template's contract is its own keys.
		*/
		/** Simplified Chinese dictionary and key source of truth. */
		const zh = {
			nav: "用量统计",
			heading: "用量统计",
			subtitle: "本机全部会话的历史 token 与费用统计",
			rangeLabel: "统计范围",
			rangeDay: "当天",
			range7: "近 7 天",
			rangeMonth: "本月",
			rangeQuarter: "本季度",
			rangeYear: "全年",
			refresh: "重新统计",
			loading: "正在读取历史用量…",
			error: "无法读取用量数据。",
			retry: "重试",
			totalCost: "总花费",
			cost: "花费",
			totalTokens: "总 tokens",
			inputTokens: "输入",
			outputTokens: "输出",
			cacheRead: "缓存命中",
			cacheWrite: "缓存写入",
			calls: "调用次数",
			sessions: "会话数",
			calendar: "用量热力图",
			calendarHint: "每一格是一天，颜色越深花费越高；悬停查看当天明细",
			calendarWindow: "近 52 周",
			legendLess: "少",
			legendMore: "多",
			peakDay: "单日最高 {day} · {cost}",
			noUsage: "这个范围内没有用量记录。",
			noUsageDay: "当天没有用量记录",
			unpriced: "未配置价格的模型，已按默认费率估算：{list}",
			dataTitle: "用量依据",
			dataIntro: "用量折叠自会话的持久事件日志。Harness 把每次模型调用的 token 计量写在该次调用对应的日志事件里，没有单独的用量数据库，因此统计必须读日志本身。",
			dataWhereLabel: "读取位置",
			dataWherePath: "<DSH_HOME>/sessions/<工作目录>/<会话 id>/session.v3.jsonl.zstd",
			dataWhereValue: "其中 DSH_HOME 默认为 ~/.dsh；旧格式会话的文件名为 session.jsonl.zstd。",
			dataHowLabel: "读取方式",
			dataHowValue: "经会话查询服务读取完整日志并做重放校验；每个已完成的计费结算折算为一个样本，按该样本自身的时刻归入当地日期。",
			dataScopeLabel: "统计范围",
			dataScopeValue: "本机全部会话，跨所有工作目录，不限于当前工作区。",
			dataWindowLabel: "日历窗口",
			dataWindowValue: "近 {weeks} 周（{days} 天），截至今天。",
			dataExcludedLabel: "不计入",
			dataExcludedValue: "fork 会话的继承前缀（已在父会话计费）、尚未结算的在途调用、以及无法读取的会话。",
			dataFlowLabel: "数据流向",
			dataFlow: "日志由运行 dsh 服务端的进程读取并在其内存中折叠；除读取本地日志外不发起任何外部请求，也不上传任何数据。",
			dataCounts: "本次读取：扫描 {count} 个会话{unreadable}；{source}。",
			dataCountsCached: "结果来自内存缓存，未重新读盘",
			dataCountsFresh: "已重新读取全部日志",
			pricingTitle: "计价方式",
			pricingFormula: "花费 = Σ（各 token 桶 × 对应费率）÷ 1,000,000，并按每次调用发生的时刻判定高峰/空闲。",
			pricingSource: "费率来自本插件的配置价目表，不是从 provider 账单读回来的：Harness 只记录 token，不记录货币。",
			pricingNotBill: "因此这里的金额是估算值。预购额度、套餐包、阶梯折扣、赠送余额、聚合商加价或转售差价都不会体现在其中，与真实扣费必然存在差异；请以 provider 账单为准。",
			pricingRates: "当前生效费率（{currency} / 百万 tokens）",
			pricingFallback: "默认费率（未匹配任何规则的路由）",
			pricingColumnMatch: "匹配",
			pricingColumnInput: "输入（未命中）",
			pricingColumnCacheRead: "缓存命中",
			pricingColumnCacheWrite: "缓存写入",
			pricingColumnOutput: "输出",
			pricingUnknownRoute: "unknown 表示日志中没有记录 provider/model 的调用；multiple 表示一轮里换了多个模型。",
			pricingPeakSchedule: "高峰时段：{windows}（北京时间，周{weekdayScope}），其余为空闲时段，费率为高峰的 1/{multiplier}。",
			listSeparator: "、",
			pricingWeekdaysOnly: "一至周五",
			pricingEveryDay: "一至周日",
			peakNote: "高峰时段费率 ×{multiplier}",
			unreadableNote: "，其中 {count} 个无法读取",
			dayLabel: "{day} {weekday}：{cost}，{tokens} tokens，{calls} 次调用",
			monthLabel: "{n}月",
			"wd.0": "周日",
			"wd.1": "周一",
			"wd.2": "周二",
			"wd.3": "周三",
			"wd.4": "周四",
			"wd.5": "周五",
			"wd.6": "周六",
			"wdShort.0": "日",
			"wdShort.1": "一",
			"wdShort.2": "二",
			"wdShort.3": "三",
			"wdShort.4": "四",
			"wdShort.5": "五",
			"wdShort.6": "六"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			nav: "Usage",
			heading: "Usage statistics",
			subtitle: "Historical tokens and spend across every session on this machine",
			rangeLabel: "Range",
			rangeDay: "Today",
			range7: "Last 7 days",
			rangeMonth: "This month",
			rangeQuarter: "This quarter",
			rangeYear: "This year",
			refresh: "Recount",
			loading: "Reading historical usage…",
			error: "Usage data could not be read.",
			retry: "Retry",
			totalCost: "Total spend",
			cost: "Cost",
			totalTokens: "Total tokens",
			inputTokens: "Input",
			outputTokens: "Output",
			cacheRead: "Cache read",
			cacheWrite: "Cache write",
			calls: "Calls",
			sessions: "Sessions",
			calendar: "Usage heatmap",
			calendarHint: "One cell per day, darker means more spent; hover a day for its detail",
			calendarWindow: "Last 52 weeks",
			legendLess: "Less",
			legendMore: "More",
			peakDay: "Highest day {day} · {cost}",
			noUsage: "No usage recorded in this range.",
			noUsageDay: "No usage recorded",
			unpriced: "No price configured for these models; the default rate was used: {list}",
			dataTitle: "Where these figures come from",
			dataIntro: "The figures are folded from the durable session event logs. The harness writes each model call’s token accounting into the log event for that call, and there is no separate usage database, so the statistics have to read the logs themselves.",
			dataWhereLabel: "Read from",
			dataWherePath: "<DSH_HOME>/sessions/<working directory>/<session id>/session.v3.jsonl.zstd",
			dataWhereValue: "DSH_HOME defaults to ~/.dsh; older sessions are named session.jsonl.zstd.",
			dataHowLabel: "Read how",
			dataHowValue: "The complete log is read through the session query service and replay-validated; each completed billed settlement becomes one sample, filed under the local day of its own instant.",
			dataScopeLabel: "Scope",
			dataScopeValue: "Every session on this host, across all working directories — not just the current workspace.",
			dataWindowLabel: "Calendar window",
			dataWindowValue: "The last {weeks} weeks ({days} days), ending today.",
			dataExcludedLabel: "Not counted",
			dataExcludedValue: "A forked session’s inherited prefix (already billed to its parent), calls still in flight, and sessions that could not be read.",
			dataFlowLabel: "Where it goes",
			dataFlow: "The process running the dsh server reads the logs and folds them in its own memory; apart from reading those local files it makes no external request and uploads nothing.",
			dataCounts: "This read: {count} sessions scanned{unreadable}; {source}.",
			dataCountsCached: "served from the in-memory cache without re-reading",
			dataCountsFresh: "every log re-read",
			pricingTitle: "How cost is computed",
			pricingFormula: "Cost = Σ (each token bucket × its rate) ÷ 1,000,000, with peak or off-peak decided per call at the moment it happened.",
			pricingSource: "The rates come from this plugin’s own price table, not from a provider invoice: the harness records tokens, never currency.",
			pricingNotBill: "The figure is therefore an estimate. Prepaid credit, package plans, volume discounts, granted balance, aggregator markups and reseller margins are all invisible here, so it will differ from what you are actually charged; treat the provider invoice as authoritative.",
			pricingRates: "Rates in effect ({currency} per million tokens)",
			pricingFallback: "Fallback rate (routes matching no rule)",
			pricingColumnMatch: "Match",
			pricingColumnInput: "Input (miss)",
			pricingColumnCacheRead: "Cache read",
			pricingColumnCacheWrite: "Cache write",
			pricingColumnOutput: "Output",
			pricingUnknownRoute: "unknown means the log recorded no provider/model for the call; multiple means one turn switched models.",
			pricingPeakSchedule: "Peak: {windows} (Beijing time, {weekdayScope}); every other hour is off-peak, charged 1/{multiplier} of the peak rate.",
			listSeparator: ", ",
			pricingWeekdaysOnly: "Monday to Friday",
			pricingEveryDay: "every day",
			peakNote: "Peak-hour rates are ×{multiplier}",
			unreadableNote: ", {count} unreadable",
			dayLabel: "{day} {weekday}: {cost}, {tokens} tokens, {calls} calls",
			monthLabel: "{n}",
			"wd.0": "Sunday",
			"wd.1": "Monday",
			"wd.2": "Tuesday",
			"wd.3": "Wednesday",
			"wd.4": "Thursday",
			"wd.5": "Friday",
			"wd.6": "Saturday",
			"wdShort.0": "S",
			"wdShort.1": "M",
			"wdShort.2": "T",
			"wdShort.3": "W",
			"wdShort.4": "T",
			"wdShort.5": "F",
			"wdShort.6": "S"
		};
		//#endregion
		//#region src/client/styles.ts
		/** The panel's stylesheet, injected once when the plugin loads.
		*
		* @module dsh-local-usage/client/styles
		*/
		/** Element id marking this plugin's injected style tag. */
		const STYLE_ID = "dsh-local-usage/styles";
		/** The complete stylesheet, scoped by the `dlu-` class prefix. */
		const styles = String.raw`
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
  /* One ramp for the whole figure: the empty step is a neutral surface, and
   * the four active steps mix the blue accent into the page surface. */
  --usage-heat-0: var(--dsw-alias-bg-layer-2);
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

.dlu-cell {
  border-radius: 4px;
  cursor: default;
  transition: transform 100ms ease-out;
}

.dlu-cell:hover {
  transform: scale(1.15);
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
`;
		//#endregion
		//#region src/client/wire-report.ts
		/** Rate card used when the Host reported none; shows the figure was unpriced. */
		const NO_RATE = {
			match: "",
			input: 0,
			cacheRead: 0,
			cacheWrite: 0,
			output: 0
		};
		/**
		* Fill every field the panel reads with a safe default.
		* @param value - the report as received.
		* @returns a report whose declared fields are all present.
		*/
		function normalizeReport(value) {
			return {
				...value,
				days: value.days ?? [],
				models: value.models ?? [],
				sessions: value.sessions ?? [],
				scannedSessions: value.scannedSessions ?? 0,
				unreadableSessions: value.unreadableSessions ?? 0,
				unpricedRoutes: value.unpricedRoutes ?? [],
				unpricedTokens: value.unpricedTokens ?? 0,
				cached: value.cached ?? false,
				peakMultiplier: value.peakMultiplier ?? 1,
				prices: value.prices ?? [],
				fallbackPrice: value.fallbackPrice ?? NO_RATE,
				peakWindows: value.peakWindows ?? [],
				peakWeekdaysOnly: value.peakWeekdaysOnly ?? true
			};
		}
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this panel. */
		const NS = "usage";
		/** The id shared by the sidebar entry and the main panel it opens. */
		const PANEL_ID = "usage";
		/** Host route this panel reads its report from. */
		const REPORT_PATH = "/api/dsh-local-usage/report";
		/** Services required by the sidebar and main-slot registrations. */
		const inject = ["slots", "locale"];
		/**
		* Inject this plugin's stylesheet once.
		*
		* A plugin served outside the product's build has to carry and inject its own
		* sheet; the tag is keyed so a reload replaces rather than accumulates.
		*
		* @returns the disposer that removes the tag this call installed; unloading the
		* plugin therefore leaves no orphaned sheet behind.
		*/
		function injectStyles() {
			if (document.querySelector(`style[data-plugin-css="dsh-local-usage/styles"]`) !== null) return () => {};
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-local-usage";
			tag.dataset.pluginCss = STYLE_ID;
			tag.textContent = styles;
			document.head.appendChild(tag);
			return () => {
				tag.remove();
			};
		}
		/**
		* Contribute the Usage entry to the sidebar with the panel it opens.
		* @param ctx - Client plugin context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-local-usage: dictionaries");
			ctx.effect(() => injectStyles(), "dsh-local-usage: stylesheet");
			const t = ctx.locale.bind(NS);
			const injected = () => ({
				panelId: PANEL_ID,
				locale: () => ctx.locale.getLocale().active,
				report: async (refresh, from, to) => {
					const url = new URL(REPORT_PATH, window.location.origin);
					url.searchParams.set("from", String(from));
					url.searchParams.set("to", String(to));
					if (refresh) url.searchParams.set("refresh", "1");
					const response = await fetch(url, { credentials: "include" });
					if (!response.ok) throw new Error(`usage report failed: HTTP ${String(response.status)}`);
					return normalizeReport(await response.json());
				}
			});
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID,
				locale: NS,
				inject: injected
			}, UsagePanel));
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 10,
				label: () => t("nav"),
				locale: NS
			}, UsagePanelIcon));
		}
		//#endregion
		exports.NS = NS;
		exports.PANEL_ID = PANEL_ID;
		exports.REPORT_PATH = REPORT_PATH;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map