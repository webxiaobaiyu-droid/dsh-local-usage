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
		* Calendar day vocabulary: the rolling window, its column count, the month
		* markers above it, and the day-key arithmetic the drill-down shares with it.
		*
		* Pure and date-in only, so the arithmetic that decides where every cell lands
		* is testable without a browser. The window opens on a Sunday and closes on the
		* day the panel treats as today, which keeps every column a whole week and lets
		* a narrow panel drop leading columns without splitting one.
		*
		* @module dsh-local-usage/client/heatmap-grid
		*/
		const MS_PER_DAY$3 = 864e5;
		const DAYS_PER_WEEK = 7;
		/** Sunday-first dictionary keys for the long weekday names. */
		const WEEKDAY_KEYS = [
			"wd.0",
			"wd.1",
			"wd.2",
			"wd.3",
			"wd.4",
			"wd.5",
			"wd.6"
		];
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
		* Local midnight of a `YYYY-MM-DD` day key — the inverse of {@link dayKey}.
		*
		* Built through the `Date` constructor's local-time overload rather than parsed
		* as a date string, which would read a bare `YYYY-MM-DD` as UTC and shift the
		* whole day for anyone west of Greenwich.
		*
		* @param day - the day key.
		* @returns Unix epoch milliseconds of that local day's midnight, or `undefined`
		* when the key is malformed.
		*/
		function dayTime$1(day) {
			const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
			if (matched === null) return void 0;
			const time = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])).getTime();
			return Number.isFinite(time) ? time : void 0;
		}
		/**
		* Long weekday dictionary key for one instant.
		* @param time - Unix epoch milliseconds.
		* @returns the `wd.*` key naming that instant's weekday.
		*/
		function weekdayKey(time) {
			return WEEKDAY_KEYS[new Date(time).getDay()] ?? "wd.0";
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
			return [today - ((weeks - 1) * DAYS_PER_WEEK + elapsed) * MS_PER_DAY$3, today + MS_PER_DAY$3 - 1];
		}
		/**
		* Column count spanning an inclusive day range, rounded up to whole weeks.
		* @param from - first day, Unix epoch milliseconds.
		* @param to - last day inclusive, Unix epoch milliseconds.
		* @returns the number of week columns.
		*/
		function heatmapColumns(from, to) {
			const days = (midnight(to) - midnight(from)) / MS_PER_DAY$3 + 1;
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
				const index = Math.floor((midnight(month.getTime()) - windowStart) / MS_PER_DAY$3 / DAYS_PER_WEEK);
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
		/**
		* The cell edge that fills `width`, never below the minimum.
		* @param width - the measured container width.
		* @param columns - columns the grid is laying out.
		* @returns the cell edge in whole pixels.
		*/
		function cellSizeFor(width, columns) {
			const gaps = Math.max(0, columns - 1) * 4;
			const available = Math.max(0, width - 20 - gaps);
			return Math.max(1, Math.floor(available / columns) || 1);
		}
		/**
		* Track the widest cell edge the container can carry, and how many weeks then fit.
		* @param totalColumns - columns the full window spans.
		* @returns the element to measure, the cell edge, and the visible column count.
		*/
		function useResponsiveGrid(totalColumns) {
			const containerRef = (0, react.useRef)(null);
			const [state, setState] = (0, react.useState)({
				cellSize: 15,
				columns: totalColumns
			});
			(0, react.useEffect)(() => {
				const element = containerRef.current;
				if (element === null || totalColumns <= 0) return;
				const update = () => {
					const width = element.clientWidth;
					const fitted = Math.floor((width - 20 + 4) / 19);
					const columns = Math.max(1, Math.min(totalColumns, fitted || 1));
					setState(columns >= totalColumns ? {
						cellSize: cellSizeFor(width, totalColumns),
						columns: totalColumns
					} : {
						cellSize: 15,
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
			barFill: "dlu-barFill",
			barLabel: "dlu-barLabel",
			barRow: "dlu-barRow",
			bars: "dlu-bars",
			barTrack: "dlu-barTrack",
			barValue: "dlu-barValue",
			block: "dlu-block",
			blockHint: "dlu-blockHint",
			blockTitle: "dlu-blockTitle",
			breakdown: "dlu-breakdown",
			breakout: "dlu-breakout",
			cellName: "dlu-cellName",
			reading: "dlu-reading",
			readingDetail: "dlu-readingDetail",
			readingLabel: "dlu-readingLabel",
			readings: "dlu-readings",
			readingValue: "dlu-readingValue",
			sessionFigures: "dlu-sessionFigures",
			sessionList: "dlu-sessionList",
			sessionName: "dlu-sessionName",
			sessionRow: "dlu-sessionRow",
			table: "dlu-table",
			unpricedBadge: "dlu-unpricedBadge",
			wave: "dlu-wave",
			waveArea: "dlu-waveArea",
			waveCaption: "dlu-waveCaption",
			waveEmpty: "dlu-waveEmpty",
			waveFrame: "dlu-waveFrame",
			waveLine: "dlu-waveLine",
			wavePeak: "dlu-wavePeak",
			waveScope: "dlu-waveScope",
			waveStopBottom: "dlu-waveStopBottom",
			waveSpout: "dlu-waveSpout",
			waveSpoutJet: "dlu-waveSpoutJet",
			waveSpoutRipple: "dlu-waveSpoutRipple",
			waveSpoutSpray: "dlu-waveSpoutSpray",
			waveSpoutWater: "dlu-waveSpoutWater",
			waveSpoutWhale: "dlu-waveSpoutWhale",
			waveStopTop: "dlu-waveStopTop",
			waveNode: "dlu-waveNode",
			wavePlot: "dlu-wavePlot",
			waveRule: "dlu-waveRule",
			waveTick: "dlu-waveTick",
			waveTicks: "dlu-waveTicks",
			waveSvg: "dlu-waveSvg",
			waveTitle: "dlu-waveTitle",
			waveTotal: "dlu-waveTotal",
			calendar: "dlu-calendar",
			calendarCaption: "dlu-calendarCaption",
			calendarHeading: "dlu-calendarHeading",
			calendarMeasure: "dlu-calendarMeasure",
			calendarScroll: "dlu-calendarScroll",
			calendarTitle: "dlu-calendarTitle",
			calendarTotal: "dlu-calendarTotal",
			calendarYear: "dlu-calendarYear",
			cell: "dlu-cell",
			cellGhost: "dlu-cellGhost",
			cellRow: "dlu-cellRow",
			cells: "dlu-cells",
			controls: "dlu-controls",
			editor: "dlu-editor",
			editorCard: "dlu-editorCard",
			editorCardName: "dlu-editorCardName",
			editorCardRow: "dlu-editorCardRow",
			editorCards: "dlu-editorCards",
			editorPriceField: "dlu-editorPriceField",
			editorPriceFields: "dlu-editorPriceFields",
			editorPriceLabel: "dlu-editorPriceLabel",
			editorPriceRow: "dlu-editorPriceRow",
			editorToggle: "dlu-editorToggle",
			editorActions: "dlu-editorActions",
			editorError: "dlu-editorError",
			editorField: "dlu-editorField",
			editorHint: "dlu-editorHint",
			editorSource: "dlu-editorSource",
			editorStatus: "dlu-editorStatus",
			editorTitle: "dlu-editorTitle",
			editorTable: "dlu-editorTable",
			dayDetail: "dlu-dayDetail",
			dayHeader: "dlu-dayHeader",
			dayTitle: "dlu-dayTitle",
			dayTitleRow: "dlu-dayTitleRow",
			dayWeekday: "dlu-dayWeekday",
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
			iconButton: "dlu-iconButton",
			legend: "dlu-legend",
			legendHint: "dlu-legendHint",
			legendLabel: "dlu-legendLabel",
			legendPeak: "dlu-legendPeak",
			legendScale: "dlu-legendScale",
			legendSwatch: "dlu-legendSwatch",
			loading: "dlu-loading",
			loadingFill: "dlu-loadingFill",
			loadingText: "dlu-loadingText",
			loadingTrack: "dlu-loadingTrack",
			monthLabel: "dlu-monthLabel",
			monthRow: "dlu-monthRow",
			notes: "dlu-notes",
			notesHeading: "dlu-notesHeading",
			noteValue: "dlu-noteValue",
			numeric: "dlu-numeric",
			panel: "dlu-panel",
			popoverHost: "dlu-popoverHost",
			popoverPanel: "dlu-popoverPanel",
			popoverTitle: "dlu-popoverTitle",
			priceCurrency: "dlu-priceCurrency",
			priceMatch: "dlu-priceMatch",
			priceTable: "dlu-priceTable",
			pricingCaveat: "dlu-pricingCaveat",
			pricingHint: "dlu-pricingHint",
			pricingRatesLabel: "dlu-pricingRatesLabel",
			projectBlock: "dlu-projectBlock",
			projectCell: "dlu-projectCell",
			projectHeading: "dlu-projectHeading",
			projectName: "dlu-projectName",
			projectPath: "dlu-projectPath",
			projectTable: "dlu-projectTable",
			statsBlock: "dlu-statsBlock",
			tableBlock: "dlu-tableBlock",
			tableHeading: "dlu-tableHeading",
			tableNote: "dlu-tableNote",
			projectToggle: "dlu-projectToggle",
			projectToggleHint: "dlu-projectToggleHint",
			sessionInTable: "dlu-sessionInTable",
			range: "dlu-range",
			ranges: "dlu-ranges",
			rank: "dlu-rank",
			rankBar: "dlu-rankBar",
			rankBarFill: "dlu-rankBarFill",
			rankCost: "dlu-rankCost",
			rankHead: "dlu-rankHead",
			rankMore: "dlu-rankMore",
			rankName: "dlu-rankName",
			rankPath: "dlu-rankPath",
			rankPlace: "dlu-rankPlace",
			rankList: "dlu-rankList",
			rankNameText: "dlu-rankNameText",
			rankRow: "dlu-rankRow",
			rankRowHead: "dlu-rankRowHead",
			rankScope: "dlu-rankScope",
			rankSessions: "dlu-rankSessions",
			rankTitle: "dlu-rankTitle",
			rankTokens: "dlu-rankTokens",
			scan: "dlu-scan",
			skelBar: "dlu-skelBar",
			skelLine: "dlu-skelLine",
			status: "dlu-status",
			subtitle: "dlu-subtitle",
			summary: "dlu-summary",
			tile: "dlu-tile",
			tileDetail: "dlu-tileDetail",
			tileLabel: "dlu-tileLabel",
			tileValue: "dlu-tileValue",
			tiles: "dlu-tiles",
			tools: "dlu-tools",
			visuallyHidden: "dlu-visuallyHidden",
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
		* Every cell is a button that opens that day's own page, so the calendar is a
		* way in rather than only a picture of the year. The grid is one tab stop: the
		* arrow keys walk it, Home and End jump within a week, and focus is tracked by
		* (column, row) rather than by DOM offset because the last column stops at
		* today and a plain index would run off its end.
		*
		* @module dsh-local-usage/client/CalendarHeatmap
		*/
		const MS_PER_DAY$2 = 864e5;
		const WEEKDAY_ROWS$1 = 7;
		/** Tooltip clamp so a card on an edge column stays on screen. */
		const TOOLTIP_HALF_WIDTH = 150;
		/** Approximate card height; below this viewport offset the card flips under the cell. */
		const TOOLTIP_FLIP_ABOVE = 320;
		/** Compact row gutter labels, matching the `wdShort.*` dictionary keys. */
		const WEEKDAY_SHORT_KEYS$1 = [
			"wdShort.0",
			"wdShort.1",
			"wdShort.2",
			"wdShort.3",
			"wdShort.4",
			"wdShort.5",
			"wdShort.6"
		];
		/** Tokens of one day row. */
		function tokensOf$2(row) {
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
		/**
		* The year of cells, memoized apart from the figure around it.
		*
		* It is the expensive half of a render and the card above it is not: a year of
		* columns is 364 buttons, each labelling itself from four formatted figures,
		* while the hover card is one small box pinned to whichever cell the pointer is
		* over. Hover is parent state, so without this boundary every pointer move
		* across the grid would rebuild all 364 labels to move that one box.
		*/
		const CalendarCells = (0, react.memo)(function CalendarCells({ grid, cellSize, levels, focusDay, t, formatCost, formatInteger, formatDay, cellsRef, onSelectDay, onEnter, onLeave, onFocusCell, onKey }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: cellsRef,
				className: css.cells,
				role: "grid",
				"aria-label": t("calendar"),
				style: {
					gridColumn: "2 / -1",
					gridTemplateRows: `repeat(${String(WEEKDAY_ROWS$1)}, ${String(cellSize)}px)`,
					gridTemplateColumns: `repeat(${String(grid.length)}, ${String(cellSize)}px)`,
					gap: 4
				},
				children: Array.from({ length: WEEKDAY_ROWS$1 }, (_, row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: css.cellRow,
					role: "row",
					children: grid.map((week, column) => {
						const cell = week[row];
						if (cell === void 0 || cell === null) return null;
						const tokens = cell.row === void 0 ? 0 : tokensOf$2(cell.row);
						const level = tokens <= 0 ? 0 : tokens <= levels.t1 ? 1 : tokens <= levels.t2 ? 2 : tokens <= levels.t3 ? 3 : 4;
						const label = t("dayLabel", {
							day: formatDay(cell.day),
							weekday: t(WEEKDAY_KEYS[row] ?? "wd.0"),
							cost: formatCost(cell.row?.cost ?? 0),
							tokens: formatInteger(tokens),
							calls: formatInteger(cell.row?.calls ?? 0)
						});
						return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: css.cell,
							"data-level": level,
							"data-day": cell.day,
							role: "gridcell",
							"aria-label": label,
							tabIndex: cell.day === focusDay ? 0 : -1,
							style: {
								gridRowStart: row + 1,
								gridColumnStart: column + 1,
								inlineSize: cellSize,
								blockSize: cellSize
							},
							onFocus: () => {
								onFocusCell(cell.day);
							},
							onKeyDown: (event) => {
								onKey(event, column, row);
							},
							onClick: () => {
								onSelectDay(cell.day);
							},
							onMouseEnter: (event) => {
								onEnter(cell, row, level, event.currentTarget);
							},
							onMouseLeave: onLeave
						}, cell.day);
					})
				}, row))
			});
		});
		/**
		* Render the calendar grid plus its legend and hover card.
		* @param props - the window, its day rows, the selected range, formatters, and copy.
		* @returns the calendar figure.
		*/
		function CalendarHeatmap({ from, to, days, totalCost, peak, t, formatCost, formatInteger, formatDay, onSelectDay, focusDayOnMount }) {
			const [hover, setHover] = (0, react.useState)(void 0);
			const first = midnight(from);
			const last = midnight(to);
			const totalColumns = heatmapColumns(first, last);
			const byDay = (0, react.useMemo)(() => new Map(days.map((row) => [row.day, row])), [days]);
			const grid = (0, react.useMemo)(() => {
				const columns = [];
				for (let column = 0; column < totalColumns; column += 1) {
					const week = [];
					for (let row = 0; row < WEEKDAY_ROWS$1; row += 1) {
						const time = first + (column * WEEKDAY_ROWS$1 + row) * MS_PER_DAY$2;
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
				const active = days.map((row) => tokensOf$2(row)).filter((value) => value > 0).sort((a, b) => a - b);
				return {
					t1: quantile(active, .5),
					t2: quantile(active, .75),
					t3: quantile(active, .9)
				};
			}, [days]);
			const { containerRef, cellSize, columns: visibleColumns } = useResponsiveGrid(totalColumns);
			const visible = (0, react.useMemo)(() => grid.slice(-visibleColumns), [grid, visibleColumns]);
			const visibleStart = first + (totalColumns - visibleColumns) * WEEKDAY_ROWS$1 * MS_PER_DAY$2;
			const [focusCell, setFocusCell] = (0, react.useState)(focusDayOnMount);
			const cellsRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (focusDayOnMount === void 0) return;
				cellsRef.current?.querySelector(`[data-day="${focusDayOnMount}"]`)?.focus();
			}, [focusDayOnMount]);
			const renderedDays = (0, react.useMemo)(() => {
				const present = /* @__PURE__ */ new Set();
				for (const week of visible) for (const cell of week) if (cell !== null) present.add(cell.day);
				return present;
			}, [visible]);
			const focusDay = focusCell !== void 0 && renderedDays.has(focusCell) ? focusCell : dayKey(last);
			/**
			* The rendered day at one grid position.
			*
			* A short column is short at the *bottom* — the grid fills forward from its
			* opening Sunday and stops at today — so a position past the end resolves to
			* the nearest cell above it. That one rule gives the arrow keys their
			* boundary behaviour on both axes: stepping down out of a short column stays
			* put, and stepping right into one lands on its last day.
			*/
			const dayAt = (0, react.useCallback)((column, row) => {
				const week = visible[column];
				if (week === void 0) return void 0;
				for (let offset = 0; offset < WEEKDAY_ROWS$1; offset += 1) {
					const probe = week[row - offset];
					if (probe !== void 0 && probe !== null) return probe.day;
				}
			}, [visible]);
			/** Move the roving focus, and take real focus with it so the two cannot disagree. */
			const onKey = (0, react.useCallback)((event, column, row) => {
				const target = event.key === "ArrowLeft" ? dayAt(column - 1, row) : event.key === "ArrowRight" ? dayAt(column + 1, row) : event.key === "ArrowUp" ? dayAt(column, row - 1) : event.key === "ArrowDown" ? dayAt(column, row + 1) : event.key === "Home" ? dayAt(column, 0) : event.key === "End" ? dayAt(column, 6) : void 0;
				if (target === void 0) return;
				event.preventDefault();
				setFocusCell(target);
				cellsRef.current?.querySelector(`[data-day="${target}"]`)?.focus();
			}, [dayAt]);
			const onEnter = (0, react.useCallback)((cell, row, level, target) => {
				const rect = target.getBoundingClientRect();
				setHover({
					key: cell.day,
					weekday: row,
					row: cell.row,
					level,
					x: Math.min(Math.max(rect.left + rect.width / 2, TOOLTIP_HALF_WIDTH), window.innerWidth - TOOLTIP_HALF_WIDTH),
					y: rect.top,
					placement: rect.top < TOOLTIP_FLIP_ABOVE ? "below" : "above"
				});
			}, []);
			const onLeave = (0, react.useCallback)(() => {
				setHover(void 0);
			}, []);
			const onFocusCell = (0, react.useCallback)((day) => {
				setFocusCell(day);
			}, []);
			const markers = (0, react.useMemo)(() => monthMarkers(visibleStart, last, visibleColumns).map((marker) => ({
				...marker,
				label: t("monthLabel", { n: String(marker.month) })
			})), [
				last,
				t,
				visibleColumns,
				visibleStart
			]);
			const trackTemplate = `${String(20)}px repeat(${String(visibleColumns)}, ${String(cellSize)}px)`;
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
									columnGap: 4
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
									columnGap: 4
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: css.weekdayColumn,
									"aria-hidden": "true",
									style: {
										gridTemplateRows: `repeat(${String(WEEKDAY_ROWS$1)}, ${String(cellSize)}px)`,
										rowGap: 4
									},
									children: WEEKDAY_SHORT_KEYS$1.map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.weekday,
										children: t(key)
									}, key))
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CalendarCells, {
									grid: visible,
									cellSize,
									levels,
									focusDay,
									t,
									formatCost,
									formatInteger,
									formatDay,
									cellsRef,
									onSelectDay,
									onEnter,
									onLeave,
									onFocusCell,
									onKey
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
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("totalTokens") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatInteger(tokensOf$2(hover.row)) })] }),
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
		//#region src/client/cache-rate.ts
		/**
		* Share of one window's prompt tokens served from cache.
		* @param tokens - the window's token buckets.
		* @returns the ratio in `0..1`, or `undefined` when the window held no prompt tokens.
		*/
		function cacheHitRate(tokens) {
			const prompt = tokens.uncachedInputTokens + tokens.cacheReadTokens + tokens.cacheWriteTokens;
			return prompt === 0 ? void 0 : tokens.cacheReadTokens / prompt;
		}
		/**
		* Whether the reader has asked the platform for less motion.
		* @returns true when animations should be replaced by their end state.
		*/
		function prefersReducedMotion() {
			return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		}
		/**
		* Ease-out cubic: fast off zero, settling onto the figure.
		* @param progress - elapsed share of the entrance, clamped to `0..1`.
		* @returns the eased share.
		*/
		function easeOutCubic(progress) {
			return 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;
		}
		/**
		* The share of the way to the figures an entrance has reached.
		* @param elapsed - milliseconds since the entrance began.
		* @param duration - length of the entrance; `0` snaps straight to the end.
		* @returns a share in `0..1`.
		*/
		function entranceAt(elapsed, duration = 520) {
			if (duration <= 0) return 1;
			return easeOutCubic(elapsed / duration);
		}
		/**
		* The entrance's share, animated once when the panel asks for it.
		*
		* `animate` is the panel's decision, not this hook's, because only the panel
		* knows whether this is the read that opened the page or a range change on top of
		* one already read. An entrance that is refused — a reader who asked for less
		* motion, or a second mount — reports itself finished immediately, so the panel
		* stops waiting on it either way.
		*
		* @param animate - whether this render is the entrance.
		* @param onDone - called once the entrance has landed or been refused.
		* @returns the share of the way to the figures, `1` when not animating.
		*/
		function useEntrance(animate, onDone) {
			const [share, setShare] = (0, react.useState)(animate ? 0 : 1);
			const settled = (0, react.useRef)(!animate);
			const done = (0, react.useRef)(onDone);
			done.current = onDone;
			(0, react.useEffect)(() => {
				if (!animate || settled.current || prefersReducedMotion()) {
					settled.current = true;
					setShare(1);
					done.current?.();
					return;
				}
				settled.current = true;
				let frame = 0;
				const start = performance.now();
				const tick = (now) => {
					const elapsed = now - start;
					setShare(entranceAt(elapsed));
					if (elapsed < 520) frame = requestAnimationFrame(tick);
					else done.current?.();
				};
				frame = requestAnimationFrame(tick);
				return () => {
					cancelAnimationFrame(frame);
				};
			}, [animate]);
			return share;
		}
		/** A reliability fold over one window that recorded nothing at all. */
		const NO_RELIABILITY = {
			retries: 0,
			retryCauses: [],
			toolCalls: 0,
			toolErrors: 0,
			toolErrorCodes: [],
			compactions: 0,
			compactionFailures: 0
		};
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
		const percentFormatters = /* @__PURE__ */ new Map();
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
		function resolve$1(cache, key, build) {
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
			const formatter = resolve$1(costFormatters, `${locale}\u0000${currency}\u0000${String(digits)}`, () => new Intl.NumberFormat(locale, {
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
			const formatter = resolve$1(tokenFormatters, locale, () => new Intl.NumberFormat(locale, {
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
			const formatter = resolve$1(integerFormatters, locale, () => new Intl.NumberFormat(locale));
			return formatter === void 0 ? String(rounded) : formatter.format(rounded);
		}
		/**
		* Render one ratio as a percentage.
		*
		* Two fraction digits always, never one and never none: a rate is read by
		* comparing windows, and a figure that drops its trailing digits (`99.2%` beside
		* `99.22%`) reads as a change in precision rather than a change in value. The
		* rounding is the language's own, so the symbol and its placement stay correct
		* for the reader.
		* @param value - the ratio, `0..1`.
		* @param locale - active locale id.
		* @returns the formatted percentage.
		*/
		function formatPercent(value, locale) {
			const formatter = resolve$1(percentFormatters, locale, () => new Intl.NumberFormat(locale, {
				style: "percent",
				minimumFractionDigits: 2,
				maximumFractionDigits: 2
			}));
			return formatter === void 0 ? `${(value * 100).toFixed(2)}%` : formatter.format(value);
		}
		/** Local midnight of one `YYYY-MM-DD` day key, or `undefined` when malformed. */
		function dayTime(day) {
			const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
			if (matched === null) return void 0;
			const time = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])).getTime();
			return Number.isFinite(time) ? time : void 0;
		}
		/**
		* How much room one rendered figure needs, as a bucket rather than a width.
		*
		* The strip's layout is not allowed to depend on the data — a bigger total must
		* not push a tile onto another row and move the calendar under the reader — so
		* the figure adapts instead: a seven-figure total is set a step smaller, which
		* keeps every digit and keeps the block the same height.
		*
		* The measure is the rendered string's length rather than a measurement of the
		* laid-out element: it is the same answer before and after paint, so nothing
		* reflows in response to its own rendering.
		*
		* @param text - the figure as it will be rendered.
		* @returns the size bucket its length calls for.
		*/
		function figureRoom(text) {
			if (text.length > 15) return "overflowing";
			return text.length > 11 ? "long" : "normal";
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
			const formatter = resolve$1(dayFormatters, locale, () => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }));
			return formatter === void 0 ? day : formatter.format(time);
		}
		//#endregion
		//#region src/client/paths.ts
		/**
		* Turning a working directory into something a reader recognises.
		*
		* Pure and string-in only, so the shortening rules are testable without a
		* browser. Nothing here is localized: a path is a path in every language, and
		* the only translatable part — the label for a row that has no path at all — is
		* the caller's dictionary lookup, not this module's business.
		*
		* @module dsh-local-usage/client/paths
		*/
		/** Both separators, because the report describes directories on either kind of host. */
		const SEPARATORS = /[/\\]+/;
		/**
		* Last segment of an absolute working directory.
		*
		* A working directory is long and mostly boilerplate — on a real profile it
		* reads `/Users/someone/work/clients/acme-api` — and the segment that
		* distinguishes it is the last one. The full path stays available for a title
		* attribute, so nothing is lost, only deferred.
		* @param path - the directory as the report stated it.
		* @returns the last segment, or `undefined` when the row is the no-directory bucket.
		*/
		function projectName(path) {
			if (path === "unknown") return void 0;
			return path.split(SEPARATORS).filter((segment) => segment.length > 0).at(-1) ?? path;
		}
		//#endregion
		//#region src/client/wave.ts
		/** `HH:mm` for minutes after midnight, the label a day's axis carries. */
		function clockLabel(minutes) {
			return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
		}
		/** Two-digit zero padding, for a label that has to line up. */
		function pad(value) {
			return String(value).padStart(2, "0");
		}
		/** The local day-of-month and month of a `YYYY-MM-DD` key, or `undefined`. */
		function partsOf(day) {
			const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
			if (matched === null) return void 0;
			return {
				month: Number(matched[2]),
				date: Number(matched[3])
			};
		}
		/** `MM-DD`, the axis label a day bucket carries. */
		function dayLabel(day) {
			const parts = partsOf(day);
			return parts === void 0 ? day : `${pad(parts.month)}-${pad(parts.date)}`;
		}
		/** `M月` / `M`, the axis label a month bucket carries. */
		function monthLabel(month, zh) {
			return zh ? `${String(month)}月` : String(month);
		}
		/** The Monday-to-Sunday week a day belongs to, as its first day's index. */
		function weekStartOf(day) {
			const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
			if (matched === null) return 0;
			const time = Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
			const weekday = (new Date(time).getUTCDay() + 6) % 7;
			return Math.floor((time - weekday * 864e5) / 864e5);
		}
		/**
		* Bucket a range's usage into the wave's points.
		*
		* @param input - the range's day rows, its hours, and which range it is.
		* @param zh - whether the labels are written in Chinese, for the month names.
		* @returns the points, oldest first; empty when the range recorded nothing.
		*/
		function waveSeries(input, zh) {
			if (input.range === "day") return (input.slices ?? []).map((row) => ({
				label: clockLabel(row.minutes),
				cost: row.cost
			}));
			if (input.range === "year") {
				const byMonth = /* @__PURE__ */ new Map();
				for (const day of input.days) {
					const parts = partsOf(day.day);
					if (parts === void 0) continue;
					byMonth.set(parts.month, (byMonth.get(parts.month) ?? 0) + day.cost);
				}
				return [...byMonth.entries()].sort((left, right) => left[0] - right[0]).map(([month, cost]) => ({
					label: monthLabel(month, zh),
					cost
				}));
			}
			if (input.range === "quarter") {
				const byWeek = /* @__PURE__ */ new Map();
				for (const day of input.days) {
					const start = weekStartOf(day.day);
					const bucket = byWeek.get(start);
					if (bucket === void 0) byWeek.set(start, {
						label: dayLabel(day.day),
						cost: day.cost
					});
					else byWeek.set(start, {
						label: bucket.label,
						cost: bucket.cost + day.cost
					});
				}
				return [...byWeek.entries()].sort((left, right) => left[0] - right[0]).map(([, bucket]) => bucket);
			}
			return input.days.map((day) => ({
				label: dayLabel(day.day),
				cost: day.cost
			}));
		}
		/**
		* Lay points out across a unit square.
		*
		* A flat window is drawn flat rather than as a zero-height line at the top: with
		* nothing to scale against, every point belongs on the baseline.
		*
		* @param points - the buckets, oldest first.
		* @returns unit-square coordinates, one per point.
		*/
		function wavePlot(points) {
			if (points.length === 0) return [];
			const largest = points.reduce((best, point) => point.cost > best ? point.cost : best, 0);
			const span = points.length === 1 ? 1 : points.length - 1;
			return points.map((point, index) => ({
				x: index / span,
				y: largest <= 0 ? 0 : point.cost / largest
			}));
		}
		//#endregion
		//#region src/client/WaveChart.tsx
		/**
		* The range's spend as one blue wave.
		*
		* Hand-drawn SVG rather than a chart component, because there is no chart
		* component: this product's other figures — the wordmark, the permission icons,
		* the plugin artwork — are drawn the same way, and a plugin that installs
		* without running code is not the place to add a rendering engine for one shape.
		*
		* The wave is a whale's back on purpose. It is the shape the rest of the product
		* is drawn in, its fill is the brand blue mixed into the page rather than a
		* second palette, and a reader who has seen any DeepSeek surface already knows
		* how to read it. The area is smoothed through the midpoints between points, so
		* the curve reads as one swell instead of as the sample count.
		*
		* @module dsh-local-usage/client/WaveChart
		*/
		/**
		* The drawing's own coordinate space.
		*
		* Fixed rather than measured: the path is laid out once in these units and the
		* figure scales it, so the shape never depends on a resize landing before the
		* first paint. The stroke opts out of that scale, which is why the line stays the
		* width it was drawn at however wide the panel is.
		*/
		const VIEW_WIDTH = 1e3;
		const VIEW_HEIGHT = 220;
		/** Headroom kept above the swell, as a share of the height. */
		const CREST = .88;
		/**
		* How many points the axis names.
		*
		* Enough to place a swell in time, few enough that the labels never touch: a
		* year reads as seven months named, a day as seven hours, and the ends are
		* always two of them so the window's own bounds are on the axis.
		*/
		const MAX_TICKS = 7;
		/** Smooth a series through the midpoints between its points. */
		function swellPath(points) {
			if (points.length === 0) return "";
			const first = points[0];
			if (first === void 0) return "";
			let path = `M ${(first.x * VIEW_WIDTH).toFixed(2)} ${((1 - first.y * CREST) * VIEW_HEIGHT).toFixed(2)}`;
			for (let index = 1; index < points.length; index += 1) {
				const previous = points[index - 1];
				const point = points[index];
				if (previous === void 0 || point === void 0) continue;
				const px = previous.x * VIEW_WIDTH;
				const py = (1 - previous.y * CREST) * VIEW_HEIGHT;
				const x = point.x * VIEW_WIDTH;
				const y = (1 - point.y * CREST) * VIEW_HEIGHT;
				const mid = (px + x) / 2;
				path += ` C ${mid.toFixed(2)} ${py.toFixed(2)}, ${mid.toFixed(2)} ${y.toFixed(2)}, ${x.toFixed(2)} ${y.toFixed(2)}`;
			}
			return path;
		}
		/**
		* Render the range's spend as a wave.
		* @param props - the range's folds, its name, its state, and the formatter.
		* @returns the figure.
		*/
		function WaveChart({ input, caption, loading, empty, locale, t, formatCost }) {
			const points = (0, react.useMemo)(() => waveSeries(input, locale.toLowerCase().startsWith("zh")), [input, locale]);
			const plot = (0, react.useMemo)(() => wavePlot(points), [points]);
			const line = swellPath(plot);
			const area = line === "" ? "" : `${line} L ${String(VIEW_WIDTH)} ${String(VIEW_HEIGHT)} L 0 ${String(VIEW_HEIGHT)} Z`;
			const peak = points.reduce((best, point) => point.cost > best ? point.cost : best, 0);
			const ticks = (0, react.useMemo)(() => {
				if (points.length === 0) return [];
				const stride = [
					1,
					2,
					3,
					4,
					6,
					9,
					12,
					18,
					24
				].find((step) => Math.ceil(points.length / step) <= MAX_TICKS) ?? Math.ceil(points.length / MAX_TICKS);
				const chosen = [];
				for (let index = 0; index < points.length; index += stride) {
					const point = points[index];
					if (point === void 0) continue;
					chosen.push({
						index,
						x: plot[index]?.x ?? 0,
						y: plot[index]?.y ?? 0,
						label: point.label,
						cost: point.cost
					});
				}
				return chosen;
			}, [plot, points]);
			const total = points.reduce((sum, point) => sum + point.cost, 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
				className: css.wave,
				"aria-label": t("waveTitle"),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figcaption", {
						className: css.waveCaption,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.waveTitle,
								children: t("waveTitle")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.waveScope,
								children: caption
							}),
							empty || loading ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.wavePeak,
								children: t("wavePeak", { cost: formatCost(peak) })
							}),
							empty || loading ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.waveTotal,
								children: formatCost(total)
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.waveFrame,
						"data-loading": loading,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
								className: css.waveSvg,
								viewBox: `0 0 ${String(VIEW_WIDTH)} ${String(VIEW_HEIGHT)}`,
								preserveAspectRatio: "none",
								role: "img",
								"aria-label": t("waveTitle"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("linearGradient", {
									id: "dlu-wave-fill",
									x1: "0",
									y1: "0",
									x2: "0",
									y2: "1",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
										offset: "0%",
										className: css.waveStopTop
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("stop", {
										offset: "100%",
										className: css.waveStopBottom
									})]
								}) }), empty || loading ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [ticks.map((tick) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("line", {
									className: css.waveRule,
									x1: tick.x * VIEW_WIDTH,
									x2: tick.x * VIEW_WIDTH,
									y1: (1 - tick.y * CREST) * VIEW_HEIGHT,
									y2: VIEW_HEIGHT,
									vectorEffect: "non-scaling-stroke"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
									className: css.waveNode,
									cx: tick.x * VIEW_WIDTH,
									cy: (1 - tick.y * CREST) * VIEW_HEIGHT,
									r: 2.6
								})] }, tick.index)), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
									className: css.wavePlot,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										className: css.waveArea,
										d: area,
										fill: "url(#dlu-wave-fill)"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
										className: css.waveLine,
										d: line,
										vectorEffect: "non-scaling-stroke"
									})]
								})] })]
							}),
							empty && !loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: css.waveEmpty,
								children: t("noUsage")
							}) : null,
							loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: css.waveSpout,
								"aria-hidden": "true",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
										className: css.waveSpoutJet,
										viewBox: "-8 -16 42 50",
										width: "32",
										height: "38",
										focusable: "false",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13 33.5 C9.6 24 9.9 14.5 13 5.6 C16.1 14.5 16.4 24 13 33.5 Z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
											className: css.waveSpoutSpray,
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "13",
													cy: "-6.4",
													r: "1.9"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "9.4",
													cy: "-4.4",
													r: "1.5"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "16.6",
													cy: "-4.4",
													r: "1.5"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "5.8",
													cy: "-1.6",
													r: "1.2"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "20.2",
													cy: "-1.6",
													r: "1.2"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "3.2",
													cy: "-8.4",
													r: "0.95"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
													cx: "22.6",
													cy: "-8.4",
													r: "0.95"
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
										className: css.waveSpoutWhale,
										viewBox: `0 0 ${String(_deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_VIEWBOX.width)} ${String(_deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_VIEWBOX.height)}`,
										width: "42",
										height: 42 * _deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_VIEWBOX.height / _deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_VIEWBOX.width,
										focusable: "false",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: _deepseek_ai_dsh_client_ui_primitives.FISH_LOGO_PATH })
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
										className: css.waveSpoutWater,
										viewBox: "0 0 84 14",
										width: "84",
										height: "14",
										focusable: "false",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ellipse", {
											className: css.waveSpoutRipple,
											cx: "42",
											cy: "7",
											rx: "17",
											ry: "3.4"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ellipse", {
											className: css.waveSpoutRipple,
											cx: "42",
											cy: "7",
											rx: "17",
											ry: "3.4",
											"data-lag": "true"
										})]
									})
								]
							}) : null
						]
					}),
					empty || loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.waveTicks,
						"aria-hidden": "true"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.waveTicks,
						children: ticks.map((tick) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: css.waveTick,
							"data-edge": tick.index === 0 ? "start" : tick.index === points.length - 1 ? "end" : void 0,
							style: { insetInlineStart: `${(tick.x * 100).toFixed(3)}%` },
							title: formatCost(tick.cost),
							children: tick.label
						}, tick.index))
					})
				]
			});
		}
		//#endregion
		//#region src/client/PanelSkeleton.tsx
		/**
		* The page drawn before the page: the panel's own frame, standing in while the
		* first read runs.
		*
		* The first request after a restart decodes every durable session log, which on a
		* real corpus is seconds. What the reader used to get was one line of text and
		* then a whole layout appearing at once; what they get here is the layout itself,
		* empty — the same hero and tiles, the same year of cells at the same measured
		* edge, the same ranking rows — so nothing moves when the figures land.
		*
		* Only what genuinely cannot be known yet is a placeholder. The month labels, the
		* weekday gutter and the size of every cell are facts about the calendar, not
		* about the usage, so they are drawn for real; only the figures are ghosts. That
		* is also what keeps this honest: the frame is not decoration, it is the part of
		* the answer that arrived immediately.
		*
		* When the Host reports how many logs it has to fold, that count is stated with a
		* determinate bar. When it cannot, the bar sweeps instead — motion standing in for
		* time nobody can measure, in the one place it says something true.
		*
		* @module dsh-local-usage/client/PanelSkeleton
		*/
		const MS_PER_DAY$1 = 864e5;
		const WEEKDAY_ROWS = 7;
		/** Compact weekday gutter labels, matching the `wdShort.*` keys the calendar uses. */
		const WEEKDAY_SHORT_KEYS = [
			"wdShort.0",
			"wdShort.1",
			"wdShort.2",
			"wdShort.3",
			"wdShort.4",
			"wdShort.5",
			"wdShort.6"
		];
		/** Tiles the summary strip carries. */
		const TILE_COUNT = 7;
		/** Project rows drawn before the day's table arrives. */
		const PROJECT_ROWS = 4;
		/**
		* The hero figure's frame: a label line, the value line, and the line the peak
		* note occupies when there is one.
		*
		* The third line is drawn because the real hero almost always has one — the
		* shipped rate card carries a peak multiplier — and a frame that omits it is a
		* frame the panel settles out of when the figures land.
		*
		* @returns the hero's placeholder.
		*/
		function HeroSkeleton() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.hero,
				"aria-hidden": "true",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.skelLine,
						"data-width": "short"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.skelLine,
						"data-width": "hero"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.skelLine,
						"data-width": "detail"
					})
				]
			});
		}
		/**
		* The tiles row's frame, at the same track sizing the real one uses.
		* @returns the tiles' placeholder.
		*/
		function TilesSkeleton() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: css.tiles,
				"aria-hidden": "true",
				children: Array.from({ length: TILE_COUNT }, (_, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.tile,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.skelLine,
						"data-width": "value"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.skelLine,
						"data-width": "label"
					})]
				}, index))
			});
		}
		/**
		* The summary strip's frame, without its figures.
		*
		* Exported because it stands in twice: for the whole panel while the year is
		* being read, and for the strip alone on the first fold of a range — the moment
		* between the calendar arriving and its figures doing so. Both need the same
		* geometry, or the page settles twice.
		*
		* @returns the strip's placeholder.
		*/
		function SummarySkeleton() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: css.summary,
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HeroSkeleton, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TilesSkeleton, {})]
			});
		}
		/**
		* The day page's per-directory table, before it has any rows.
		*
		* A real table with real cells: the columns are sized by the same rules as the
		* rows that replace them, so a slow day fold fills the frame instead of resizing
		* it. The heading keeps its own box for the same reason.
		*
		* @returns the table's placeholder.
		*/
		function ProjectsSkeleton() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.projectBlock,
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: css.projectHeading,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: css.skelLine,
						"data-width": "heading"
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
					className: css.projectTable,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", { scope: "col" }), Array.from({ length: 5 }, (_, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
						scope: "col",
						className: css.numeric
					}, index))] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: Array.from({ length: PROJECT_ROWS }, (_, row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
						scope: "row",
						className: css.projectCell,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: css.skelLine,
							"data-width": "name"
						})
					}), Array.from({ length: 5 }, (_, column) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
						className: css.numeric,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: css.skelLine,
							"data-width": "cell"
						})
					}, column))] }, row)) })]
				})]
			});
		}
		/** Ranking rows drawn before the list arrives; the collapsed list shows ten. */
		const RANK_ROWS = 10;
		/**
		* The sentence and bar describing the read.
		*
		* A read that has not stated a size gets the sweeping bar and no count: printing
		* "0 / 0" would state a fact about nothing, and a bar pinned at zero would say the
		* work had stopped.
		*/
		function ReadProgressLine({ progress, t }) {
			const total = progress?.total ?? 0;
			const done = progress?.done ?? 0;
			const measured = total > 0;
			const sentence = progress?.phase === "reading" && measured ? t("loadingReading", {
				done: String(done),
				total: String(total)
			}) : progress?.phase === "listing" ? t("loadingListing") : progress?.phase === "pricing" ? t("loadingPricing") : t("loading");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.loading,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: css.loadingText,
					children: sentence
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: css.loadingTrack,
					"data-measured": measured,
					role: "progressbar",
					"aria-label": sentence,
					...measured ? {
						"aria-valuemin": 0,
						"aria-valuemax": total,
						"aria-valuenow": done
					} : {},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.loadingFill,
						style: measured ? { inlineSize: `${String(Math.round(done / total * 100))}%` } : void 0
					})
				})]
			});
		}
		/**
		* Render the loading frame.
		* @param props - the read's progress, the calendar window, and the dictionary.
		* @returns the frame the real panel replaces.
		*/
		function PanelSkeleton({ progress, weeks, t, children }) {
			const now = (0, react.useMemo)(() => Date.now(), []);
			const [from, to] = (0, react.useMemo)(() => heatmapWindow(now, weeks), [now, weeks]);
			const first = midnight(from);
			const last = midnight(to);
			const totalColumns = heatmapColumns(first, last);
			const { containerRef, cellSize, columns } = useResponsiveGrid(totalColumns);
			const visibleStart = first + (totalColumns - columns) * WEEKDAY_ROWS * MS_PER_DAY$1;
			const markers = (0, react.useMemo)(() => monthMarkers(visibleStart, last, columns).map((marker) => ({
				...marker,
				label: t("monthLabel", { n: String(marker.month) })
			})), [
				columns,
				last,
				t,
				visibleStart
			]);
			const trackTemplate = `${String(20)}px repeat(${String(columns)}, ${String(cellSize)}px)`;
			const ghosts = (0, react.useMemo)(() => {
				const cells = [];
				for (let column = 0; column < columns; column += 1) for (let row = 0; row < WEEKDAY_ROWS; row += 1) {
					if (visibleStart + (column * WEEKDAY_ROWS + row) * MS_PER_DAY$1 > last) continue;
					cells.push({
						key: `${String(column)}-${String(row)}`,
						column,
						row
					});
				}
				return cells;
			}, [
				columns,
				last,
				visibleStart
			]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ReadProgressLine, {
					progress,
					t
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummarySkeleton, {}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figure", {
					className: css.calendar,
					"aria-hidden": "true",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("figcaption", {
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
							className: css.skelLine,
							"data-width": "total"
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.calendarScroll,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							ref: containerRef,
							className: css.calendarMeasure,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: css.monthRow,
								style: {
									gridTemplateColumns: trackTemplate,
									columnGap: 4
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}), markers.map((marker) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: css.monthLabel,
									style: { gridColumnStart: marker.index + 2 },
									children: marker.label
								}, marker.key))]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: css.gridRow,
								style: {
									gridTemplateColumns: trackTemplate,
									columnGap: 4
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: css.weekdayColumn,
									style: {
										gridTemplateRows: `repeat(${String(WEEKDAY_ROWS)}, ${String(cellSize)}px)`,
										rowGap: 4
									},
									children: WEEKDAY_SHORT_KEYS.map((key) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.weekday,
										children: t(key)
									}, key))
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: css.cells,
									style: {
										gridColumn: "2 / -1",
										gridTemplateRows: `repeat(${String(WEEKDAY_ROWS)}, ${String(cellSize)}px)`,
										gridTemplateColumns: `repeat(${String(columns)}, ${String(cellSize)}px)`,
										gap: 4
									},
									children: ghosts.map((cell) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.cellGhost,
										style: {
											gridRowStart: cell.row + 1,
											gridColumnStart: cell.column + 1,
											inlineSize: cellSize,
											blockSize: cellSize
										}
									}, cell.key))
								})]
							})]
						})
					})]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: css.rank,
					"aria-hidden": "true",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: css.rankHead,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.skelLine,
								"data-width": "heading"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.skelLine,
								"data-width": "scope"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: `${css.rankRow} ${css.rankRowHead}`,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: css.rankPlace }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: css.rankName }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: css.rankTokens }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: css.rankCost }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: css.rankSessions })
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: css.rankList,
							children: Array.from({ length: RANK_ROWS }, (_, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: css.rankRow,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: css.rankPlace }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: css.rankName,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: css.skelLine,
											"data-width": "name"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: css.skelLine,
											"data-width": "path"
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.rankBar,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: css.skelBar,
											style: { inlineSize: `${String(barWidth(index))}%` }
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: css.rankTokens }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: css.rankCost }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: css.rankSessions })
								]
							}, index))
						})
					]
				}),
				children
			] });
		}
		/**
		* Bar length for one ghost row.
		*
		* Descending and irregular rather than uniform: a stack of identical bars reads
		* as a table of nothing, while the shape the list actually has is the one thing
		* about it that can be drawn before the list arrives.
		*
		* @param index - zero-based row.
		* @returns the fill width as a percentage of the track.
		*/
		function barWidth(index) {
			return [
				94,
				71,
				58,
				44,
				36,
				29,
				23,
				18,
				13,
				9
			][index] ?? 9;
		}
		//#endregion
		//#region src/client/Tile.tsx
		/**
		* Render one figure.
		* @param props - the formatted value, its label, and an optional note.
		* @returns the tile.
		*/
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
		//#endregion
		//#region src/client/DayDetail.tsx
		/**
		* One day's usage, split by the directory it was spent in.
		*
		* The calendar answers "when did this profile spend". A single cell cannot
		* answer the question a reader has next, which is *what* it was spent on, and
		* the only axis in this data that answers that is the working directory a
		* session was created in: a session belongs to exactly one, it is what the
		* harness itself groups session logs by on disk, and it is what a reader means
		* by a project.
		*
		* The split is not pre-computed on the calendar's year report. Narrowing the
		* window to this one day re-folds the samples the Host already cached, so
		* opening a day costs one local round trip and re-reads no log — which is why
		* this view can afford to be a full page rather than a drawn-out fetch.
		*
		* @module dsh-local-usage/client/DayDetail
		*/
		/** Tokens of any token-bearing row. */
		function tokensOf$1(row) {
			return row.uncachedInputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens;
		}
		/**
		* Render one day's usage, ranked by the directory that produced it.
		* @param props - the day, its report or its absence, the formatters, and the controls.
		* @returns the day view.
		*/
		function DayDetail({ day, report, failed, locale, t, formatCost, formatTokens, formatInteger, formatPercent, formatDay, weekdayOf, onRetry, onBack }) {
			const frame = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				frame.current?.focus();
			}, [day]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				ref: frame,
				className: css.dayDetail,
				tabIndex: -1,
				"aria-label": formatDay(day),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: css.dayHeader,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.headerText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: css.dayTitleRow,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									onClick: onBack,
									children: t("back")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									className: css.dayTitle,
									children: formatDay(day)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: css.dayWeekday,
									children: weekdayOf(day)
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: css.subtitle,
							children: t("daySubtitle")
						})]
					}), report === void 0 ? failed ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HeroSkeleton, {}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.hero,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.heroLabel,
								children: t("totalCost")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.heroValue,
								"data-room": figureRoom(formatCost(report.totals.cost)),
								children: formatCost(report.totals.cost)
							}),
							report.prices.some((card) => card.peakEnabled) || report.fallbackPrice.peakEnabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.heroDetail,
								children: t("peakNoteSeparate")
							}) : null
						]
					})]
				}), report === void 0 ? failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.failure,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: t("error")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						size: "sm",
						onClick: onRetry,
						children: t("retry")
					})]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TilesSkeleton, {}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WaveChart, {
						input: {
							days: [],
							slices: [],
							range: "day"
						},
						caption: t("waveHourScope"),
						loading: true,
						empty: false,
						locale,
						t,
						formatCost
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(ProjectsSkeleton, {})
				] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DayFigures, {
					report,
					locale,
					t,
					formatCost,
					formatTokens,
					formatInteger,
					formatPercent
				})]
			});
		}
		/** The figures of a day whose report has arrived. */
		function DayFigures({ report, locale, t, formatCost, formatTokens, formatInteger, formatPercent }) {
			const { totals, projects } = report;
			const hitRate = cacheHitRate(totals);
			const [open, setOpen] = (0, react.useState)(void 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.tiles,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
							value: formatTokens(tokensOf$1(totals)),
							label: t("totalTokens")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
							value: formatTokens(totals.uncachedInputTokens),
							label: t("inputTokens")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
							value: formatTokens(totals.outputTokens),
							label: t("outputTokens")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
							value: formatTokens(totals.cacheReadTokens),
							label: t("cacheRead"),
							detail: `${t("cacheWrite")} ${formatTokens(totals.cacheWriteTokens)}`
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
							value: hitRate === void 0 ? "—" : formatPercent(hitRate),
							label: t("cacheHitRate"),
							detail: t("cacheHitRateBasis")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
							value: formatInteger(totals.calls),
							label: t("calls")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
							value: formatInteger(projects.length),
							label: t("projects")
						})
					]
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WaveChart, {
					input: {
						days: report.days,
						slices: report.slices,
						range: "day"
					},
					caption: t("waveHourScope"),
					loading: false,
					empty: totals.calls === 0,
					locale,
					t,
					formatCost
				}),
				totals.calls === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: css.empty,
					children: t("dayEmpty")
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: css.projectBlock,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: css.projectHeading,
						children: t("dayProjects")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: css.projectTable,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: t("projectColumn")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: css.numeric,
								children: t("cost")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: css.numeric,
								children: t("totalTokens")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: css.numeric,
								children: t("outputTokens")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: css.numeric,
								children: t("calls")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: css.numeric,
								children: t("sessions")
							})
						] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: projects.map((row) => {
							const name = projectName(row.path);
							const expanded = open === row.path;
							const mine = report.sessions.filter((session) => row.path === "unknown" ? session.cwd === void 0 : session.cwd === row.path);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
									scope: "row",
									className: css.projectCell,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: css.projectToggle,
										"aria-expanded": expanded,
										onClick: () => {
											setOpen(expanded ? void 0 : row.path);
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: css.projectName,
												title: name === void 0 ? void 0 : row.path,
												children: name ?? t("projectUnknown")
											}),
											name === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
												className: css.projectPath,
												children: row.path
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: css.projectToggleHint,
												children: t("daySessionsIn", { count: formatInteger(mine.length) })
											})
										]
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: css.numeric,
									children: formatCost(row.cost)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: css.numeric,
									children: formatInteger(tokensOf$1(row))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: css.numeric,
									children: formatInteger(row.outputTokens)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: css.numeric,
									children: formatInteger(row.calls)
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
									className: css.numeric,
									children: formatInteger(row.sessions)
								})
							] }), expanded ? mine.map((session) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", {
								className: css.sessionInTable,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "row",
										className: css.projectCell,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: css.sessionName,
											children: session.title ?? t("sessionUntitled")
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: css.numeric,
										children: formatCost(session.cost)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: css.numeric,
										children: formatInteger(tokensOf$1(session))
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: css.numeric,
										children: formatInteger(session.outputTokens)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: css.numeric,
										children: formatInteger(session.calls)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { className: css.numeric })
								]
							}, session.sessionId)) : null] }, row.path);
						}) })]
					})]
				})
			] });
		}
		//#endregion
		//#region src/client/DataSourceNotes.tsx
		/** One labelled fact inside the disclosure. */
		function Fact({ label, children }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: label }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children })] });
		}
		/**
		* Render the provenance body.
		* @param props - the report's live counts, the host facts, the calendar window, and the dictionary.
		* @returns the facts list.
		*/
		function DataSourceNotes({ report, weeks, locale, t }) {
			const counts = t("dataCounts", {
				count: formatInteger(report.scannedSessions, locale),
				unreadable: report.unreadableSessions === 0 ? "" : t("unreadableNote", { count: formatInteger(report.unreadableSessions, locale) }),
				source: report.cached ? t("dataCountsCached") : t("dataCountsFresh")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
					}),
					report.unpricedRoutes.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.warning,
						role: "note",
						children: t("unpriced", { list: report.unpricedRoutes.join(", ") })
					})
				]
			});
		}
		//#endregion
		//#region src/client/Popover.tsx
		/**
		* A small icon button that opens a panel on hover and pins it on click.
		*
		* The panel's reference material — the rate table and the provenance block — is
		* consulted, not read start to finish, so it belongs beside the figures rather
		* than at the bottom of the column: hovering previews it, clicking pins it while
		* the reader copies a rate out. Both gestures land on the same panel, and the
		* keyboard reaches it the same way (focus opens nothing; Enter or Space pins,
		* Escape releases).
		*
		* @module dsh-local-usage/client/Popover
		*/
		/**
		* Render one icon trigger with its panel.
		* @param props - identity, copy, icon, width, availability and panel content.
		* @returns the host element.
		*/
		/** How long the pointer may be outside before the hover preview closes. */
		const HOVER_GRACE_MS = 160;
		function Popover({ id, label, hint, icon, width = 560, disabled = false, children }) {
			const [pinned, setPinned] = (0, react.useState)(false);
			const [hovered, setHovered] = (0, react.useState)(false);
			const host = (0, react.useRef)(null);
			const grace = (0, react.useRef)(void 0);
			const holdOpen = () => {
				if (disabled) return;
				window.clearTimeout(grace.current);
				grace.current = void 0;
				setHovered(true);
			};
			const releaseAfterGrace = () => {
				window.clearTimeout(grace.current);
				grace.current = window.setTimeout(() => {
					setHovered(false);
				}, HOVER_GRACE_MS);
			};
			(0, react.useEffect)(() => () => {
				window.clearTimeout(grace.current);
			}, []);
			const open = !disabled && (pinned || hovered);
			const panelId = `${id}-panel`;
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKeyDown = (event) => {
					if (event.key === "Escape") {
						window.clearTimeout(grace.current);
						setPinned(false);
						setHovered(false);
					}
				};
				const onPointerDown = (event) => {
					if (host.current !== null && !host.current.contains(event.target)) {
						window.clearTimeout(grace.current);
						setPinned(false);
						setHovered(false);
					}
				};
				document.addEventListener("keydown", onKeyDown);
				document.addEventListener("pointerdown", onPointerDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
					document.removeEventListener("pointerdown", onPointerDown);
				};
			}, [open]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.popoverHost,
				ref: host,
				onPointerEnter: holdOpen,
				onPointerLeave: releaseAfterGrace,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: css.iconButton,
					"aria-label": label,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					"aria-controls": panelId,
					"aria-disabled": disabled,
					"data-disabled": disabled,
					title: hint,
					onClick: () => {
						if (!disabled) setPinned((value) => !value);
					},
					children: icon
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					id: panelId,
					role: "dialog",
					"aria-label": label,
					className: css.popoverPanel,
					style: {
						display: open ? void 0 : "none",
						"--dlu-popover-inline": `${String(width)}px`
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.popoverTitle,
						children: label
					}), children]
				})]
			});
		}
		/** Rate-card glyph: a percent sign inside a card outline. */
		function RateIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 16 16",
				width: "15",
				height: "15",
				"aria-hidden": "true",
				focusable: "false",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
						x: "1.75",
						y: "2.75",
						width: "12.5",
						height: "10.5",
						rx: "2",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.3"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						d: "M5.2 10.4 10.8 5.6",
						stroke: "currentColor",
						strokeWidth: "1.3",
						strokeLinecap: "round"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "5.9",
						cy: "6.4",
						r: "1.05",
						fill: "currentColor"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
						cx: "10.1",
						cy: "9.6",
						r: "1.05",
						fill: "currentColor"
					})
				]
			});
		}
		/** Provenance glyph: a document with its folded corner. */
		function SourceIcon() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				viewBox: "0 0 16 16",
				width: "15",
				height: "15",
				"aria-hidden": "true",
				focusable: "false",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.5 2.75h5.4L12.5 6.3v6.95a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.3",
					strokeLinejoin: "round"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8.8 2.9v3.6h3.5",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.3",
					strokeLinejoin: "round"
				})]
			});
		}
		//#endregion
		//#region src/client/rate-draft.ts
		/** The four buckets, in the order the editor writes them. */
		const RATE_FIELDS = [
			"input",
			"cacheRead",
			"cacheWrite",
			"output"
		];
		/** Render one number the way an editable field shows it. */
		function draftOf(value) {
			return Number.isFinite(value) ? String(value) : "";
		}
		/** The four fields of one set, as the editor shows them. */
		function fieldsOf(rate) {
			return {
				input: draftOf(rate.input),
				cacheRead: draftOf(rate.cacheRead),
				cacheWrite: draftOf(rate.cacheWrite),
				output: draftOf(rate.output)
			};
		}
		/**
		* The drafts an editor opens on: one per card, pre-filled with what is in effect.
		* @param models - the cards the report published, in match order.
		* @returns one draft per card, keyed by `match`.
		*/
		function draftsFrom(models) {
			const drafts = {};
			for (const card of models) drafts[card.match] = {
				peakEnabled: card.peakEnabled,
				peak: fieldsOf(card.peak),
				offPeak: fieldsOf(card.offPeak)
			};
			return drafts;
		}
		/** Parse one field: `undefined` for blank, `null` for text that is not a price. */
		function readField(text) {
			const trimmed = text.trim();
			if (trimmed.length === 0) return void 0;
			const value = Number(trimmed);
			return Number.isFinite(value) && value >= 0 ? value : null;
		}
		/** Whether every field of one set is blank. */
		function isBlank(fields) {
			return RATE_FIELDS.every((field) => fields[field].trim().length === 0);
		}
		/** Whether two sets state the same four prices. */
		function samePrices(left, right) {
			return RATE_FIELDS.every((field) => left[field] === right[field]);
		}
		/**
		* Turn one set of drafts into the write it implies.
		*
		* A card is written only when it differs from what is in effect, so the table
		* never fills with edits that merely restate the configuration. Blank fields are
		* completed from the value in effect rather than rejected — a reader editing only
		* the output price means the other three as they stand — and a card whose fields
		* are all blank asks for the reader's edit to be dropped, returning the model to
		* its configured prices.
		*
		* @param drafts - the fields as typed.
		* @param models - the cards and the prices currently in effect.
		* @returns nothing to do, the first invalid field, or the update to send.
		*/
		function pendingUpdate(drafts, models) {
			const writes = {};
			for (const card of models) {
				const draft = drafts[card.match];
				if (draft === void 0) continue;
				if (isBlank(draft.offPeak) && isBlank(draft.peak)) {
					writes[card.match] = null;
					continue;
				}
				const offPeak = resolve(draft.offPeak, card.offPeak);
				if ("field" in offPeak) return {
					status: "invalid",
					model: card.match,
					set: "offPeak",
					field: offPeak.field
				};
				let peak = card.peak;
				if (draft.peakEnabled) {
					const read = resolve(draft.peak, card.peak);
					if ("field" in read) return {
						status: "invalid",
						model: card.match,
						set: "peak",
						field: read.field
					};
					peak = read.rate;
				}
				const next = {
					peakEnabled: draft.peakEnabled,
					peak,
					offPeak: offPeak.rate
				};
				if (!(next.peakEnabled === card.peakEnabled && samePrices(next.offPeak, card.offPeak) && samePrices(next.peak, card.peak))) writes[card.match] = next;
			}
			return Object.keys(writes).length === 0 ? { status: "empty" } : {
				status: "ready",
				update: { models: writes }
			};
		}
		/**
		* Read one set of fields, completing blanks from the prices in effect.
		* @param fields - the four fields as typed.
		* @param effective - the prices those fields stand for when left blank.
		* @returns either the four prices or the first field that is not one.
		*/
		function resolve(fields, effective) {
			const rate = {
				input: effective.input,
				cacheRead: effective.cacheRead,
				cacheWrite: effective.cacheWrite,
				output: effective.output
			};
			for (const field of RATE_FIELDS) {
				const value = readField(fields[field]);
				if (value === null) return { field };
				if (value !== void 0) rate[field] = value;
			}
			return { rate };
		}
		//#endregion
		//#region src/client/RateEditor.tsx
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
		/** How long the "saved" confirmation stays up. */
		const CONFIRMATION_MS = 2200;
		/** The dictionary key of each bucket's column label. */
		const FIELD_KEYS = {
			input: "pricingColumnInput",
			cacheRead: "pricingColumnCacheRead",
			cacheWrite: "pricingColumnCacheWrite",
			output: "pricingColumnOutput"
		};
		/**
		* Render the editable price cards.
		* @param props - the cards, currency, dictionary and the save action.
		* @returns the editor.
		*/
		function RateEditor({ models, currency, t, onSave }) {
			const [drafts, setDrafts] = (0, react.useState)(() => draftsFrom(models));
			const [busy, setBusy] = (0, react.useState)(false);
			const [saved, setSaved] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				setDrafts(draftsFrom(models));
			}, [models]);
			(0, react.useEffect)(() => {
				if (!saved) return;
				const timer = setTimeout(() => {
					setSaved(false);
				}, CONFIRMATION_MS);
				return () => {
					clearTimeout(timer);
				};
			}, [saved]);
			const pending = (0, react.useMemo)(() => pendingUpdate(drafts, models), [drafts, models]);
			const canSave = pending.status === "ready" && !busy;
			/** Write one field of one card as typed. */
			function write(model, set, field, value) {
				setSaved(false);
				setFailure(void 0);
				setDrafts((current) => {
					const draft = current[model] ?? blankDraft();
					return {
						...current,
						[model]: {
							...draft,
							[set]: {
								...draft[set],
								[field]: value
							}
						}
					};
				});
			}
			/** Turn one card's peak pricing on or off. */
			function switchPeak(model, peakEnabled) {
				setSaved(false);
				setFailure(void 0);
				setDrafts((current) => {
					const draft = current[model] ?? blankDraft();
					return {
						...current,
						[model]: {
							...draft,
							peakEnabled
						}
					};
				});
			}
			/** Put one card's fields back to the prices in effect, dropping unsaved edits. */
			function discard(model) {
				const card = models.find((candidate) => candidate.match === model);
				if (card === void 0) return;
				setSaved(false);
				setFailure(void 0);
				setDrafts((current) => ({
					...current,
					[model]: draftsFrom([card])[model] ?? blankDraft()
				}));
			}
			/** Commit one update. */
			async function commit(update) {
				setBusy(true);
				setFailure(void 0);
				try {
					await onSave(update);
					setSaved(true);
				} catch (error) {
					setFailure(error instanceof Error ? error.message : String(error));
				} finally {
					setBusy(false);
				}
			}
			if (models.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: css.editor,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
					className: css.editorTitle,
					children: t("pricingModelsTitle")
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: css.editorHint,
					children: t("pricingEditorEmpty")
				})]
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: css.editor,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
						className: css.editorTitle,
						children: t("pricingModelsTitle")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.editorHint,
						children: t("pricingModelsHint")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: css.editorCards,
						children: models.map((card) => {
							const draft = drafts[card.match] ?? blankDraft();
							const invalid = pending.status === "invalid" && pending.model === card.match ? pending : void 0;
							const name = card.match === "" ? t("pricingFallback") : card.match;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
								className: css.editorCard,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", {
										className: css.editorCardName,
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
											className: css.priceMatch,
											title: name,
											children: name
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: css.editorCardRow,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											className: css.editorToggle,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: draft.peakEnabled,
												disabled: busy,
												onChange: (event) => {
													switchPeak(card.match, event.target.checked);
												}
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("pricingPeakEnabled") })]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: css.rankMore,
											disabled: busy,
											onClick: () => {
												discard(card.match);
											},
											children: t("pricingReset")
										})]
									}),
									draft.peakEnabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PriceSet_, {
										card,
										set: "peak",
										label: t("pricingPeakPrices"),
										draft,
										invalid: invalid?.set === "peak" ? invalid.field : void 0,
										busy,
										t,
										write
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(PriceSet_, {
										card,
										set: "offPeak",
										label: draft.peakEnabled ? t("pricingOffPeakPrices") : t("pricingFlatPrice"),
										draft,
										invalid: invalid?.set === "offPeak" ? invalid.field : void 0,
										busy,
										t,
										write
									})
								]
							}, card.match);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.editorActions,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: css.rankMore,
								disabled: !canSave,
								onClick: () => {
									if (pending.status !== "ready") return;
									commit(pending.update);
								},
								children: t("pricingSave")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: css.priceCurrency,
								children: [currency, " / 1M"]
							}),
							pending.status === "invalid" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.editorError,
								role: "alert",
								children: t("pricingInvalid")
							}) : saved ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.editorStatus,
								role: "status",
								children: t("pricingSaved")
							}) : null,
							failure === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.editorError,
								role: "alert",
								children: t("pricingSaveFailed", { message: failure })
							})
						]
					})
				]
			});
		}
		/** One set of four prices, labelled and bound to its card. */
		function PriceSet_({ card, set, label, draft, invalid, busy, t, write }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.editorPriceRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: css.editorPriceLabel,
					children: label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: css.editorPriceFields,
					children: RATE_FIELDS.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: css.editorPriceField,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: css.visuallyHidden,
							children: `${card.match === "" ? "fallback" : card.match} ${label} ${t(FIELD_KEYS[field])}`
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							className: css.editorField,
							type: "text",
							inputMode: "decimal",
							"aria-label": `${card.match === "" ? "fallback" : card.match} ${label} ${t(FIELD_KEYS[field])}`,
							"aria-invalid": invalid === field,
							placeholder: t(FIELD_KEYS[field]),
							value: draft[set][field],
							disabled: busy,
							onChange: (event) => {
								write(card.match, set, field, event.target.value);
							}
						})]
					}, field))
				})]
			});
		}
		/** A blank card, used for a card the drafts have not caught up with. */
		function blankDraft() {
			const blank = () => Object.fromEntries(RATE_FIELDS.map((field) => [field, ""]));
			return {
				peakEnabled: false,
				peak: blank(),
				offPeak: blank()
			};
		}
		//#endregion
		//#region src/client/PricingNotes.tsx
		/**
		* Render the pricing body.
		* @param props - the report whose prices are in effect, the dictionary, and the write action.
		* @returns the pricing block.
		*/
		function PricingNotes({ report, t, formatTokens, onSaveRates }) {
			const schedule = report.peakWindows.length === 0 ? void 0 : t("pricingPeakSchedule", {
				windows: report.peakWindows.join(t("listSeparator")),
				weekdayScope: report.peakWeekdaysOnly ? t("pricingWeekdaysOnly") : t("pricingEveryDay")
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.disclosureBody,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("pricingFormula") }),
					schedule === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: schedule }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("pricingSource") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.pricingCaveat,
						children: t("pricingNotBill")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RateEditor, {
						models: [...report.prices, report.fallbackPrice],
						currency: report.currency,
						t,
						onSave: onSaveRates
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
						className: css.editor,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h4", {
								className: css.editorTitle,
								children: t("pricingRoutesTitle")
							}),
							report.routeRates.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: css.editorHint,
								children: t("pricingEditorEmpty")
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
								className: css.editorTable,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "col",
										children: t("pricingRouteColumn")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "col",
										children: t("pricingColumnModel")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "col",
										className: css.numeric,
										children: t("totalTokens")
									})
								] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: report.routeRates.map((entry) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
										scope: "row",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
											className: css.priceMatch,
											title: entry.route,
											children: entry.route
										})
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.editorSource,
										"data-source": entry.source,
										children: entry.source === "fallback" ? t("pricingSourceFallback") : entry.model ?? ""
									}) }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
										className: css.numeric,
										children: formatTokens(entry.tokens)
									})
								] }, entry.route)) })]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: css.pricingHint,
								children: t("pricingUnknownRoute")
							}),
							report.unpricedRoutes.length === 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: css.warning,
								role: "note",
								children: t("unpriced", { list: report.unpricedRoutes.join(", ") })
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/summary-state.ts
		/** The panel was left, so the strip holds nothing. */
		function summaryIdle() {
			return { status: "idle" };
		}
		/**
		* A fold began.
		*
		* Figures already on screen stay, marked as not yet replaced; the first fold of a
		* mount has none, so it falls back to the loading frame.
		*
		* @param previous - the state before the fold.
		* @returns the state to render while it runs.
		*/
		function summaryStarted(previous) {
			return previous.status === "ready" ? {
				...previous,
				pending: true,
				slow: false
			} : { status: "loading" };
		}
		/**
		* The fold is taking long enough that a reader would otherwise think it had
		* finished.
		*
		* @param previous - the state while the fold runs.
		* @returns the same state, admitting to the wait.
		*/
		function summarySlow(previous) {
			return previous.status === "ready" && previous.pending ? {
				...previous,
				slow: true
			} : previous;
		}
		/**
		* A fold landed.
		*
		* @param report - the report it answered with.
		* @param rangeId - the range it was folded for.
		* @returns the state that replaces the strip's figures.
		*/
		function summarySettled(report, rangeId) {
			return {
				status: "ready",
				report,
				rangeId,
				pending: false,
				slow: false
			};
		}
		/**
		* A fold failed.
		*
		* The previous figures are deliberately not kept here. They describe another
		* range, and with the selection already moved there would be nothing on screen to
		* say so — a wrong number is worse than a missing one, and the failure carries its
		* own retry.
		*
		* @returns the failure state.
		*/
		function summaryFailed() {
			return { status: "error" };
		}
		//#endregion
		//#region src/client/tokens.ts
		/**
		* Total tokens of any token-bearing row.
		* @param row - a row carrying the four provider buckets.
		* @returns the sum of the four buckets.
		*/
		function tokensOf(row) {
			return row.uncachedInputTokens + row.outputTokens + row.cacheReadTokens + row.cacheWriteTokens;
		}
		//#endregion
		//#region src/client/StatsTables.tsx
		/**
		* Rows a table lists before the reader has seen enough.
		*
		* A profile can carry dozens of routes; the ones worth reading are the ones at
		* the top of a list already sorted by cost, and the count beneath says how many
		* were left out so the table never claims to be the whole window.
		*/
		const ROWS = 8;
		/**
		* Render the window's spend by model and by project.
		* @param props - the report and the formatters.
		* @returns the two tables.
		*/
		function StatsTables({ report, t, formatCost, formatInteger }) {
			const models = report.models.slice(0, ROWS).map((row) => ({
				key: row.route,
				name: row.route,
				unpriced: !row.priced,
				figures: row,
				count: row.calls
			}));
			const projects = report.projects.slice(0, ROWS).map((row) => {
				const name = projectName(row.path);
				return {
					key: row.path,
					name: name ?? t("projectUnknown"),
					...name === void 0 ? {} : { detail: row.path },
					figures: row,
					count: row.sessions
				};
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: css.statsBlock,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatsTable, {
					heading: t("statsByModel"),
					nameColumn: t("routeColumn"),
					countColumn: t("calls"),
					rows: models,
					total: report.models.length,
					t,
					formatCost,
					formatInteger
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatsTable, {
					heading: t("statsByProject"),
					nameColumn: t("projectColumn"),
					countColumn: t("sessions"),
					rows: projects,
					total: report.projects.length,
					t,
					formatCost,
					formatInteger
				})]
			});
		}
		/** One of the two tables: a heading, four columns, and what it left out. */
		function StatsTable({ heading, nameColumn, countColumn, rows, total, t, formatCost, formatInteger }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: css.tableBlock,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
						className: css.tableHeading,
						children: heading
					}),
					rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.empty,
						children: t("noUsage")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("table", {
						className: css.projectTable,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								children: nameColumn
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: css.numeric,
								children: t("totalTokens")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: css.numeric,
								children: t("cost")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("th", {
								scope: "col",
								className: css.numeric,
								children: countColumn
							})
						] }) }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("tbody", { children: rows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("th", {
								scope: "row",
								className: css.projectCell,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.projectName,
										title: row.name === "unknown" ? void 0 : row.name,
										children: row.name
									}),
									row.detail === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
										className: css.projectPath,
										children: row.detail
									}),
									row.unpriced === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: css.unpricedBadge,
										children: t("pricingFallback")
									}) : null
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
								className: css.numeric,
								children: formatInteger(tokensOf(row.figures))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
								className: css.numeric,
								children: formatCost(row.figures.cost)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("td", {
								className: css.numeric,
								children: formatInteger(row.count)
							})
						] }, row.key)) })]
					}),
					total > rows.length ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.tableNote,
						children: t("statsMore", {
							shown: formatInteger(rows.length),
							total: formatInteger(total)
						})
					}) : null
				]
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
		* ranges re-prices instead of re-reading logs — and so does opening a day, which
		* is why a calendar cell can lead to a full page rather than a hover card.
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
		/**
		* How long a range fold may run before the strip says it is still going.
		*
		* A re-price folds samples already in hand and normally lands inside a frame or
		* two. Dimming the figures for that long would be a flicker rather than a signal,
		* so the admission waits for a wait worth admitting to.
		*/
		const STALE_VISIBLE_MS = 180;
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
		/**
		* One report with every figure at zero.
		*
		* The range a reader just clicked has not been folded yet, so the panel has no
		* figures for it — and the figures it does have belong to another range, which is
		* a worse thing to show than nothing. Zeroing them keeps the strip's layout
		* exactly as it was, which is why its figures are not unmounted in the first
		* place, while stating plainly that this range's numbers are not in yet.
		*
		* @param report - the report of the range that was selected before this one.
		* @returns the same report with its figures cleared.
		*/
		function zeroedOf(report) {
			return {
				...report,
				totals: {
					...report.totals,
					cost: 0,
					calls: 0,
					sessions: 0,
					uncachedInputTokens: 0,
					outputTokens: 0,
					cacheReadTokens: 0,
					cacheWriteTokens: 0
				},
				days: [],
				models: [],
				projects: [],
				sessions: [],
				unpricedRoutes: [],
				unpricedTokens: 0
			};
		}
		/**
		* Hold a loading state for at least `ms`, then let it go.
		*
		* A fold over cached samples lands in a few milliseconds, and a loading state
		* that lives for a single frame is not a loading state: it is a flash, and a
		* flash over a figure reads as a glitch. Showing it at once and releasing it no
		* sooner than this is what makes a switch look like a switch.
		*
		* @param active - whether the underlying state is loading.
		* @param ms - how long it must stay on screen once it has begun.
		* @returns whether to draw the loading state.
		*/
		function useMinimumDwell(active, ms) {
			const [shown, setShown] = (0, react.useState)(active);
			const startedAt = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				if (active) {
					startedAt.current = Date.now();
					setShown(true);
					return;
				}
				const remaining = ms - (Date.now() - startedAt.current);
				if (remaining <= 0) {
					setShown(false);
					return;
				}
				const timer = setTimeout(() => {
					setShown(false);
				}, remaining);
				return () => {
					clearTimeout(timer);
				};
			}, [active, ms]);
			return shown;
		}
		/**
		* Render the Usage statistics panel.
		* @param props - panel runtime, dictionary, and the injected report reader.
		* @returns the panel content.
		*/
		function UsagePanel({ panelId, locale, report, saveRates, t, usePanelInfo }) {
			const [rangeId, setRangeId] = (0, react.useState)("day");
			const [request, setRequest] = (0, react.useState)(0);
			const [gridState, setGridState] = (0, react.useState)({ status: "idle" });
			const [summaryState, setSummaryState] = (0, react.useState)({ status: "idle" });
			const waveSettled = summaryState.status === "ready" && summaryState.rangeId === rangeId;
			const waveLoading = useMinimumDwell(!waveSettled, 460);
			const [summaryRequest, setSummaryRequest] = (0, react.useState)(0);
			const [selectedDay, setSelectedDay] = (0, react.useState)(void 0);
			const [dayState, setDayState] = (0, react.useState)({ status: "idle" });
			const [dayRequest, setDayRequest] = (0, react.useState)(0);
			const [pricingRevision, setPricingRevision] = (0, react.useState)(0);
			const [progress, setProgress] = (0, react.useState)(void 0);
			const [entrance, setEntrance] = (0, react.useState)(true);
			const [returnDay, setReturnDay] = (0, react.useState)(void 0);
			const active = usePanelInfo((info) => info.activePanelId) === panelId;
			const now = (0, react.useMemo)(() => Date.now(), []);
			const [gridFrom, gridTo] = (0, react.useMemo)(() => heatmapWindow(now, WINDOW_WEEKS), [now]);
			const [rangeFrom, rangeTo] = (0, react.useMemo)(() => rangeBounds(rangeId, now), [rangeId, now]);
			const rangeIsWindow = rangeFrom === gridFrom && rangeTo === gridTo;
			(0, react.useEffect)(() => {
				if (!active) return;
				let current = true;
				setGridState({ status: "loading" });
				report({
					refresh: request > 0,
					from: gridFrom,
					to: gridTo,
					onProgress: (value) => {
						if (current) setProgress(value);
					}
				}).then((value) => {
					if (current) setGridState({
						status: "ready",
						report: value
					});
				}, () => {
					if (current) setGridState({ status: "error" });
				});
				return () => {
					current = false;
				};
			}, [
				active,
				report,
				request,
				pricingRevision,
				gridFrom,
				gridTo
			]);
			(0, react.useEffect)(() => {
				if (!active) {
					setSummaryState((previous) => previous.status === "idle" ? previous : summaryIdle());
					return;
				}
				if (gridState.status === "idle" || gridState.status === "loading") return;
				if (rangeIsWindow && gridState.status === "ready") {
					setSummaryState(summarySettled(gridState.report, rangeId));
					return;
				}
				let current = true;
				setSummaryState(summaryStarted);
				const slow = setTimeout(() => {
					if (current) setSummaryState(summarySlow);
				}, STALE_VISIBLE_MS);
				report({
					from: rangeFrom,
					to: rangeTo,
					compare: true
				}).then((value) => {
					if (current) setSummaryState(summarySettled(value, rangeId));
				}, () => {
					if (current) setSummaryState(summaryFailed());
				});
				return () => {
					current = false;
					clearTimeout(slow);
				};
			}, [
				active,
				report,
				rangeFrom,
				rangeTo,
				rangeIsWindow,
				summaryRequest,
				pricingRevision,
				gridState,
				rangeId
			]);
			(0, react.useEffect)(() => {
				if (!active || selectedDay === void 0) {
					setDayState((previous) => previous.status === "idle" ? previous : { status: "idle" });
					return;
				}
				const start = dayTime$1(selectedDay);
				if (start === void 0) {
					setDayState({ status: "error" });
					return;
				}
				let current = true;
				setDayState({ status: "loading" });
				report({
					from: start,
					to: start + MS_PER_DAY - 1
				}).then((value) => {
					if (current) setDayState({
						status: "ready",
						report: value
					});
				}, () => {
					if (current) setDayState({ status: "error" });
				});
				return () => {
					current = false;
				};
			}, [
				active,
				dayRequest,
				report,
				pricingRevision,
				selectedDay
			]);
			const activeLocale = locale();
			const currency = dayState.status === "ready" ? dayState.report.currency : gridState.status === "ready" ? gridState.report.currency : summaryState.status === "ready" ? summaryState.report.currency : "CNY";
			const money = (0, react.useCallback)((value) => formatCost(value, currency, activeLocale), [currency, activeLocale]);
			const tokens = (0, react.useCallback)((value) => formatTokens(value, activeLocale), [activeLocale]);
			const integer = (0, react.useCallback)((value) => formatInteger(value, activeLocale), [activeLocale]);
			const percent = (0, react.useCallback)((value) => formatPercent(value, activeLocale), [activeLocale]);
			const dateText = (0, react.useCallback)((value) => formatDay(value, activeLocale), [activeLocale]);
			const weekdayOf = (0, react.useCallback)((value) => {
				const time = dayTime$1(value);
				return time === void 0 ? "" : t(weekdayKey(time));
			}, [t]);
			const saveRateTable = (0, react.useCallback)(async (update) => {
				await saveRates(update);
				setPricingRevision((value) => value + 1);
			}, [saveRates]);
			const gridDays = gridState.status === "ready" ? gridState.report.days : [];
			const yearReport = gridState.status === "ready" ? gridState.report : void 0;
			const peak = gridDays.reduce((best, day) => best === void 0 || day.cost > best.cost ? day : best, void 0);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("section", {
				className: css.panel,
				"aria-busy": gridState.status === "loading" || dayState.status === "loading",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PanelBoundary, {
					fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: css.status,
						role: "alert",
						children: t("error")
					}),
					children: selectedDay !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DayDetail, {
						day: selectedDay,
						report: dayState.status === "ready" ? dayState.report : void 0,
						failed: dayState.status === "error",
						locale: activeLocale,
						t,
						formatCost: money,
						formatTokens: tokens,
						formatInteger: integer,
						formatPercent: percent,
						formatDay: dateText,
						weekdayOf,
						onRetry: () => {
							setDayRequest((value) => value + 1);
						},
						onBack: () => {
							setReturnDay(selectedDay);
							setSelectedDay(void 0);
						}
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
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
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: css.tools,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Popover, {
											id: "dlu-rates",
											label: t("pricingTitle"),
											hint: t("pricingTooltip"),
											icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RateIcon, {}),
											width: 700,
											disabled: yearReport === void 0,
											children: yearReport === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PricingNotes, {
												report: yearReport,
												t,
												formatTokens: tokens,
												onSaveRates: saveRateTable
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Popover, {
											id: "dlu-source",
											label: t("dataTitle"),
											hint: t("dataTooltip"),
											icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SourceIcon, {}),
											width: 560,
											disabled: yearReport === void 0,
											children: yearReport === void 0 ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DataSourceNotes, {
												report: yearReport,
												weeks: WINDOW_WEEKS,
												locale: activeLocale,
												t
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											size: "sm",
											disabled: gridState.status === "loading",
											onClick: () => {
												setRequest((value) => value + 1);
											},
											children: t("refresh")
										})
									]
								})]
							})]
						}),
						gridState.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
						gridState.status === "loading" || gridState.status === "idle" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PanelSkeleton, {
							progress,
							weeks: WINDOW_WEEKS,
							t,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WaveChart, {
								input: {
									days: [],
									slices: [],
									range: rangeId
								},
								caption: t(RANGES.find((candidate) => candidate.id === rangeId)?.key ?? "rangeMonth"),
								loading: true,
								empty: false,
								locale: activeLocale,
								t,
								formatCost: money
							})
						}) : null,
						gridState.status === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							summaryState.status === "ready" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummaryStrip, {
								report: waveSettled ? summaryState.report : zeroedOf(summaryState.report),
								animate: entrance,
								stale: summaryState.slow,
								onEntranceEnd: () => {
									setEntrance(false);
								},
								t,
								money,
								tokens,
								integer,
								percent
							}) : summaryState.status === "error" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: css.failure,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									role: "alert",
									children: t("error")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									onClick: () => {
										setSummaryRequest((value) => value + 1);
									},
									children: t("retry")
								})]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SummarySkeleton, {}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CalendarHeatmap, {
								from: gridFrom,
								to: gridTo,
								days: gridDays,
								totalCost: gridState.report.totals.cost,
								peak,
								t,
								formatCost: money,
								formatInteger: integer,
								formatDay: dateText,
								onSelectDay: setSelectedDay,
								...returnDay === void 0 ? {} : { focusDayOnMount: returnDay }
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WaveChart, {
								input: {
									days: waveSettled ? summaryState.report.days : [],
									slices: waveSettled ? summaryState.report.slices : [],
									range: rangeId
								},
								caption: t(RANGES.find((candidate) => candidate.id === rangeId)?.key ?? "rangeMonth"),
								loading: waveLoading,
								empty: waveSettled && summaryState.report.totals.calls === 0,
								locale: activeLocale,
								t,
								formatCost: money
							}),
							waveSettled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(StatsTables, {
								report: summaryState.report,
								t,
								formatCost: money,
								formatInteger: integer
							}) : null
						] }) : null
					] })
				})
			});
		}
		/**
		* The selected range's figures: one hero number, then the supporting tiles.
		*
		* Every figure here is scaled by one entrance share, so the strip fills in as a
		* single thing. `animate` is false for every render after the first read, which
		* is what makes a range switch swap the numbers rather than replay them.
		*
		* `stale` marks figures the reader is still looking at after the selection moved
		* on. They stay mounted and keep their own range's meaning — the strip is only
		* dimmed, never emptied, so a switch that takes a moment does not move the page.
		*/
		function SummaryStrip({ report, animate, stale, onEntranceEnd, t, money, tokens, integer, percent }) {
			const { totals } = report;
			const rangeTokens = report.days.reduce((sum, day) => sum + tokensOf(day), 0);
			const hitRate = cacheHitRate(totals);
			const share = useEntrance(animate, onEntranceEnd);
			const cost = money(totals.cost);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: css.summary,
				"aria-label": t("rangeLabel"),
				"aria-busy": stale,
				"data-stale": stale,
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
								"data-room": figureRoom(cost),
								children: money(totals.cost * share)
							}),
							report.prices.some((card) => card.peakEnabled) || report.fallbackPrice.peakEnabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: css.heroDetail,
								children: t("peakNoteSeparate")
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: css.tiles,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: tokens(rangeTokens * share),
								label: t("totalTokens")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: tokens(totals.uncachedInputTokens * share),
								label: t("inputTokens")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: tokens(totals.outputTokens * share),
								label: t("outputTokens")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: tokens(totals.cacheReadTokens * share),
								label: t("cacheRead"),
								detail: `${t("cacheWrite")} ${tokens(totals.cacheWriteTokens * share)}`
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: hitRate === void 0 ? "—" : percent(hitRate * share),
								label: t("cacheHitRate"),
								detail: t("cacheHitRateBasis")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: integer(totals.calls * share),
								label: t("calls")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(Tile, {
								value: integer(totals.sessions * share),
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
			loadingListing: "正在枚举会话日志…",
			loadingReading: "正在读取会话 {done} / {total}",
			loadingPricing: "正在计价…",
			updating: "正在更新…",
			error: "无法读取用量数据。",
			retry: "重试",
			totalCost: "总花费",
			cost: "花费",
			totalTokens: "总 tokens",
			inputTokens: "输入",
			outputTokens: "输出",
			cacheRead: "缓存命中",
			cacheWrite: "缓存写入",
			cacheHitRate: "缓存命中率",
			cacheHitRateBasis: "占全部输入 token",
			calls: "调用次数",
			sessions: "会话数",
			reliability: "可靠性",
			retries: "重试",
			toolErrors: "工具错误",
			compactionFailures: "压缩失败",
			countTimes: "{count} 次",
			toolErrorNote: "{errors} 次错误 / {calls} 次调用",
			compactionNote: "共 {attempts} 次压缩尝试",
			moreCauses: "另有 {count} 类",
			causeRateLimit: "限流",
			causeTimeout: "超时",
			causeTransport: "连接中断",
			causeServer: "服务端错误",
			causeUnknown: "未标注原因",
			calendar: "用量热力图",
			waveTitle: "用量走势",
			waveHourScope: "每小时 · 北京时间",
			wavePeak: "峰值 {cost}",
			statsByModel: "按模型",
			statsByProject: "按项目",
			statsMore: "只列出花费最高的 {shown} 条，共 {total} 条",
			calendarHint: "每一格是一天，颜色越深花费越高；悬停看当天明细，点击进入当天详情",
			calendarWindow: "近 52 周",
			legendLess: "少",
			legendMore: "多",
			peakDay: "单日最高 {day} · {cost}",
			noUsage: "这个范围内没有用量记录。",
			noUsageDay: "当天没有用量记录",
			back: "返回日历",
			breakout: "明细",
			breakdownTitle: "明细",
			breakdownSubtitle: "这个范围的数字由什么构成：归因、时段与成本结构",
			breakdownCompare: "与上一个等长窗口相比",
			breakdownCompareUnavailable: "这次没有取上一个窗口的对比。",
			breakdownPreviousCost: "上期花费",
			breakdownPreviousRange: "{from} 至 {to}",
			breakdownChange: "变化",
			breakdownPreviousCalls: "上期 {count} 次调用",
			breakdownPreviousTokens: "上期 tokens",
			breakdownComposition: "成本构成",
			breakdownPeakCost: "高峰时段花费",
			breakdownNoPeak: "这个窗口没有落在高峰时段的调用。",
			breakdownPeakShare: "占 {share}，共 {calls} 次",
			breakdownPremium: "高峰倍率多收",
			breakdownPremiumHint: "若这些调用都发生在空闲时段，可以少付这些",
			breakdownCacheSaved: "缓存省下",
			breakdownNoCache: "这个窗口没有命中缓存的输入。",
			breakdownCacheBasis: "其中实付 {paid}",
			breakdownAverageCall: "平均每次调用",
			breakdownAverageSession: "平均每个会话",
			breakdownAverageDay: "平均每个活跃日",
			breakdownActiveDays: "共 {count} 个活跃日",
			breakdownByRoute: "按模型归因",
			routeColumn: "路由",
			breakdownRouteNote: "只列出花费最高的 {shown} 条，共 {total} 条",
			breakdownWhen: "时段分布",
			breakdownByDay: "按天",
			breakdownDayNote: "只显示最近 {shown} 个活跃日，范围内共 {total} 个",
			breakdownByHour: "按小时（北京时间，与高峰时段同一把尺）",
			breakdownByWeekday: "按星期",
			breakdownSessions: "最贵的会话",
			sessionUntitled: "（未命名会话）",
			breakdownSessionNote: "只列出最贵的 {shown} 个，共 {total} 个",
			breakdownExport: "导出",
			breakdownExportHint: "把当前范围的每日数字导出为 CSV，供表格软件打开",
			breakdownExportAction: "下载 CSV",
			daySubtitle: "当天在本机各工作目录的用量分布",
			dayProjects: "按项目",
			dayEmpty: "当天没有用量记录。",
			projectColumn: "项目",
			projects: "项目",
			projectUnknown: "未记录工作目录",
			daySessionsIn: "{count} 个会话",
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
			dataFlow: "日志由运行 dsh 服务端的进程读取并在其内存中折叠；折叠出的样本（不含任何消息正文）缓存在 <DSH_HOME>/local-usage/fold-cache.json，使重启后无需重读日志。除本地读写外不发起任何外部请求，也不上传任何数据。",
			dataCounts: "本次读取：扫描 {count} 个会话{unreadable}；{source}。",
			dataCountsCached: "结果来自已折叠的缓存，未重新读盘",
			dataCountsFresh: "已重新读取全部日志",
			pricingTitle: "计价方式",
			pricingFormula: "花费 = Σ（各 token 桶 × 对应费率）÷ 1,000,000，并按每次调用发生的时刻判定高峰/空闲。",
			pricingSource: "费率来自本插件的配置价目表，不是从 provider 账单读回来的：Harness 只记录 token，不记录货币。",
			pricingNotBill: "因此这里的金额是估算值。预购额度、套餐包、阶梯折扣、赠送余额、聚合商加价或转售差价都不会体现在其中，与真实扣费必然存在差异；请以 provider 账单为准。",
			pricingFallback: "默认费率（未匹配任何规则的路由）",
			pricingColumnInput: "输入（未命中）",
			pricingColumnCacheRead: "缓存命中",
			pricingColumnCacheWrite: "缓存写入",
			pricingColumnOutput: "输出",
			pricingUnknownRoute: "unknown 表示日志中没有记录 provider/model 的调用；multiple 表示一轮里换了多个模型。",
			pricingPeakSchedule: "高峰时段：{windows}（北京时间，周{weekdayScope}）；其余时段为低峰价，两套价各自独立设置。",
			pricingModelsTitle: "按模型定价",
			pricingModelsHint: "一个模型一套价：同一模型的各渠道、各命名空间路由共用这份配置，改一处即对所有路由生效。每行四个数依次是输入 / 缓存读 / 缓存写 / 输出（每百万 token）；关闭「按高峰计价」后，该模型全天按统一价计费。",
			pricingPeakEnabled: "按高峰计价",
			pricingPeakPrices: "高峰价",
			pricingOffPeakPrices: "低峰价",
			pricingFlatPrice: "统一价",
			pricingRoutesTitle: "按路由统计",
			pricingColumnModel: "模型 / 费率来源",
			peakNoteSeparate: "高峰时段按模型另计",
			pricingEditorEmpty: "这个窗口里还没有出现过任何路由，因此暂时没有可手工定价的对象。换个范围，或等有调用记录后再来。",
			pricingRouteColumn: "路由",
			pricingEditInput: "输入",
			pricingEditCacheRead: "缓存读",
			pricingEditCacheWrite: "缓存写",
			pricingEditOutput: "输出",
			pricingSourceFallback: "默认费率",
			pricingSave: "保存费率",
			pricingSaved: "已保存",
			pricingReset: "还原",
			pricingInvalid: "费率必须是不小于 0 的数字",
			pricingSaveFailed: "保存失败：{message}",
			pricingTooltip: "费率与计费方式",
			rankingTitle: "项目 Token 消耗",
			rankingScope: "{range} · 共 {count} 个项目",
			rankingColumnRank: "排名",
			rankingShowAll: "查看全部 {count} 个项目",
			rankingCollapse: "只看前 {count} 个",
			rankingEmpty: "这个范围内没有项目用量。",
			dataTooltip: "用量依据与数据流向",
			listSeparator: "、",
			pricingWeekdaysOnly: "一至周五",
			pricingEveryDay: "一至周日",
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
			loadingListing: "Listing session logs…",
			loadingReading: "Reading session {done} of {total}",
			loadingPricing: "Pricing…",
			updating: "Updating…",
			error: "Usage data could not be read.",
			retry: "Retry",
			totalCost: "Total spend",
			cost: "Cost",
			totalTokens: "Total tokens",
			inputTokens: "Input",
			outputTokens: "Output",
			cacheRead: "Cache read",
			cacheWrite: "Cache write",
			cacheHitRate: "Cache hit rate",
			cacheHitRateBasis: "of all input tokens",
			calls: "Calls",
			sessions: "Sessions",
			reliability: "Reliability",
			retries: "Retries",
			toolErrors: "Tool errors",
			compactionFailures: "Compaction failures",
			countTimes: "{count}",
			toolErrorNote: "{errors} of {calls} calls",
			compactionNote: "of {attempts} compaction attempts",
			moreCauses: "{count} more kinds",
			causeRateLimit: "rate limit",
			causeTimeout: "timeout",
			causeTransport: "transport",
			causeServer: "server error",
			causeUnknown: "unlabelled",
			calendar: "Usage heatmap",
			waveTitle: "Spend over time",
			waveHourScope: "By hour, Beijing time",
			wavePeak: "Peak {cost}",
			statsByModel: "By model",
			statsByProject: "By project",
			statsMore: "The {shown} dearest of {total}",
			calendarHint: "One cell per day, darker means more spent; hover for the day’s figures, click to open it",
			calendarWindow: "Last 52 weeks",
			legendLess: "Less",
			legendMore: "More",
			peakDay: "Highest day {day} · {cost}",
			noUsage: "No usage recorded in this range.",
			noUsageDay: "No usage recorded",
			back: "Back to calendar",
			breakout: "Breakdown",
			breakdownTitle: "Breakdown",
			breakdownSubtitle: "What this range is made of: attribution, timing, and where the money went",
			breakdownCompare: "Against the window before it",
			breakdownCompareUnavailable: "No comparison was folded for this read.",
			breakdownPreviousCost: "Previous spend",
			breakdownPreviousRange: "{from} to {to}",
			breakdownChange: "Change",
			breakdownPreviousCalls: "{count} calls before",
			breakdownPreviousTokens: "Tokens before",
			breakdownComposition: "Where the money went",
			breakdownPeakCost: "Spent at peak",
			breakdownNoPeak: "No settlement in this range fell inside a peak window.",
			breakdownPeakShare: "{share} of the bill, over {calls} calls",
			breakdownPremium: "Peak multiplier charged",
			breakdownPremiumHint: "What these calls would not have cost off-peak",
			breakdownCacheSaved: "Saved by caching",
			breakdownNoCache: "Nothing in this range was served from the provider cache.",
			breakdownCacheBasis: "{paid} of it actually paid",
			breakdownAverageCall: "Average per call",
			breakdownAverageSession: "Average per session",
			breakdownAverageDay: "Average per active day",
			breakdownActiveDays: "Over {count} active days",
			breakdownByRoute: "By route",
			routeColumn: "Route",
			breakdownRouteNote: "The {shown} dearest of {total} routes",
			breakdownWhen: "When it went",
			breakdownByDay: "By day",
			breakdownDayNote: "The most recent {shown} of {total} active days",
			breakdownByHour: "By hour, Beijing time — the clock the peak schedule is stated in",
			breakdownByWeekday: "By weekday",
			breakdownSessions: "Dearest sessions",
			sessionUntitled: "(untitled session)",
			breakdownSessionNote: "The {shown} dearest of {total} sessions",
			breakdownExport: "Export",
			breakdownExportHint: "The range’s daily figures as CSV, for a spreadsheet",
			breakdownExportAction: "Download CSV",
			daySubtitle: "This day’s usage, split by the directory it was spent in",
			dayProjects: "By project",
			dayEmpty: "No usage recorded on this day.",
			projectColumn: "Project",
			projects: "Projects",
			projectUnknown: "No working directory",
			daySessionsIn: "{count} sessions",
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
			dataFlow: "The process running the dsh server reads the logs and folds them in its own memory; the samples it folds (never any message body) are cached at <DSH_HOME>/local-usage/fold-cache.json so a restart need not re-read the logs. Apart from those local reads and writes it makes no external request and uploads nothing.",
			dataCounts: "This read: {count} sessions scanned{unreadable}; {source}.",
			dataCountsCached: "served from folds already taken, without re-reading",
			dataCountsFresh: "every log re-read",
			pricingTitle: "How cost is computed",
			pricingFormula: "Cost = Σ (each token bucket × its rate) ÷ 1,000,000, with peak or off-peak decided per call at the moment it happened.",
			pricingSource: "The rates come from this plugin’s own price table, not from a provider invoice: the harness records tokens, never currency.",
			pricingNotBill: "The figure is therefore an estimate. Prepaid credit, package plans, volume discounts, granted balance, aggregator markups and reseller margins are all invisible here, so it will differ from what you are actually charged; treat the provider invoice as authoritative.",
			pricingFallback: "Fallback rate (routes matching no rule)",
			pricingColumnInput: "Input (miss)",
			pricingColumnCacheRead: "Cache read",
			pricingColumnCacheWrite: "Cache write",
			pricingColumnOutput: "Output",
			pricingUnknownRoute: "unknown means the log recorded no provider/model for the call; multiple means one turn switched models.",
			pricingPeakSchedule: "Peak: {windows} (Beijing time, {weekdayScope}); every other hour is billed at the off-peak prices, and the two sets are set independently.",
			pricingModelsTitle: "Price by model",
			pricingModelsHint: "One card per model: every vendor route of the same model shares it, so one edit reaches all of them. The four numbers in a row are input / cache read / cache write / output, per million tokens; turn peak pricing off and the model is billed at one price all day.",
			pricingPeakEnabled: "Peak pricing",
			pricingPeakPrices: "Peak prices",
			pricingOffPeakPrices: "Off-peak prices",
			pricingFlatPrice: "Flat price",
			pricingRoutesTitle: "By route",
			pricingColumnModel: "Model / source",
			peakNoteSeparate: "Peak priced per model",
			pricingEditorEmpty: "This window recorded no routes yet, so there is nothing to price by hand. Pick a wider range, or come back once the window has a call in it.",
			pricingRouteColumn: "Route",
			pricingEditInput: "Input",
			pricingEditCacheRead: "Cache read",
			pricingEditCacheWrite: "Cache write",
			pricingEditOutput: "Output",
			pricingSourceFallback: "default rate",
			pricingSave: "Save rates",
			pricingSaved: "Saved",
			pricingReset: "Reset",
			pricingInvalid: "A rate must be a number of at least 0",
			pricingSaveFailed: "Could not save: {message}",
			pricingTooltip: "Rates and how cost is computed",
			rankingTitle: "Tokens by project",
			rankingScope: "{range} · {count} projects",
			rankingColumnRank: "Rank",
			rankingShowAll: "Show all {count} projects",
			rankingCollapse: "Show the top {count}",
			rankingEmpty: "No project usage in this range.",
			dataTooltip: "Where the figures come from",
			listSeparator: ", ",
			pricingWeekdaysOnly: "Monday to Friday",
			pricingEveryDay: "every day",
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
`;
		//#endregion
		//#region src/client/wire-report.ts
		/**
		* Normalize a report as it arrives from the Host.
		*
		* The browser bundle is served from disk and swapped live, while the Host half
		* only changes on a restart. That window is real: a freshly built Client can
		* read a report an older Host produced, and a missing field must then cost the
		* reader a subsection — never the whole panel, because a render-time throw
		* blanks the main column.
		*
		* Defaults live here rather than at each call site so the components can stay
		* total over the declared report shape.
		*
		* @module dsh-local-usage/client/wire-report
		*/
		/** Card used when the Host reported none; shows the figure was unpriced. */
		const NO_RATE = {
			match: "",
			peakEnabled: false,
			peak: {
				input: 0,
				cacheRead: 0,
				cacheWrite: 0,
				output: 0
			},
			offPeak: {
				input: 0,
				cacheRead: 0,
				cacheWrite: 0,
				output: 0
			}
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
				projects: value.projects ?? [],
				sessions: value.sessions ?? [],
				scannedSessions: value.scannedSessions ?? 0,
				unreadableSessions: value.unreadableSessions ?? 0,
				reliability: value.reliability ?? NO_RELIABILITY,
				unpricedRoutes: value.unpricedRoutes ?? [],
				unpricedTokens: value.unpricedTokens ?? 0,
				cached: value.cached ?? false,
				routeRates: (value.routeRates ?? []).map((route) => ({
					...route,
					tokens: route.tokens ?? 0
				})),
				prices: value.prices ?? [],
				fallbackPrice: value.fallbackPrice ?? NO_RATE,
				peakWindows: value.peakWindows ?? [],
				peakWeekdaysOnly: value.peakWeekdaysOnly ?? true,
				slices: value.slices ?? []
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
		/** Host route this panel writes its per-route rate table to. */
		const PRICING_PATH = "/api/dsh-local-usage/pricing";
		/** Host route this panel asks what a read in flight is doing. */
		const PROGRESS_PATH = "/api/dsh-local-usage/progress";
		/**
		* How often the panel asks the Host what it is doing.
		*
		* Slow enough to be invisible next to the work it describes — a cold read is
		* seconds, and spends most of it inside the decoder — and fast enough that the
		* count never looks stuck.
		*/
		const PROGRESS_POLL_MS = 200;
		/** Services required by the sidebar and main-slot registrations. */
		const inject = ["slots", "locale"];
		/**
		* Follow one report request's progress until it settles.
		*
		* A failure here is never reported: the progress route is an extra, so a Host
		* that predates it — or one whose answer is unreadable — costs the frame its
		* count and nothing else. That is also what makes a freshly built Client safe
		* against an older Host, the same way `normalizeReport` does for the report.
		*
		* @param onProgress - called with each state the Host reports.
		* @returns the disposer that stops the polling.
		*/
		function followProgress(onProgress) {
			let live = true;
			const ask = async () => {
				try {
					const response = await fetch(new URL(PROGRESS_PATH, window.location.origin), { credentials: "include" });
					if (!response.ok) return;
					const value = await response.json();
					if (live) onProgress(value);
				} catch {}
			};
			ask();
			const timer = window.setInterval(() => {
				ask();
			}, PROGRESS_POLL_MS);
			return () => {
				live = false;
				window.clearInterval(timer);
			};
		}
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
				report: async ({ from, to, refresh, compare, onProgress }) => {
					const url = new URL(REPORT_PATH, window.location.origin);
					url.searchParams.set("from", String(from));
					url.searchParams.set("to", String(to));
					if (refresh === true) url.searchParams.set("refresh", "1");
					if (compare === true) url.searchParams.set("compare", "1");
					const stop = onProgress === void 0 ? void 0 : followProgress(onProgress);
					try {
						const response = await fetch(url, { credentials: "include" });
						if (!response.ok) throw new Error(`usage report failed: HTTP ${String(response.status)}`);
						return normalizeReport(await response.json());
					} finally {
						stop?.();
					}
				},
				saveRates: async (update) => {
					const response = await fetch(new URL(PRICING_PATH, window.location.origin), {
						method: "POST",
						credentials: "include",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(update)
					});
					if (!response.ok) {
						const detail = await response.text().catch(() => "");
						throw new Error(`HTTP ${String(response.status)}${detail.length === 0 ? "" : `: ${detail.slice(0, 200)}`}`);
					}
					return await response.json();
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
		exports.PRICING_PATH = PRICING_PATH;
		exports.PROGRESS_PATH = PROGRESS_PATH;
		exports.REPORT_PATH = REPORT_PATH;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map