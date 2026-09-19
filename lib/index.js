import { foldSessionTitle } from "@deepseek-ai/dsh-session-title";
import { lastAssistantStreamChunk } from "@deepseek-ai/dsh-llm/assistant-stream";
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
* Whether one instant falls in a configured peak window.
* @param time - Unix epoch milliseconds.
* @param windows - parsed peak windows in Beijing time.
* @param weekdaysOnly - when true, Saturday and Sunday are never peak.
* @returns true when the instant is billed at the peak rate.
*/
function isPeakTime(time, windows, weekdaysOnly) {
	if (windows.length === 0) return false;
	const { weekday, minutes } = beijingClock(time);
	if (weekdaysOnly && (weekday === 0 || weekday === 6)) return false;
	return windows.some((window) => minutes >= window.start && minutes < window.end);
}
/**
* Select the rate card one route is priced with.
* @param rules - configured rules in match order.
* @param fallback - rate used when no rule matches.
* @param route - `provider/model` the usage was attributed to.
* @param peak - whether the sample is inside a peak window.
* @param peakMultiplier - factor applied to every rate during peak windows.
* @returns the effective rate and whether a configured rule matched.
*/
function selectRate(rules, fallback, route, peak, peakMultiplier) {
	const needle = route.toLocaleLowerCase();
	const rule = rules.find((candidate) => needle.includes(candidate.match.toLocaleLowerCase()));
	const matched = rule === void 0 ? fallback : {
		input: rule.input,
		cacheRead: rule.cacheRead,
		cacheWrite: rule.cacheWrite,
		output: rule.output
	};
	if (!peak || peakMultiplier === 1) return {
		rate: matched,
		matched: rule !== void 0
	};
	return {
		rate: {
			input: matched.input * peakMultiplier,
			cacheRead: matched.cacheRead * peakMultiplier,
			cacheWrite: matched.cacheWrite * peakMultiplier,
			output: matched.output * peakMultiplier
		},
		matched: rule !== void 0
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
/** Local midnight of one day key, or `undefined` when the key is malformed. */
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
* @param inputs - per-session inputs, in any order.
* @param options - rate card and peak schedule.
* @param meta - host-supplied report facts.
* @returns the complete report, day rows ascending and ranking rows by cost.
*/
function buildReport(inputs, options, meta) {
	const totals = emptyBucket();
	const byDay = /* @__PURE__ */ new Map();
	const byRoute = /* @__PURE__ */ new Map();
	const sessionRows = [];
	const unpricedRoutes = /* @__PURE__ */ new Set();
	let unpricedTokens = 0;
	for (const input of inputs) {
		const sessionBucket = emptyBucket();
		let firstSampleTime;
		let lastSampleTime;
		for (const sample of input.samples) {
			const peak = isPeakTime(sample.time, options.peakWindows, options.peakWeekdaysOnly);
			const { rate, matched } = selectRate(options.rules, options.fallback, sample.route, peak, options.peakMultiplier);
			const cost = costOf(sample.tokens, rate);
			firstSampleTime ??= sample.time;
			lastSampleTime = sample.time;
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
			addSample(dayBucket, sample.tokens, cost, input.sessionId);
			addSample(routeBucket, sample.tokens, cost, input.sessionId);
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
		sessions: sessionRows,
		scannedSessions: inputs.length,
		unreadableSessions: meta.unreadableSessions,
		unpricedRoutes: [...unpricedRoutes].sort(),
		unpricedTokens,
		cached: meta.cached,
		peakMultiplier: options.peakMultiplier,
		prices: options.rules.map((rule) => ({
			match: rule.match,
			input: rule.input,
			cacheRead: rule.cacheRead,
			cacheWrite: rule.cacheWrite,
			output: rule.output
		})),
		fallbackPrice: {
			match: "",
			input: options.fallback.input,
			cacheRead: options.fallback.cacheRead,
			cacheWrite: options.fallback.cacheWrite,
			output: options.fallback.output
		},
		peakWindows: options.peakWindows.map((window) => `${clock(window.start)}-${clock(window.end)}`),
		peakWeekdaysOnly: options.peakWeekdaysOnly
	};
}
//#endregion
//#region src/index.ts
/** Exact route the browser half calls; it sits behind the carrier's trust fence. */
const REPORT_PATH = "/api/dsh-local-usage/report";
/** Session logs folded concurrently; each read parses and replay-validates a whole log. */
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
		output: 13.5
	}, {
		match: "flash",
		...FLASH_RATE
	}],
	fallback: FLASH_RATE,
	peakWindows: ["09:00-12:00", "14:00-18:00"],
	peakWeekdaysOnly: true,
	peakMultiplier: 2
};
/** Merge a caller's configuration over the shipped defaults. */
function resolveConfig(config) {
	return {
		currency: config.currency ?? DEFAULT_CONFIG.currency,
		models: config.models ?? DEFAULT_CONFIG.models,
		fallback: config.fallback ?? DEFAULT_CONFIG.fallback,
		peakWindows: config.peakWindows ?? DEFAULT_CONFIG.peakWindows,
		peakWeekdaysOnly: config.peakWeekdaysOnly ?? DEFAULT_CONFIG.peakWeekdaysOnly,
		peakMultiplier: config.peakMultiplier ?? DEFAULT_CONFIG.peakMultiplier
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
/** Build the priced report over every readable session log. */
async function assembleReport(ctx, cache, config, request) {
	if (request.refresh) cache.clear();
	const records = await ctx.sessionQuery.listSessions();
	const pending = [];
	const inputs = [];
	for (const record of records) {
		const id = String(record.header.id);
		const hit = cache.get(id);
		if (hit !== void 0) {
			inputs.push({
				sessionId: id,
				createdAt: hit.createdAt,
				samples: withinRange(hit.samples, request.from, request.to),
				...titleFields(hit)
			});
			continue;
		}
		pending.push(id);
	}
	const cached = pending.length === 0;
	const folded = await mapBounded(pending, READ_CONCURRENCY, async (id) => {
		try {
			const snapshot = await ctx.sessionQuery.readSession(id);
			const samples = samplesOf(snapshot.events.filter((event) => event.seq >= snapshot.inheritedEventCount));
			const title = foldSessionTitle(snapshot.events)?.title;
			const entry = {
				samples,
				createdAt: snapshot.session.createdAt,
				...title === void 0 || title.length === 0 ? {} : { title },
				...snapshot.session.cwd === void 0 ? {} : { cwd: snapshot.session.cwd }
			};
			cache.set(id, entry);
			return {
				sessionId: id,
				createdAt: entry.createdAt,
				samples: withinRange(samples, request.from, request.to),
				...titleFields(entry)
			};
		} catch {
			return;
		}
	});
	let unreadable = 0;
	for (const input of folded) if (input === void 0) unreadable += 1;
	else inputs.push(input);
	return buildReport(inputs, pricingOptions(config), {
		generatedAt: Date.now(),
		unreadableSessions: unreadable,
		cached
	});
}
/** Resolve the configured rate card and peak schedule into fold options. */
function pricingOptions(config) {
	const windows = [];
	for (const spec of config.peakWindows) {
		const window = parsePeakWindow(spec);
		if (window !== void 0) windows.push(window);
	}
	const rules = config.models.map((model) => ({ ...model }));
	const fallback = { ...config.fallback };
	return {
		currency: config.currency,
		rules,
		fallback,
		peakWindows: windows,
		peakWeekdaysOnly: config.peakWeekdaysOnly,
		peakMultiplier: config.peakMultiplier
	};
}
/** Answer one report request with JSON, or a described failure. */
async function handleReport(ctx, cache, config, request) {
	const url = new URL(request.url);
	try {
		const report = await assembleReport(ctx, cache, config, {
			refresh: url.searchParams.get("refresh") === "1",
			from: numberParam(url.searchParams, "from"),
			to: numberParam(url.searchParams, "to")
		});
		return Response.json(report, { headers: { "cache-control": "no-store" } });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ctx.logger.warn(`dsh-local-usage: report failed: ${message}`);
		return Response.json({ error: message }, {
			status: 500,
			headers: { "cache-control": "no-store" }
		});
	}
}
/** Read the Fetch carrier off the Host context. */
function connectionOf(ctx) {
	return Reflect.get(ctx, "connection");
}
/**
* Register the report route.
* @param ctx - Host context carrying the carrier and the session query engine.
* @param config - plugin configuration; omitted fields keep their defaults.
*/
function apply(ctx, config = DEFAULT_CONFIG) {
	const resolved = resolveConfig(config);
	const cache = /* @__PURE__ */ new Map();
	ctx.on("session/event", (session) => {
		cache.delete(session.id);
	});
	ctx.effect(() => connectionOf(ctx).fetch.register({
		path: REPORT_PATH,
		methods: ["GET"],
		requestBody: "buffered",
		fetch: (request) => handleReport(ctx, cache, resolved, request)
	}), "dsh-local-usage: report route");
}
//#endregion
export { DEFAULT_CONFIG, REPORT_PATH, apply, apply as default, inject, name };
