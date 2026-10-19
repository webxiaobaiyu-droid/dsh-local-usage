import { foldSessionTitle } from "@deepseek-ai/dsh-session-title";
import { lastAssistantStreamChunk } from "@deepseek-ai/dsh-llm/assistant-stream";
import { readFileSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
const MINUTES_PER_DAY = 1440;
const WINDOW_PATTERN = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/;
/**
* Parse one `HH:MM-HH:MM` peak window in Beijing time.
* @param spec - window text as configured.
* @returns the parsed half-open minute range, or `undefined` when it is malformed or empty.
*/
function parsePeakWindow(spec) {
	const matched = WINDOW_PATTERN.exec(spec.trim());
	if (matched === null) return void 0;
	const start = Number(matched[1]) * 60 + Number(matched[2]);
	const end = Number(matched[3]) * 60 + Number(matched[4]);
	if (start >= MINUTES_PER_DAY || end > MINUTES_PER_DAY || start >= end) return void 0;
	return {
		start,
		end
	};
}
/**
* Beijing-time weekday and minute-of-day for one instant.
* @param time - Unix epoch milliseconds.
* @returns the weekday (`0` = Sunday) and minutes after Beijing midnight.
*/
function beijingClock(time) {
	const shifted = new Date(time + 288e5);
	return {
		weekday: shifted.getUTCDay(),
		minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
	};
}
/**
* Whether a resolved Beijing clock falls inside a configured peak window.
*
* Separate from {@link isPeakTime} so a fold that needs the clock for something
* else — the slice-of-day profile — resolves it once per sample instead of twice.
*
* @param clock - weekday and minutes after Beijing midnight.
* @param windows - parsed peak windows in Beijing time.
* @param weekdaysOnly - when true, Saturday and Sunday are never peak.
* @returns true when the instant falls in a peak window.
*/
function isPeakClock(clock, windows, weekdaysOnly) {
	if (windows.length === 0) return false;
	if (weekdaysOnly && (clock.weekday === 0 || clock.weekday === 6)) return false;
	return windows.some((window) => clock.minutes >= window.start && clock.minutes < window.end);
}
/**
* Resolve the card a route is priced with.
*
* The match is a substring of the route rather than an equality, because one
* model is sold under vendor prefixes and namespaces that differ by deployment:
* `deepseek-v4-flash` has to claim `workbuddy/cn:deepseek-v4-flash` and
* `vendor-a/deepseek-v4-flash` alike. The first card in configuration order that
* appears in the route wins, so a specific name can precede a general one.
*
* @param models - configured cards in match order.
* @param fallback - card used when no model claims the route.
* @param route - `provider/model` the usage was attributed to.
* @returns the card and whether a configured model claimed the route.
*/
function matchModel(models, fallback, route) {
	const needle = route.toLocaleLowerCase();
	const claimed = models.find((candidate) => needle.includes(candidate.match.toLocaleLowerCase()));
	return claimed === void 0 ? {
		card: fallback,
		source: "fallback"
	} : {
		card: claimed,
		source: "model"
	};
}
/**
* Select the prices one settlement is billed at.
*
* @param models - configured cards in match order.
* @param fallback - card used when no model claims the route.
* @param route - `provider/model` the usage was attributed to.
* @param peak - whether the settlement falls inside a peak window.
* @returns the effective prices, their source, and whether peak pricing applied.
*/
function selectRate(models, fallback, route, peak) {
	const { card, source } = matchModel(models, fallback, route);
	const peakApplied = peak && card.peakEnabled;
	return {
		rate: peakApplied ? card.peak : card.offPeak,
		matched: source === "model",
		source,
		peakApplied,
		...source === "fallback" ? {} : { model: card.match }
	};
}
/**
* Price one bucket set at one rate.
* @param tokens - bucket counts to price.
* @param rate - currency units per one million tokens for each bucket.
* @returns the cost in the configured currency.
*/
function costOf(tokens, rate) {
	return (tokens.uncachedInputTokens * rate.input + tokens.cacheReadTokens * rate.cacheRead + tokens.cacheWriteTokens * rate.cacheWrite + tokens.outputTokens * rate.output) / 1e6;
}
//#endregion
//#region src/aggregate.ts
/**
* Pure folds turning durable session events into a priced usage report.
*
* The extractor mirrors the harness's own `tokenUsage` projection so its totals
* agree with the persisted projection, then adds the two things that projection
* deliberately omits: a calendar day and a money figure.
*
* Every sample is priced at its own instant, so a peak window boundary inside a
* day prices the samples on each side correctly instead of averaging them.
*
* @module dsh-local-usage/aggregate
*/
/** Route label used when the log attributes a settlement to no `provider/model`. */
const UNKNOWN_ROUTE = "unknown";
/**
* Local calendar day of one instant, as `YYYY-MM-DD`.
* @param time - Unix epoch milliseconds.
* @returns the host-local day key the calendar heatmap buckets on.
*/
function localDayKey(time) {
	const date = new Date(time);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${String(date.getFullYear())}-${month}-${day}`;
}
/**
* Local midnight of one day key, or `undefined` when the key is malformed.
*
* Exported because the durable fold cache dates a stored day the same way this
* fold does; a second parser that disagreed by a timezone would silently shift
* the retention horizon it is used for.
*
* @param day - a `YYYY-MM-DD` day key.
* @returns Unix epoch milliseconds of that local day's midnight.
*/
function dayKeyToTime(day) {
	const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
	if (matched === null) return void 0;
	const time = new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])).getTime();
	return Number.isFinite(time) ? time : void 0;
}
/**
* Extract one sample per billed usage settlement.
*
* The fold mirrors the harness's own `tokenUsage` projection, which is what
* makes its totals comparable with the persisted projection: a settlement
* replaces the earlier sample of the same `(turn, step)` slot, `llm/retry-started`
* closes that slot so a retried attempt is billed separately, and an identical
* repeat changes nothing. Unlike the projection this fold also keeps each
* settlement's own instant and billed route, which is what a calendar and a
* per-model price need.
*
* The route comes from the settling assistant message's own `source`, falling
* back to the newest `request/header` when a message carries none — an attempt
* that committed no surface message has no source of its own.
*
* @param events - one session's durable log, in seq order.
* @returns one sample per billable settlement, ascending by time.
*/
function samplesOf(events) {
	const samples = [];
	let route = UNKNOWN_ROUTE;
	let last;
	for (const event of events) {
		if (event.type === "request/header") {
			const { provider, model } = event.data.header.config;
			if (provider.length > 0 && model.length > 0) route = `${provider}/${model}`;
			continue;
		}
		if (event.type === "llm/retry-started") {
			if (last !== void 0 && last.turn === event.data.turn && last.step === event.data.step) last = void 0;
			continue;
		}
		if (event.type !== "assistant/message" && event.type !== "assistant/attempt") continue;
		const usage = usageOf(event);
		if (usage === void 0) continue;
		const tokens = {
			uncachedInputTokens: usage.inputTokens,
			outputTokens: usage.outputTokens,
			cacheReadTokens: usage.cacheReadTokens ?? 0,
			cacheWriteTokens: usage.cacheWriteTokens ?? 0
		};
		const { turn, step } = event.data;
		const settledRoute = event.type === "assistant/message" ? sourceRoute(event) ?? route : route;
		const slot = last !== void 0 && last.turn === turn && last.step === step ? last : void 0;
		const previous = slot === void 0 ? void 0 : samples[slot.index];
		if (previous !== void 0 && sameTokens(previous.tokens, tokens)) continue;
		if (slot === void 0) {
			samples.push({
				time: event.time,
				route: settledRoute,
				tokens
			});
			last = {
				turn,
				step,
				index: samples.length - 1
			};
		} else {
			samples[slot.index] = {
				time: event.time,
				route: settledRoute,
				tokens
			};
			last = {
				turn,
				step,
				index: slot.index
			};
		}
	}
	return samples;
}
/** The usage one settlement reports, from its own field or its embedded stream. */
function usageOf(event) {
	if (event.type === "assistant/message" && event.data.usage !== void 0) return event.data.usage;
	return lastAssistantStreamChunk(event.data.stream, "usage")?.usage;
}
/** The route a settling assistant message was produced by, when it names one. */
function sourceRoute(event) {
	const source = event.data.message.source;
	if (source === void 0) return void 0;
	const { provider, model } = source;
	if (typeof provider !== "string" || typeof model !== "string") return void 0;
	return provider.length > 0 && model.length > 0 ? `${provider}/${model}` : void 0;
}
/** Whether two bucket sets are identical, so a repeat settlement is a no-op. */
function sameTokens(left, right) {
	return left.uncachedInputTokens === right.uncachedInputTokens && left.outputTokens === right.outputTokens && left.cacheReadTokens === right.cacheReadTokens && left.cacheWriteTokens === right.cacheWriteTokens;
}
/**
* Fold one session's reliability counters, one bucket per local day.
*
* Every figure is a count of a durable event, never an inference from content:
* `llm/retry` for an attempt the provider had to be asked for again,
* `tool/result` carrying an `error` for a tool that failed,
* `compaction/start` and a `compaction/end` carrying an `error` for context that
* could not be compacted. An unknown failure shape still counts — it lands under
* the code its producer issued, or under `UNKNOWN_CAUSE` when it issued none.
*
* @param events - one session's durable log, in seq order.
* @returns one bucket per day that recorded a signal, ascending by day.
*/
function reliabilityOf(events) {
	const byDay = /* @__PURE__ */ new Map();
	const dayOf = (time) => {
		const day = localDayKey(time);
		let bucket = byDay.get(day);
		if (bucket === void 0) {
			bucket = {
				day,
				retries: 0,
				retryCauses: /* @__PURE__ */ new Map(),
				toolCalls: 0,
				toolErrors: 0,
				toolErrorCodes: /* @__PURE__ */ new Map(),
				compactions: 0,
				compactionFailures: 0
			};
			byDay.set(day, bucket);
		}
		return bucket;
	};
	const bump = (counts, code) => {
		counts.set(code, (counts.get(code) ?? 0) + 1);
	};
	for (const event of events) switch (event.type) {
		case "llm/retry": {
			const bucket = dayOf(event.time);
			bucket.retries += 1;
			bump(bucket.retryCauses, failureCode(event.data.failure));
			break;
		}
		case "tool/call":
			dayOf(event.time).toolCalls += 1;
			break;
		case "tool/result": {
			const error = event.data.error;
			if (error === void 0 || error === null) break;
			const bucket = dayOf(event.time);
			bucket.toolErrors += 1;
			bump(bucket.toolErrorCodes, errorCode(error));
			break;
		}
		case "compaction/start":
			dayOf(event.time).compactions += 1;
			break;
		case "compaction/end":
			if (event.data.error === void 0 || event.data.error === null) break;
			dayOf(event.time).compactionFailures += 1;
	}
	return [...byDay.values()].sort((left, right) => (dayKeyToTime(left.day) ?? 0) - (dayKeyToTime(right.day) ?? 0));
}
/** Code a retry failure carries; a shape we cannot read still gets counted. */
function failureCode(failure) {
	const code = failure?.code;
	return typeof code === "string" && code.length > 0 ? code : UNKNOWN_CAUSE;
}
/** Code a tool error carries, from either of the two shapes a result may use. */
function errorCode(error) {
	const code = error?.code;
	if (typeof code === "string" && code.length > 0) return code;
	const name = error?.name;
	return typeof name === "string" && name.length > 0 ? name : UNKNOWN_CAUSE;
}
/** Code used for a signal whose producer issued none. */
const UNKNOWN_CAUSE = "UNKNOWN";
/**
* The days of a fold that one request's window keeps.
*
* A day is kept when its local midnight lies inside the window, which makes the
* cut exact for the day-bounded windows the panel asks for and deliberately
* coarse — never silently partial — for any other.
*
* @param days - one session's reliability fold.
* @param from - inclusive lower bound, or `undefined` for unbounded.
* @param to - inclusive upper bound, or `undefined` for unbounded.
* @returns the days inside the window.
*/
function reliabilityWithin(days, from, to) {
	if (from === void 0 && to === void 0) return [...days];
	return days.filter((day) => {
		const start = dayKeyToTime(day.day);
		if (start === void 0) return false;
		return (from === void 0 || start >= from) && (to === void 0 || start <= to);
	});
}
/** Merge one window's reliability folds into the report's single statement. */
function reliabilityOfWindow(inputs) {
	const retryCauses = /* @__PURE__ */ new Map();
	const toolErrorCodes = /* @__PURE__ */ new Map();
	let retries = 0;
	let toolCalls = 0;
	let toolErrors = 0;
	let compactions = 0;
	let compactionFailures = 0;
	for (const input of inputs) for (const day of input.reliability ?? []) {
		retries += day.retries;
		toolCalls += day.toolCalls;
		toolErrors += day.toolErrors;
		compactions += day.compactions;
		compactionFailures += day.compactionFailures;
		for (const [code, count] of day.retryCauses) retryCauses.set(code, (retryCauses.get(code) ?? 0) + count);
		for (const [code, count] of day.toolErrorCodes) toolErrorCodes.set(code, (toolErrorCodes.get(code) ?? 0) + count);
	}
	return {
		retries,
		retryCauses: signalRows(retryCauses),
		toolCalls,
		toolErrors,
		toolErrorCodes: signalRows(toolErrorCodes),
		compactions,
		compactionFailures
	};
}
/** Grouped counts as rows, largest first, ties broken by code so the order is stable. */
function signalRows(counts) {
	return [...counts.entries()].map(([code, count]) => ({
		code,
		count
	})).sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
}
function emptyBucket() {
	return {
		uncachedInputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		cost: 0,
		calls: 0,
		sessions: /* @__PURE__ */ new Set()
	};
}
function addSample(bucket, tokens, cost, sessionId) {
	bucket.uncachedInputTokens += tokens.uncachedInputTokens;
	bucket.outputTokens += tokens.outputTokens;
	bucket.cacheReadTokens += tokens.cacheReadTokens;
	bucket.cacheWriteTokens += tokens.cacheWriteTokens;
	bucket.cost += cost;
	bucket.calls += 1;
	bucket.sessions.add(sessionId);
}
/** Render minutes-after-midnight back as `HH:MM` for the wire. */
function clock(minutes) {
	const hours = Math.floor(minutes / 60);
	return `${String(hours).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
/** Total tokens of one accumulator, for ordering a token-volume ranking. */
function bucketTokens(bucket) {
	return bucket.uncachedInputTokens + bucket.outputTokens + bucket.cacheReadTokens + bucket.cacheWriteTokens;
}
/** Costed fields without the internal session set. */
function costedOf(bucket) {
	return {
		uncachedInputTokens: bucket.uncachedInputTokens,
		outputTokens: bucket.outputTokens,
		cacheReadTokens: bucket.cacheReadTokens,
		cacheWriteTokens: bucket.cacheWriteTokens,
		cost: bucket.cost,
		calls: bucket.calls
	};
}
/**
* Fold every session's samples into one priced report.
* The window is whatever the caller asked for, and every dimension is folded
* over that same window, so narrowing it to one day yields that day's totals,
* that day's routes and that day's projects from the samples the Host already
* holds. That is what makes a day drill-down a re-fold rather than a re-read.
*
* @param inputs - per-session inputs, in any order.
* @param options - rate card and peak schedule.
* @param meta - host-supplied report facts.
* @returns the complete report, day rows ascending and ranking rows by cost.
*/
/** Minutes in each slice of the day the figure's day view is drawn from. */
const SLICE_MINUTES = 10;
/** Slices in a day: `1440 / SLICE_MINUTES`. */
const SLICES_PER_DAY = 144;
function buildReport(inputs, options, meta) {
	const totals = emptyBucket();
	const byDay = /* @__PURE__ */ new Map();
	const byRoute = /* @__PURE__ */ new Map();
	const byProject = /* @__PURE__ */ new Map();
	const sessionRows = [];
	const unpricedRoutes = /* @__PURE__ */ new Set();
	let unpricedTokens = 0;
	const slices = Array.from({ length: SLICES_PER_DAY }, () => ({
		cost: 0,
		calls: 0,
		tokens: 0
	}));
	for (const input of inputs) {
		const sessionBucket = emptyBucket();
		const project = input.cwd ?? "unknown";
		let firstSampleTime;
		let lastSampleTime;
		for (const sample of input.samples) {
			const beijing = beijingClock(sample.time);
			const peak = isPeakClock(beijing, options.peakWindows, options.peakWeekdaysOnly);
			const { rate, matched } = selectRate(options.models, options.fallback, sample.route, peak);
			const cost = costOf(sample.tokens, rate);
			firstSampleTime ??= sample.time;
			lastSampleTime = sample.time;
			const readTokens = sample.tokens.cacheReadTokens;
			const slice = slices[Math.floor(beijing.minutes / SLICE_MINUTES)];
			if (slice !== void 0) {
				slice.cost += cost;
				slice.calls += 1;
				slice.tokens += sample.tokens.uncachedInputTokens + sample.tokens.outputTokens + readTokens + sample.tokens.cacheWriteTokens;
			}
			const day = localDayKey(sample.time);
			let dayBucket = byDay.get(day);
			if (dayBucket === void 0) {
				dayBucket = emptyBucket();
				byDay.set(day, dayBucket);
			}
			let routeBucket = byRoute.get(sample.route);
			if (routeBucket === void 0) {
				routeBucket = {
					...emptyBucket(),
					priced: matched
				};
				byRoute.set(sample.route, routeBucket);
			}
			let projectBucket = byProject.get(project);
			if (projectBucket === void 0) {
				projectBucket = emptyBucket();
				byProject.set(project, projectBucket);
			}
			addSample(dayBucket, sample.tokens, cost, input.sessionId);
			addSample(routeBucket, sample.tokens, cost, input.sessionId);
			addSample(projectBucket, sample.tokens, cost, input.sessionId);
			addSample(sessionBucket, sample.tokens, cost, input.sessionId);
			addSample(totals, sample.tokens, cost, input.sessionId);
			if (!matched) {
				unpricedRoutes.add(sample.route);
				unpricedTokens += sample.tokens.uncachedInputTokens + sample.tokens.outputTokens + sample.tokens.cacheReadTokens + sample.tokens.cacheWriteTokens;
			}
		}
		if (input.samples.length > 0) sessionRows.push({
			sessionId: input.sessionId,
			...input.title === void 0 ? {} : { title: input.title },
			...input.cwd === void 0 ? {} : { cwd: input.cwd },
			createdAt: input.createdAt,
			updatedAt: lastSampleTime ?? firstSampleTime ?? input.createdAt,
			...costedOf(sessionBucket)
		});
	}
	const days = [...byDay.entries()].map(([day, bucket]) => ({
		day,
		...costedOf(bucket),
		sessions: bucket.sessions.size
	})).sort((left, right) => (dayKeyToTime(left.day) ?? 0) - (dayKeyToTime(right.day) ?? 0));
	const models = [...byRoute.entries()].map(([route, bucket]) => ({
		route,
		priced: bucket.priced,
		...costedOf(bucket)
	})).sort((left, right) => right.cost - left.cost || right.outputTokens - left.outputTokens);
	const routeRates = [...byRoute.entries()].map(([route, bucket]) => {
		const match = matchModel(options.models, options.fallback, route);
		return {
			route,
			...match.source === "fallback" ? {} : { model: match.card.match },
			peakEnabled: match.card.peakEnabled,
			peak: match.card.peak,
			offPeak: match.card.offPeak,
			source: match.source,
			tokens: bucketTokens(bucket)
		};
	}).sort((left, right) => right.tokens - left.tokens || left.route.localeCompare(right.route));
	const projects = [...byProject.entries()].map(([path, bucket]) => ({
		path,
		...costedOf(bucket),
		sessions: bucket.sessions.size
	})).sort((left, right) => right.cost - left.cost || right.outputTokens - left.outputTokens);
	sessionRows.sort((left, right) => right.cost - left.cost || right.updatedAt - left.updatedAt);
	return {
		generatedAt: meta.generatedAt,
		currency: options.currency,
		totals: {
			...costedOf(totals),
			sessions: totals.sessions.size
		},
		days,
		models,
		projects,
		sessions: sessionRows,
		scannedSessions: inputs.length,
		unreadableSessions: meta.unreadableSessions,
		reliability: reliabilityOfWindow(inputs),
		unpricedRoutes: [...unpricedRoutes].sort(),
		unpricedTokens,
		cached: meta.cached,
		prices: options.models,
		fallbackPrice: options.fallback,
		routeRates,
		peakWindows: options.peakWindows.map((window) => `${clock(window.start)}-${clock(window.end)}`),
		peakWeekdaysOnly: options.peakWeekdaysOnly,
		slices: slices.map((bucket, index) => ({
			minutes: index * SLICE_MINUTES,
			cost: bucket.cost,
			calls: bucket.calls,
			tokens: bucket.tokens
		}))
	};
}
//#endregion
//#region src/fold-cache.ts
/**
* Durable per-session fold cache.
*
* Reading a log is the expensive half of this plugin and folding it is not, so
* the in-memory session cache exists to pay that cost once. It did not survive a
* restart, which meant every fresh Host process re-decoded the whole corpus
* before the panel could draw its first cell.
*
* What makes the fold cacheable at all is the persistence backend's own change
* token: `SessionPersistenceSnapshot.revision` identifies one revision of one
* stored log, and the JSONL backend builds it from the artifact's device, inode,
* size and nanosecond timestamps. A stored fold whose revision still matches is
* therefore a fold of exactly the bytes on disk — no re-read, no guessing.
*
* A revision that no longer matches, or a session the backend does not list, is
* simply a miss: the fold is recomputed and the entry replaced. Nothing here can
* make a figure wrong; the worst a stale or damaged file can do is cost the cold
* read it was written to avoid.
*
* The file lives beside the pricing overrides under the harness home, is written
* through a temporary sibling and a rename, and is dropped whole when its
* document version does not match — a bump has to bring a migration with it, the
* way every other stored shape in this product does.
*
* @module dsh-local-usage/fold-cache
*/
/**
* Version of the on-disk document, bumped when its shape *or* the fold's meaning
* changes: an entry is only reused when the code that wrote it folded the same
* way this build does.
*/
const DOCUMENT_VERSION$1 = 1;
const MS_PER_DAY = 864e5;
/**
* Where one harness home keeps this plugin's fold cache.
* @param dshHome - absolute harness home.
* @returns the absolute path of the file.
*/
function foldCacheFilePath(dshHome) {
	return join(dshHome, "local-usage", "fold-cache.json");
}
/** Serialize one reliability day: its two count maps become plain records. */
function storedDay(day) {
	return {
		day: day.day,
		retries: day.retries,
		retryCauses: Object.fromEntries(day.retryCauses),
		toolCalls: day.toolCalls,
		toolErrors: day.toolErrors,
		toolErrorCodes: Object.fromEntries(day.toolErrorCodes),
		compactions: day.compactions,
		compactionFailures: day.compactionFailures
	};
}
/** Read one non-negative finite count out of an untrusted value. */
function readCount(value) {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : void 0;
}
/** Read one `code -> count` map, dropping entries that are not counts. */
function readCounts(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const counts = /* @__PURE__ */ new Map();
	for (const [code, candidate] of Object.entries(value)) {
		const count = readCount(candidate);
		if (code.length > 0 && count !== void 0) counts.set(code, count);
	}
	return counts;
}
/** Read one sample out of an untrusted document. */
function readSample(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const source = value;
	const time = readCount(source.time);
	const route = source.route;
	if (time === void 0 || typeof route !== "string") return void 0;
	const raw = source.tokens;
	if (typeof raw !== "object" || raw === null) return void 0;
	const bucket = raw;
	const uncachedInputTokens = readCount(bucket.uncachedInputTokens);
	const outputTokens = readCount(bucket.outputTokens);
	const cacheReadTokens = readCount(bucket.cacheReadTokens);
	const cacheWriteTokens = readCount(bucket.cacheWriteTokens);
	if (uncachedInputTokens === void 0 || outputTokens === void 0 || cacheReadTokens === void 0 || cacheWriteTokens === void 0) return void 0;
	return {
		time,
		route,
		tokens: {
			uncachedInputTokens,
			outputTokens,
			cacheReadTokens,
			cacheWriteTokens
		}
	};
}
/** Read one reliability day out of an untrusted document. */
function readDay(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const source = value;
	const day = source.day;
	if (typeof day !== "string" || dayKeyToTime(day) === void 0) return void 0;
	const retries = readCount(source.retries);
	const toolCalls = readCount(source.toolCalls);
	const toolErrors = readCount(source.toolErrors);
	const compactions = readCount(source.compactions);
	const compactionFailures = readCount(source.compactionFailures);
	const retryCauses = readCounts(source.retryCauses);
	const toolErrorCodes = readCounts(source.toolErrorCodes);
	if (retries === void 0 || toolCalls === void 0 || toolErrors === void 0 || compactions === void 0 || compactionFailures === void 0 || retryCauses === void 0 || toolErrorCodes === void 0) return void 0;
	return {
		day,
		retries,
		retryCauses,
		toolCalls,
		toolErrors,
		toolErrorCodes,
		compactions,
		compactionFailures
	};
}
/** Read one stored session out of an untrusted document. */
function readStored(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const source = value;
	const revision = source.revision;
	const createdAt = readCount(source.createdAt);
	if (typeof revision !== "string" || revision.length === 0 || createdAt === void 0) return void 0;
	if (!Array.isArray(source.samples) || !Array.isArray(source.reliability)) return void 0;
	const samples = [];
	for (const candidate of source.samples) {
		const sample = readSample(candidate);
		if (sample === void 0) return void 0;
		samples.push(sample);
	}
	const reliability = [];
	for (const candidate of source.reliability) {
		const day = readDay(candidate);
		if (day === void 0) return void 0;
		reliability.push(day);
	}
	const title = source.title;
	const cwd = source.cwd;
	return {
		revision,
		createdAt,
		samples,
		reliability,
		...typeof title === "string" && title.length > 0 ? { title } : {},
		...typeof cwd === "string" && cwd.length > 0 ? { cwd } : {}
	};
}
/**
* The newest instant an entry proves it has no data after.
*
* Samples carry their own instant; a reliability day is known to end at its
* local midnight plus a day. An entry that recorded neither is undatable — an
* empty session can be any age — so it reports `undefined` and is never pruned:
* it is a couple of hundred bytes and it is exactly the entry that saves a read.
*
* @param entry - one stored session.
* @returns the last covered instant, or `undefined` when the entry is undatable.
*/
function lastActivity(entry) {
	let last;
	for (const sample of entry.samples) last = last === void 0 ? sample.time : Math.max(last, sample.time);
	for (const day of entry.reliability) {
		const start = dayKeyToTime(day.day);
		if (start === void 0) continue;
		const end = start + MS_PER_DAY;
		last = last === void 0 ? end : Math.max(last, end);
	}
	return last;
}
/**
* Create the cache for one file, hydrating it from disk immediately.
*
* Hydration is synchronous for the same reason the rate store's is: it runs once
* at activation, off the request path, and everything after it is a map lookup.
* A read that fails is not an error this plugin can act on — an absent, damaged
* or future-versioned file is simply an empty cache, and the next flush replaces
* it.
*
* @param path - absolute path of the cache file.
* @returns the cache.
*/
function createFoldCache(path) {
	const entries = /* @__PURE__ */ new Map();
	let prunedBefore = 0;
	let dirty = false;
	let queue = Promise.resolve();
	const flushNow = async (now) => {
		if (!dirty) return;
		const horizon = now - 400 * MS_PER_DAY;
		if (prunedBefore < horizon) prunedBefore = horizon;
		for (const [sessionId, entry] of entries) {
			const last = lastActivity(entry);
			if (last !== void 0 && last < horizon) entries.delete(sessionId);
		}
		const sessions = {};
		for (const [sessionId, entry] of entries) sessions[sessionId] = {
			revision: entry.revision,
			createdAt: entry.createdAt,
			...entry.title === void 0 ? {} : { title: entry.title },
			...entry.cwd === void 0 ? {} : { cwd: entry.cwd },
			samples: entry.samples,
			reliability: entry.reliability.map(storedDay)
		};
		const document = `${JSON.stringify({
			version: DOCUMENT_VERSION$1,
			prunedBefore,
			sessions
		})}\n`;
		dirty = false;
		await mkdir(dirname(path), { recursive: true });
		const temporary = `${path}.${String(process.pid)}.tmp`;
		await writeFile(temporary, document, "utf8");
		await rename(temporary, path);
	};
	try {
		const document = JSON.parse(readFileSync(path, "utf8"));
		if (document.version === DOCUMENT_VERSION$1 && typeof document.sessions === "object" && document.sessions !== null) {
			for (const [sessionId, candidate] of Object.entries(document.sessions)) {
				const stored = readStored(candidate);
				if (sessionId.length > 0 && stored !== void 0) entries.set(sessionId, stored);
			}
			prunedBefore = readCount(document.prunedBefore) ?? 0;
		}
	} catch {}
	return {
		read: (sessionId, revision, from) => {
			if (from !== void 0 && from < prunedBefore) return void 0;
			const entry = entries.get(sessionId);
			if (entry === void 0 || entry.revision !== revision) return void 0;
			return entry;
		},
		write: (sessionId, revision, fold) => {
			entries.set(sessionId, {
				revision,
				createdAt: fold.createdAt,
				samples: fold.samples,
				reliability: fold.reliability,
				...fold.title === void 0 ? {} : { title: fold.title },
				...fold.cwd === void 0 ? {} : { cwd: fold.cwd }
			});
			dirty = true;
		},
		flush: (now = Date.now()) => {
			const run = queue.then(() => flushNow(now));
			queue = run.catch(() => {});
			return run;
		}
	};
}
//#endregion
//#region src/progress.ts
/**
* Create one tracker, initially idle.
* @param clock - the instant source, injectable so a test can pin the timestamps.
* @returns the tracker.
*/
function createProgressTracker(clock = Date.now) {
	let state = {
		phase: "idle",
		done: 0,
		total: 0,
		startedAt: 0
	};
	return {
		read: () => state,
		begin: () => {
			state = {
				phase: "listing",
				done: 0,
				total: 0,
				startedAt: clock()
			};
		},
		plan: (total) => {
			state = {
				phase: "reading",
				done: 0,
				total,
				startedAt: state.startedAt
			};
		},
		pricing: () => {
			state = {
				phase: "pricing",
				done: state.done,
				total: state.total,
				startedAt: state.startedAt
			};
		},
		advance: () => {
			state = {
				...state,
				done: state.done + 1
			};
		},
		finish: () => {
			state = {
				phase: "idle",
				done: state.done,
				total: state.total,
				startedAt: state.startedAt,
				finishedAt: clock()
			};
		}
	};
}
//#endregion
//#region src/rates.ts
/**
* Durable price edits, kept per model.
*
* The cards a profile is configured with match a model's name as a substring of
* the route: convenient, and quietly wrong the moment a route they were never
* written for happens to contain that name. An edit is the correction — one
* model, two complete sets of prices, and a switch saying whether the peak set
* applies — and this module owns where it lives.
*
* Edits are keyed by model rather than by route, which is what makes one edit
* reach every vendor route of the same model. Consumption is not stored here and
* is not affected by an edit: the fold still reports each route separately.
*
* It is a small JSON file under the harness home rather than a storage form: this
* plugin mounts bare on deployments that have no storage backend, and a price
* table the reader typed is worth persisting without making the whole panel
* depend on a service that may not be there. The file is written through a
* temporary sibling and renamed, so a crash mid-write cannot leave a truncated
* table behind.
*
* @module dsh-local-usage/rates
*/
/** Version of the on-disk document, bumped when its shape changes. */
const DOCUMENT_VERSION = 2;
/**
* The version this one migrates from: a table of per-route overrides.
*
* Those rows stored one set of prices each, and the peak prices were derived from
* a multiplier that lived in configuration rather than in the file. The migration
* therefore has to pick the multiplier the rows were most likely billed at; the
* shipped default is two, and a row migrated at two keeps the money it was
* showing.
*/
const LEGACY_DOCUMENT_VERSION = 1;
/** The peak multiplier the legacy rows were billed at. */
const LEGACY_PEAK_MULTIPLIER = 2;
/** Highest price this plugin accepts, per million tokens, in any currency. */
const MAX_RATE = 1e6;
/** Every bucket price, in the order the panel writes them. */
const BUCKETS = [
	"input",
	"cacheRead",
	"cacheWrite",
	"output"
];
/**
* The harness home the price file is written under.
* @param env - process environment, read for `DSH_HOME`.
* @param home - the user's home directory when `DSH_HOME` is unset.
* @returns the absolute harness home.
*/
function resolveDshHome(env = process.env, home = homedir()) {
	const configured = env.DSH_HOME?.trim();
	return configured !== void 0 && configured.length > 0 ? configured : join(home, ".dsh");
}
/**
* Where one harness home keeps this plugin's price file.
* @param dshHome - absolute harness home.
* @returns the absolute path of the file.
*/
function pricingFilePath(dshHome) {
	return join(dshHome, "local-usage", "pricing.json");
}
/**
* Read one set of prices out of an untrusted value.
* @param value - a candidate bucket map.
* @returns the prices, or `undefined` when any bucket is not a sane non-negative price.
*/
function readRate(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const source = value;
	const rate = {};
	for (const bucket of BUCKETS) {
		const raw = source[bucket];
		if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > MAX_RATE) return void 0;
		rate[bucket] = raw;
	}
	return rate;
}
/**
* Read one model edit out of an untrusted value.
* @param value - a candidate edit.
* @returns the edit, or `undefined` when either set of prices is not sane.
*/
function readModelEdit(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const source = value;
	if (typeof source.peakEnabled !== "boolean") return void 0;
	const peak = readRate(source.peak);
	const offPeak = readRate(source.offPeak);
	if (peak === void 0 || offPeak === void 0) return void 0;
	return {
		peakEnabled: source.peakEnabled,
		peak,
		offPeak
	};
}
/** Read one model map out of an untrusted document, dropping entries it cannot vouch for. */
function readModelEdits(value) {
	const edits = /* @__PURE__ */ new Map();
	if (typeof value !== "object" || value === null) return edits;
	for (const [match, candidate] of Object.entries(value)) {
		const edit = readModelEdit(candidate);
		if (edit !== void 0) edits.set(match, edit);
	}
	return edits;
}
/**
* Migrate a table of per-route overrides into model cards.
*
* Each row is keyed by the full route it was written for, and its peak set is the
* row's own prices at the legacy multiplier. Keying by the route means the
* migration never has to guess which part of `vendor/cn:model` is the model — the
* card simply claims the route it was written for, exactly as narrowly as the
* reader wrote it.
*
* @param value - the legacy `routes` map.
* @returns one card per migrated route.
*/
function migrateRoutes(value) {
	const edits = /* @__PURE__ */ new Map();
	if (typeof value !== "object" || value === null) return edits;
	for (const [route, candidate] of Object.entries(value)) {
		const rate = readRate(candidate);
		if (route.length === 0 || rate === void 0) continue;
		edits.set(route, {
			peakEnabled: true,
			peak: {
				input: rate.input * LEGACY_PEAK_MULTIPLIER,
				cacheRead: rate.cacheRead * LEGACY_PEAK_MULTIPLIER,
				cacheWrite: rate.cacheWrite * LEGACY_PEAK_MULTIPLIER,
				output: rate.output * LEGACY_PEAK_MULTIPLIER
			},
			offPeak: rate
		});
	}
	return edits;
}
/**
* Create the store for one file, hydrating it from disk immediately.
*
* Hydration is synchronous on purpose: the report path is the hot one, this runs
* once at activation, and the document is a handful of lines. A read that fails
* is not an error the plugin can act on — an absent or unreadable table is simply
* no edits, and the next write replaces the file.
*
* @param path - absolute path of the price file.
* @returns the store.
*/
function createRateStore(path) {
	const models = /* @__PURE__ */ new Map();
	try {
		const document = JSON.parse(readFileSync(path, "utf8"));
		if (document.version === DOCUMENT_VERSION) for (const [match, edit] of readModelEdits(document.models)) models.set(match, edit);
		else if (document.version === LEGACY_DOCUMENT_VERSION) for (const [route, edit] of migrateRoutes(document.routes)) models.set(route, edit);
	} catch {}
	const snapshot = () => Object.fromEntries(models);
	return {
		read: () => models,
		write: async (update) => {
			for (const [match, edit] of Object.entries(update.models)) if (edit === null) models.delete(match);
			else models.set(match, edit);
			const document = `${JSON.stringify({
				version: DOCUMENT_VERSION,
				models: snapshot()
			}, null, 2)}\n`;
			await mkdir(dirname(path), { recursive: true });
			const temporary = `${path}.${String(process.pid)}.tmp`;
			await writeFile(temporary, document, "utf8");
			await rename(temporary, path);
			return snapshot();
		}
	};
}
//#endregion
//#region src/index.ts
/** Exact route the browser half calls; it sits behind the carrier's trust fence. */
const REPORT_PATH = "/api/dsh-local-usage/report";
/** Exact route the browser half writes the per-route rate table to. */
const PRICING_PATH = "/api/dsh-local-usage/pricing";
/**
* Exact route the browser half polls while a report is being assembled.
*
* A separate route rather than a streamed report: the report is one JSON
* document the browser parses whole, and a carrier that buffered a streamed body
* would lose exactly the progress it was streaming.
*/
const PROGRESS_PATH = "/api/dsh-local-usage/progress";
/**
* Session logs folded concurrently by the exact-read path.
*
* Only the sessions that cannot take the batch projection come through here, so
* this bounds an exceptional path rather than the common one. Raising it would
* not help anyway: decoding and parsing a log are synchronous, and the fold that
* consumes them is already the smaller half of the cost.
*/
const READ_CONCURRENCY = 4;
/** Plugin name the loader row addresses. */
const name = "dsh-local-usage";
/** Services this plugin cannot work without: the carrier's route registry and the session reads. */
const inject = ["connection", "sessionQuery"];
/** The published off-peak DeepSeek-V4.1-Flash card, in CNY per one million tokens. */
const FLASH_RATE = {
	input: 1,
	cacheRead: .02,
	cacheWrite: 1,
	output: 4
};
/** The same model inside its peak windows; stated, not derived from the off-peak card. */
const FLASH_PEAK = {
	input: 2,
	cacheRead: .04,
	cacheWrite: 2,
	output: 8
};
/**
* Shipped defaults: DeepSeek's published off-peak CNY prices. A route served
* through an aggregator or a reseller has to be priced by the operator, and the
* panel names every route that fell back to the default rather than implying a
* figure it cannot support.
*/
const DEFAULT_CONFIG = {
	currency: "CNY",
	models: [{
		match: "v4-pro",
		input: 4.5,
		cacheRead: .15,
		cacheWrite: 4.5,
		output: 13.5,
		peak: {
			input: 9,
			cacheRead: .3,
			cacheWrite: 9,
			output: 27
		}
	}, {
		match: "flash",
		...FLASH_RATE,
		peak: FLASH_PEAK
	}],
	fallback: {
		...FLASH_RATE,
		peak: FLASH_PEAK
	},
	peakWindows: ["09:00-12:00", "14:00-18:00"],
	peakWeekdaysOnly: true,
	warmup: true,
	warmupDelayMs: 4e3
};
/**
* Fold one session's raw log into the shape the cache keeps.
*
* Deliberately pure and shared by both read paths, so the batch projection and
* the exact read cannot drift apart in what they count.
*
* @param source - the log, its header facts, and the prefix to skip.
* @returns the samples plus the identity facts the report repeats.
*/
function foldSession(source) {
	const own = source.events.filter((event) => event.seq >= source.skipBefore);
	const samples = samplesOf(own);
	const reliability = reliabilityOf(own);
	const title = foldSessionTitle(source.events)?.title;
	return {
		samples,
		reliability,
		createdAt: source.createdAt,
		...title === void 0 || title.length === 0 ? {} : { title },
		...source.cwd === void 0 ? {} : { cwd: source.cwd }
	};
}
/** The reports row a fold contributes to one request's window. */
function sessionInputOf(sessionId, entry, request) {
	return {
		sessionId,
		createdAt: entry.createdAt,
		samples: withinRange(entry.samples, request.from, request.to),
		reliability: reliabilityWithin(entry.reliability, request.from, request.to),
		...titleFields(entry)
	};
}
/**
* Read the engine's batch projection, when the mounted build has one.
*
* Read reflectively rather than called straight through: a harness whose engine
* predates the projection would otherwise throw here and take the whole route
* with it. Declared structurally, like {@link UsageInsightsConnection}, so this
* package carries no dependency on the module that provides the service.
*
* The win is not concurrency, which the fold does not use: it is that this path
* hands the fold the log as the reader already holds it, while the exact read
* deep-clones every event — including the message bodies and tool results the
* fold never looks at — and replay-validates the log by building a Session from
* it. On a real corpus that clone is about a third of the whole cold read.
*
* @param engine - the mounted session query engine.
* @returns the bound projection, or `undefined` when this build has none.
*/
function batchProjectionOf(engine) {
	const candidate = Reflect.get(engine, "projectMany");
	return typeof candidate === "function" ? candidate.bind(engine) : void 0;
}
/** Merge a caller's configuration over the shipped defaults. */
function resolveConfig(config) {
	return {
		currency: config.currency ?? DEFAULT_CONFIG.currency,
		models: config.models ?? DEFAULT_CONFIG.models,
		fallback: config.fallback ?? DEFAULT_CONFIG.fallback,
		peakWindows: config.peakWindows ?? DEFAULT_CONFIG.peakWindows,
		peakWeekdaysOnly: config.peakWeekdaysOnly ?? DEFAULT_CONFIG.peakWeekdaysOnly,
		warmup: config.warmup ?? DEFAULT_CONFIG.warmup,
		warmupDelayMs: config.warmupDelayMs ?? DEFAULT_CONFIG.warmupDelayMs
	};
}
/** Run one async mapper over items with a fixed number of workers. */
async function mapBounded(items, limit, map) {
	const results = [];
	let cursor = 0;
	const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
		while (cursor < items.length) {
			const index = cursor;
			cursor += 1;
			results[index] = await map(items[index]);
		}
	});
	await Promise.all(workers);
	return results;
}
/** Keep only the samples inside the requested window. */
function withinRange(samples, from, to) {
	if (from === void 0 && to === void 0) return samples;
	return samples.filter((sample) => (from === void 0 || sample.time >= from) && (to === void 0 || sample.time <= to));
}
/** Optional title/cwd carried onto a report row. */
function titleFields(entry) {
	return {
		...entry.title === void 0 ? {} : { title: entry.title },
		...entry.cwd === void 0 ? {} : { cwd: entry.cwd }
	};
}
/** Parse one optional finite query parameter. */
function numberParam(params, key) {
	const raw = params.get(key);
	if (raw === null) return void 0;
	const value = Number(raw);
	return Number.isFinite(value) ? value : void 0;
}
/**
* The change token of every stored log, or an empty map when none can be had.
*
* A backend that is absent, or a listing that fails, costs this plugin the
* durable cache and nothing else: every session then takes the read path it took
* before that cache existed, and the report is still complete.
*
* @param ctx - host context, read for the optional persistence service.
* @returns session id to stored-log revision.
*/
async function storedRevisions(ctx) {
	try {
		const persistence = ctx.get("sessionPersistence");
		if (persistence === void 0 || typeof persistence.list !== "function") return /* @__PURE__ */ new Map();
		const snapshots = await persistence.list();
		const revisions = /* @__PURE__ */ new Map();
		for (const snapshot of snapshots) revisions.set(String(snapshot.header.id), snapshot.revision);
		return revisions;
	} catch (error) {
		ctx.logger.warn(`dsh-local-usage: stored-log listing failed: ${describe(error)}`);
		return /* @__PURE__ */ new Map();
	}
}
/**
* Build the priced report over every readable session log.
*
* Two read paths, one fold. Sessions whose log carries no inherited prefix go
* through the engine's batch projection, which hands the fold the events as the
* reader already holds them. Everything else — a seeded log, whose prefix length
* only the exact read reports, and every session when the mounted engine has no
* batch projection at all — takes the per-session read.
*
* A session neither path has to touch is the point of the durable cache: when the
* stored log still carries the revision a previous process folded, that fold is
* reused and the log is never opened.
*
* @param ctx - host context carrying the session query engine.
* @param cache - the in-memory fold cache, keyed by session id.
* @param folds - the durable fold cache, keyed by session id and log revision.
* @param progress - publishes how far this read has got.
* @param config - resolved plugin configuration.
* @param rates - the reader's price edits.
* @param request - the window to fold and whether to discard the caches first.
* @returns the complete priced report.
*/
async function assembleReport(ctx, cache, folds, progress, config, rates, request) {
	progress.begin();
	try {
		if (request.refresh) cache.clear();
		const records = await ctx.sessionQuery.listSessions();
		const contributors = [];
		const needy = [];
		for (const record of records) {
			const id = String(record.header.id);
			const hit = cache.get(id);
			if (hit !== void 0) {
				contributors.push({
					id,
					fold: hit
				});
				continue;
			}
			needy.push({
				id,
				seeded: record.header.isSeeded,
				live: record.live
			});
		}
		const revisions = needy.some((entry) => !entry.live) ? await storedRevisions(ctx) : /* @__PURE__ */ new Map();
		const pending = [];
		for (const entry of needy) {
			const revision = entry.live ? void 0 : revisions.get(entry.id);
			if (revision === void 0) {
				pending.push({
					id: entry.id,
					seeded: entry.seeded
				});
				continue;
			}
			const stored = request.refresh ? void 0 : folds.read(entry.id, revision, request.from);
			if (stored === void 0) {
				pending.push({
					id: entry.id,
					seeded: entry.seeded,
					revision
				});
				continue;
			}
			cache.set(entry.id, stored);
			contributors.push({
				id: entry.id,
				fold: stored
			});
		}
		progress.plan(pending.length);
		const cached = pending.length === 0;
		const batch = batchProjectionOf(ctx.sessionQuery);
		const batchable = batch === void 0 ? [] : pending.filter((entry) => !entry.seeded);
		const exact = batch === void 0 ? pending : pending.filter((entry) => entry.seeded);
		let unreadable = 0;
		if (batch !== void 0 && batchable.length > 0) {
			const results = await batch(batchable.map((entry) => entry.id), (source) => {
				const fold = foldSession({
					events: source.events,
					createdAt: source.header.createdAt,
					...source.header.cwd === void 0 ? {} : { cwd: source.header.cwd },
					skipBefore: 0
				});
				progress.advance();
				return fold;
			});
			const byId = /* @__PURE__ */ new Map();
			for (const outcome of results) byId.set(String(outcome.sessionId), outcome);
			for (const entry of batchable) {
				const outcome = byId.get(entry.id);
				if (outcome === void 0 || outcome.status === "rejected") {
					unreadable += 1;
					continue;
				}
				cache.set(entry.id, outcome.value);
				if (entry.revision !== void 0) folds.write(entry.id, entry.revision, outcome.value);
				contributors.push({
					id: entry.id,
					fold: outcome.value
				});
			}
		}
		if (exact.length > 0) {
			const folded = await mapBounded(exact, READ_CONCURRENCY, async (entry) => {
				try {
					const snapshot = await ctx.sessionQuery.readSession(entry.id);
					return foldSession({
						events: snapshot.events,
						createdAt: snapshot.session.createdAt,
						...snapshot.session.cwd === void 0 ? {} : { cwd: snapshot.session.cwd },
						skipBefore: snapshot.inheritedEventCount
					});
				} catch {
					return;
				} finally {
					progress.advance();
				}
			});
			for (let index = 0; index < folded.length; index += 1) {
				const value = folded[index];
				const entry = exact[index];
				if (value === void 0 || entry === void 0) {
					unreadable += 1;
					continue;
				}
				cache.set(entry.id, value);
				if (entry.revision !== void 0) folds.write(entry.id, entry.revision, value);
				contributors.push({
					id: entry.id,
					fold: value
				});
			}
		}
		progress.pricing();
		const report = buildReport(contributors.map(({ id, fold }) => sessionInputOf(id, fold, request)), pricingOptions(config, rates), {
			generatedAt: Date.now(),
			unreadableSessions: unreadable,
			cached
		});
		try {
			await folds.flush();
		} catch (error) {
			ctx.logger.warn(`dsh-local-usage: fold cache write failed: ${describe(error)}`);
		}
		return report;
	} finally {
		progress.finish();
	}
}
/** One line describing an error, for a log line. */
function describe(error) {
	return error instanceof Error ? error.message : String(error);
}
/** One configured card as the pricing engine reads it. */
function cardOf(config, match) {
	const offPeak = {
		input: config.input,
		cacheRead: config.cacheRead,
		cacheWrite: config.cacheWrite,
		output: config.output
	};
	return config.peak === void 0 ? {
		match,
		peakEnabled: false,
		peak: { ...offPeak },
		offPeak
	} : {
		match,
		peakEnabled: true,
		peak: { ...config.peak },
		offPeak
	};
}
/**
* Resolve the model cards, the reader's edits, and the peak schedule.
*
* The reader's stored edits are applied over the configured cards by model name:
* an edit is a change to the card, not a second card, so a model that arrives
* from configuration and one the reader has corrected are the same card in the
* report and in the editor.
*
* @param config - the merged plugin configuration.
* @param rates - the store of the reader's edits.
* @returns the options one fold prices with.
*/
function pricingOptions(config, rates) {
	const windows = [];
	for (const spec of config.peakWindows) {
		const window = parsePeakWindow(spec);
		if (window !== void 0) windows.push(window);
	}
	const edits = rates.read();
	const models = config.models.map((model) => {
		const card = cardOf(model, model.match);
		const edit = edits.get(card.match);
		return edit === void 0 ? card : {
			match: card.match,
			...edit
		};
	});
	const named = new Set(models.map((card) => card.match));
	for (const [match, edit] of edits) if (match.length > 0 && !named.has(match)) models.push({
		match,
		...edit
	});
	const configured = cardOf(config.fallback, "");
	const fallbackEdit = edits.get("");
	const fallback = fallbackEdit === void 0 ? configured : {
		match: "",
		...fallbackEdit
	};
	return {
		currency: config.currency,
		models,
		fallback,
		peakWindows: windows,
		peakWeekdaysOnly: config.peakWeekdaysOnly
	};
}
/** Answer one report request with JSON, or a described failure. */
async function handleReport(ctx, cache, folds, progress, config, rates, request, background) {
	const url = new URL(request.url);
	try {
		const pending = background();
		if (pending !== void 0) await pending;
		const report = await assembleReport(ctx, cache, folds, progress, config, rates, {
			refresh: url.searchParams.get("refresh") === "1",
			from: numberParam(url.searchParams, "from"),
			to: numberParam(url.searchParams, "to")
		});
		return Response.json(report, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		const message = describe(error);
		ctx.logger.warn(`dsh-local-usage: report failed: ${message}`);
		return Response.json({ error: message }, {
			status: 500,
			headers: { "cache-control": "no-store" }
		});
	}
}
/**
* Read one pricing write off an untrusted body.
*
* Every rate is validated before it reaches the store, so a malformed request
* costs a 400 rather than a poisoned table: this file is what every later report
* is priced with.
*
* @param value - the parsed request body.
* @returns the update to apply, or `undefined` when the body is not one.
*/
function parsePricingUpdate(value) {
	if (typeof value !== "object" || value === null) return void 0;
	const models = value.models;
	if (typeof models !== "object" || models === null) return void 0;
	const parsed = {};
	for (const [match, candidate] of Object.entries(models)) {
		if (candidate === null) {
			parsed[match] = null;
			continue;
		}
		const edit = readModelEdit(candidate);
		if (edit === void 0) return void 0;
		parsed[match] = edit;
	}
	return { models: parsed };
}
/** Answer one rate-table write with the table now in effect. */
async function handlePricing(ctx, rates, request) {
	const headers = { "cache-control": "no-store" };
	let body;
	try {
		body = await request.json();
	} catch {
		return Response.json({ error: "expected a JSON body" }, {
			status: 400,
			headers
		});
	}
	const update = parsePricingUpdate(body);
	if (update === void 0) return Response.json({ error: "expected { set: { \"<route>\": {input, cacheRead, cacheWrite, output} | null } }" }, {
		status: 400,
		headers
	});
	try {
		const models = await rates.write(update);
		return Response.json({ models }, { headers });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ctx.logger.warn(`dsh-local-usage: pricing write failed: ${message}`);
		return Response.json({ error: message }, {
			status: 500,
			headers
		});
	}
}
/** Read the Fetch carrier off the Host context. */
function connectionOf(ctx) {
	return Reflect.get(ctx, "connection");
}
/**
* Register the report route.
*
* Deliberately a named export with no default: the Loader takes a module's
* default export when it has one, and a default that is the bare `apply`
* function is a plugin *without* this module's `name` and `inject` — the fiber
* then activates with an empty inject list and the first service read throws
* "cannot get property … without inject".
*
* @param ctx - Host context carrying the carrier and the session query engine.
* @param config - plugin configuration; omitted fields keep their defaults.
*/
function apply(ctx, config = DEFAULT_CONFIG) {
	const resolved = resolveConfig(config);
	const cache = /* @__PURE__ */ new Map();
	const rates = createRateStore(pricingFilePath(resolveDshHome()));
	const folds = createFoldCache(foldCacheFilePath(resolveDshHome()));
	const progress = createProgressTracker();
	let warming;
	/**
	* Fold the whole corpus now, in the background, so the first request the panel
	* makes is a re-price instead of a cold read.
	*
	* The window is unbounded on purpose: the fold cache keeps every sample a
	* session ever recorded regardless of the window asked for, so priming it once
	* that way answers every window the panel can select. A deployment that is
	* warm already pays only the corpus listing.
	*/
	const warm = () => {
		if (warming !== void 0) return;
		warming = assembleReport(ctx, cache, folds, progress, resolved, rates, {
			refresh: false,
			from: void 0,
			to: void 0
		}).then(() => void 0, (error) => {
			ctx.logger.warn(`dsh-local-usage: background fold failed: ${describe(error)}`);
		}).finally(() => {
			warming = void 0;
		});
	};
	ctx.on("session/event", (session) => {
		cache.delete(session.id);
	});
	if (resolved.warmup) ctx.effect(() => {
		const timer = setTimeout(warm, resolved.warmupDelayMs);
		return () => {
			clearTimeout(timer);
		};
	}, "dsh-local-usage: background fold");
	ctx.effect(() => connectionOf(ctx).fetch.register({
		path: REPORT_PATH,
		methods: ["GET"],
		requestBody: "buffered",
		fetch: (request) => handleReport(ctx, cache, folds, progress, resolved, rates, request, () => warming)
	}), "dsh-local-usage: report route");
	ctx.effect(() => connectionOf(ctx).fetch.register({
		path: PROGRESS_PATH,
		methods: ["GET"],
		requestBody: "buffered",
		fetch: () => Promise.resolve(Response.json(progress.read(), { headers: { "cache-control": "no-store" } }))
	}), "dsh-local-usage: progress route");
	ctx.effect(() => connectionOf(ctx).fetch.register({
		path: PRICING_PATH,
		methods: ["POST"],
		requestBody: "buffered",
		fetch: (request) => handlePricing(ctx, rates, request)
	}), "dsh-local-usage: pricing route");
}
//#endregion
export { DEFAULT_CONFIG, PRICING_PATH, PROGRESS_PATH, REPORT_PATH, apply, inject, name };
