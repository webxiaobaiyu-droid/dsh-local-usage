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

import { lastAssistantStreamChunk } from '@deepseek-ai/dsh-llm/assistant-stream'
import type { TokenUsage } from '@deepseek-ai/dsh-llm/types'
// Type-only: activates the 'llm/retry-started' variant the retry slot reads.
import type {} from '@deepseek-ai/dsh-llm-retry/types'
// Type-only: activates the 'compaction/start' and 'compaction/end' variants the
// reliability fold counts, so context that could not be compacted is reported.
import type {} from '@deepseek-ai/dsh-compaction/types'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { costOf, isPeakTime, selectRate } from './pricing.ts'
import type { PeakWindow, PriceRate, PriceRule } from './pricing.ts'
import { UNKNOWN_PROJECT } from './types.ts'
import type {
  UsageCosted,
  UsageDayRow,
  UsageInsightsReport,
  UsageModelRow,
  UsageProjectRow,
  UsageReliability,
  UsageSessionRow,
  UsageSignalRow,
  UsageTokens,
} from './types.ts'

/** Route label used when the log attributes a settlement to no `provider/model`. */
export const UNKNOWN_ROUTE = 'unknown'

/** One billed turn's exact tokens, its instant, and the route it was billed on. */
export interface UsageSample {
  /** Turn settlement time in Unix epoch milliseconds. */
  readonly time: number
  /** `provider/model`, or {@link UNKNOWN_ROUTE} when the log names none. */
  readonly route: string
  /** Exact provider-reported buckets for the turn. */
  readonly tokens: UsageTokens
}

/** One session's inputs to a report, plus what the window keeps of it. */
export interface SessionUsageInput {
  readonly sessionId: string
  readonly title?: string
  readonly cwd?: string
  readonly createdAt: number
  readonly samples: readonly UsageSample[]
  /** The window's share of this session's reliability counters; empty when it recorded none. */
  readonly reliability?: readonly ReliabilityDay[]
}

/** The rate card and peak schedule every sample is priced with. */
export interface PricingOptions {
  /** Currency the resulting cost figures are expressed in. */
  readonly currency: string
  /** Configured rules in match order. */
  readonly rules: readonly PriceRule[]
  /** Rate used by a route no rule matches. */
  readonly fallback: PriceRate
  /** Parsed peak windows in Beijing time. */
  readonly peakWindows: readonly PeakWindow[]
  /** When true, Saturday and Sunday are never peak. */
  readonly peakWeekdaysOnly: boolean
  /** Factor applied to every rate inside a peak window. */
  readonly peakMultiplier: number
}

/** Report-level facts the Host supplies around a fold. */
export interface ReportMeta {
  /** Host clock at assembly time. */
  readonly generatedAt: number
  /** Session logs that could not be read. */
  readonly unreadableSessions: number
  /** Whether the samples came from the Host's in-memory fold cache. */
  readonly cached: boolean
}

/**
 * Local calendar day of one instant, as `YYYY-MM-DD`.
 * @param time - Unix epoch milliseconds.
 * @returns the host-local day key the calendar heatmap buckets on.
 */
export function localDayKey(time: number): string {
  const date = new Date(time)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(date.getFullYear())}-${month}-${day}`
}

/** Local midnight of one day key, or `undefined` when the key is malformed. */
function dayKeyToTime(day: string): number | undefined {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (matched === null) return undefined
  const time = new Date(
    Number(matched[1]),
    Number(matched[2]) - 1,
    Number(matched[3]),
  ).getTime()
  return Number.isFinite(time) ? time : undefined
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
export function samplesOf(events: readonly SessionEvent[]): UsageSample[] {
  const samples: UsageSample[] = []
  let route = UNKNOWN_ROUTE
  let last: { turn: number; step: number; index: number } | undefined

  for (const event of events) {
    if (event.type === 'request/header') {
      const { provider, model } = event.data.header.config
      if (provider.length > 0 && model.length > 0) route = `${provider}/${model}`
      continue
    }
    if (event.type === 'llm/retry-started') {
      if (last !== undefined
        && last.turn === event.data.turn
        && last.step === event.data.step) {
        last = undefined
      }
      continue
    }
    if (event.type !== 'assistant/message' && event.type !== 'assistant/attempt') continue

    const usage = usageOf(event)
    if (usage === undefined) continue
    const tokens: UsageTokens = {
      uncachedInputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens ?? 0,
      cacheWriteTokens: usage.cacheWriteTokens ?? 0,
    }
    const { turn, step } = event.data
    const settledRoute = event.type === 'assistant/message' ? sourceRoute(event) ?? route : route
    const slot = last !== undefined && last.turn === turn && last.step === step ? last : undefined
    const previous = slot === undefined ? undefined : samples[slot.index]

    if (previous !== undefined && sameTokens(previous.tokens, tokens)) continue
    if (slot === undefined) {
      samples.push({ time: event.time, route: settledRoute, tokens })
      last = { turn, step, index: samples.length - 1 }
    } else {
      samples[slot.index] = { time: event.time, route: settledRoute, tokens }
      last = { turn, step, index: slot.index }
    }
  }
  return samples
}

/** The usage one settlement reports, from its own field or its embedded stream. */
function usageOf(
  event: SessionEvent<'assistant/message'> | SessionEvent<'assistant/attempt'>,
): TokenUsage | undefined {
  if (event.type === 'assistant/message' && event.data.usage !== undefined) return event.data.usage
  return lastAssistantStreamChunk(event.data.stream, 'usage')?.usage
}

/** The route a settling assistant message was produced by, when it names one. */
function sourceRoute(event: SessionEvent<'assistant/message'>): string | undefined {
  // Defensive: a replay-validated log always carries `source`, but one absent
  // route must cost this sample its attribution, never the whole report.
  const source = event.data.message.source as { provider?: string; model?: string } | undefined
  if (source === undefined) return undefined
  const { provider, model } = source
  if (typeof provider !== 'string' || typeof model !== 'string') return undefined
  return provider.length > 0 && model.length > 0 ? `${provider}/${model}` : undefined
}

/** Whether two bucket sets are identical, so a repeat settlement is a no-op. */
function sameTokens(left: UsageTokens, right: UsageTokens): boolean {
  return left.uncachedInputTokens === right.uncachedInputTokens
    && left.outputTokens === right.outputTokens
    && left.cacheReadTokens === right.cacheReadTokens
    && left.cacheWriteTokens === right.cacheWriteTokens
}

/**
 * One local day of reliability counters, as the per-session cache keeps them.
 *
 * Counters are folded per local day rather than per event so a window can be
 * re-cut from the cache the way samples are, without holding one object per tool
 * call: every window the panel asks for is bounded by local days, which is what
 * makes the day the honest resolution. Codes are kept as the producer issued
 * them — grouping by cause is the whole point, and inventing our own taxonomy
 * would put a translation between the reader and the provider's own vocabulary.
 */
export interface ReliabilityDay {
  /** Local calendar day as `YYYY-MM-DD`. */
  readonly day: string
  retries: number
  readonly retryCauses: Map<string, number>
  toolCalls: number
  toolErrors: number
  readonly toolErrorCodes: Map<string, number>
  compactions: number
  compactionFailures: number
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
export function reliabilityOf(events: readonly SessionEvent[]): ReliabilityDay[] {
  const byDay = new Map<string, ReliabilityDay>()
  const dayOf = (time: number): ReliabilityDay => {
    const day = localDayKey(time)
    let bucket = byDay.get(day)
    if (bucket === undefined) {
      bucket = {
        day,
        retries: 0,
        retryCauses: new Map<string, number>(),
        toolCalls: 0,
        toolErrors: 0,
        toolErrorCodes: new Map<string, number>(),
        compactions: 0,
        compactionFailures: 0,
      }
      byDay.set(day, bucket)
    }
    return bucket
  }
  const bump = (counts: Map<string, number>, code: string): void => {
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  for (const event of events) {
    switch (event.type) {
      case 'llm/retry': {
        const bucket = dayOf(event.time)
        bucket.retries += 1
        bump(bucket.retryCauses, failureCode(event.data.failure))
        break
      }
      case 'tool/call':
        dayOf(event.time).toolCalls += 1
        break
      case 'tool/result': {
        const error = event.data.error
        if (error === undefined || error === null) break
        const bucket = dayOf(event.time)
        bucket.toolErrors += 1
        bump(bucket.toolErrorCodes, errorCode(error))
        break
      }
      case 'compaction/start':
        dayOf(event.time).compactions += 1
        break
      case 'compaction/end':
        if (event.data.error === undefined || event.data.error === null) break
        dayOf(event.time).compactionFailures += 1
        break
      default:
        break
    }
  }

  return [...byDay.values()].sort(
    (left, right) => (dayKeyToTime(left.day) ?? 0) - (dayKeyToTime(right.day) ?? 0),
  )
}

/** Code a retry failure carries; a shape we cannot read still gets counted. */
function failureCode(failure: unknown): string {
  const code = (failure as { code?: unknown } | undefined)?.code
  return typeof code === 'string' && code.length > 0 ? code : UNKNOWN_CAUSE
}

/** Code a tool error carries, from either of the two shapes a result may use. */
function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | undefined)?.code
  if (typeof code === 'string' && code.length > 0) return code
  const name = (error as { name?: unknown } | undefined)?.name
  return typeof name === 'string' && name.length > 0 ? name : UNKNOWN_CAUSE
}

/** Code used for a signal whose producer issued none. */
export const UNKNOWN_CAUSE = 'UNKNOWN'

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
export function reliabilityWithin(
  days: readonly ReliabilityDay[],
  from: number | undefined,
  to: number | undefined,
): ReliabilityDay[] {
  if (from === undefined && to === undefined) return [...days]
  return days.filter((day) => {
    const start = dayKeyToTime(day.day)
    if (start === undefined) return false
    return (from === undefined || start >= from) && (to === undefined || start <= to)
  })
}

/** Merge one window's reliability folds into the report's single statement. */
function reliabilityOfWindow(
  inputs: readonly SessionUsageInput[],
): UsageReliability {
  const retryCauses = new Map<string, number>()
  const toolErrorCodes = new Map<string, number>()
  let retries = 0
  let toolCalls = 0
  let toolErrors = 0
  let compactions = 0
  let compactionFailures = 0

  for (const input of inputs) {
    for (const day of input.reliability ?? []) {
      retries += day.retries
      toolCalls += day.toolCalls
      toolErrors += day.toolErrors
      compactions += day.compactions
      compactionFailures += day.compactionFailures
      for (const [code, count] of day.retryCauses) retryCauses.set(code, (retryCauses.get(code) ?? 0) + count)
      for (const [code, count] of day.toolErrorCodes) toolErrorCodes.set(code, (toolErrorCodes.get(code) ?? 0) + count)
    }
  }

  return {
    retries,
    retryCauses: signalRows(retryCauses),
    toolCalls,
    toolErrors,
    toolErrorCodes: signalRows(toolErrorCodes),
    compactions,
    compactionFailures,
  }
}

/** Grouped counts as rows, largest first, ties broken by code so the order is stable. */
function signalRows(counts: ReadonlyMap<string, number>): UsageSignalRow[] {
  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code))
}

/** Mutable accumulator for one row of the report. */
interface Bucket {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  cost: number
  calls: number
  sessions: Set<string>
}

function emptyBucket(): Bucket {
  return {
    uncachedInputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    cost: 0,
    calls: 0,
    sessions: new Set<string>(),
  }
}

function addSample(bucket: Bucket, tokens: UsageTokens, cost: number, sessionId: string): void {
  bucket.uncachedInputTokens += tokens.uncachedInputTokens
  bucket.outputTokens += tokens.outputTokens
  bucket.cacheReadTokens += tokens.cacheReadTokens
  bucket.cacheWriteTokens += tokens.cacheWriteTokens
  bucket.cost += cost
  bucket.calls += 1
  bucket.sessions.add(sessionId)
}

/** Render minutes-after-midnight back as `HH:MM` for the wire. */
function clock(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Costed fields without the internal session set. */
function costedOf(bucket: Bucket): UsageCosted {
  return {
    uncachedInputTokens: bucket.uncachedInputTokens,
    outputTokens: bucket.outputTokens,
    cacheReadTokens: bucket.cacheReadTokens,
    cacheWriteTokens: bucket.cacheWriteTokens,
    cost: bucket.cost,
    calls: bucket.calls,
  }
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
export function buildReport(
  inputs: readonly SessionUsageInput[],
  options: PricingOptions,
  meta: ReportMeta,
): UsageInsightsReport {
  const totals = emptyBucket()
  const byDay = new Map<string, Bucket>()
  const byRoute = new Map<string, Bucket & { priced: boolean }>()
  const byProject = new Map<string, Bucket>()
  const sessionRows: UsageSessionRow[] = []
  const unpricedRoutes = new Set<string>()
  let unpricedTokens = 0

  for (const input of inputs) {
    const sessionBucket = emptyBucket()
    // One bucket per directory for the whole window. The per-day split is not
    // pre-computed here: a drill-down asks the Host for one day's window, and
    // this fold re-runs over the cached samples, so a day-by-project matrix
    // would be width no caller reads.
    const project = input.cwd ?? UNKNOWN_PROJECT
    let firstSampleTime: number | undefined
    let lastSampleTime: number | undefined
    for (const sample of input.samples) {
      const peak = isPeakTime(sample.time, options.peakWindows, options.peakWeekdaysOnly)
      const { rate, matched } = selectRate(
        options.rules,
        options.fallback,
        sample.route,
        peak,
        options.peakMultiplier,
      )
      const cost = costOf(sample.tokens, rate)
      firstSampleTime ??= sample.time
      lastSampleTime = sample.time

      const day = localDayKey(sample.time)
      let dayBucket = byDay.get(day)
      if (dayBucket === undefined) {
        dayBucket = emptyBucket()
        byDay.set(day, dayBucket)
      }
      let routeBucket = byRoute.get(sample.route)
      if (routeBucket === undefined) {
        routeBucket = { ...emptyBucket(), priced: matched }
        byRoute.set(sample.route, routeBucket)
      }
      // Created only from inside the sample loop, so a directory that recorded
      // no usage never earns a row: a session with no billable settlement is
      // absent from the report rather than present and empty.
      let projectBucket = byProject.get(project)
      if (projectBucket === undefined) {
        projectBucket = emptyBucket()
        byProject.set(project, projectBucket)
      }

      addSample(dayBucket, sample.tokens, cost, input.sessionId)
      addSample(routeBucket, sample.tokens, cost, input.sessionId)
      addSample(projectBucket, sample.tokens, cost, input.sessionId)
      addSample(sessionBucket, sample.tokens, cost, input.sessionId)
      addSample(totals, sample.tokens, cost, input.sessionId)

      if (!matched) {
        unpricedRoutes.add(sample.route)
        unpricedTokens += sample.tokens.uncachedInputTokens
          + sample.tokens.outputTokens
          + sample.tokens.cacheReadTokens
          + sample.tokens.cacheWriteTokens
      }
    }

    if (input.samples.length > 0) {
      sessionRows.push({
        sessionId: input.sessionId,
        ...input.title === undefined ? {} : { title: input.title },
        ...input.cwd === undefined ? {} : { cwd: input.cwd },
        createdAt: input.createdAt,
        updatedAt: lastSampleTime ?? firstSampleTime ?? input.createdAt,
        ...costedOf(sessionBucket),
      })
    }
  }

  const days: UsageDayRow[] = [...byDay.entries()]
    .map(([day, bucket]) => ({
      day,
      ...costedOf(bucket),
      sessions: bucket.sessions.size,
    }))
    .sort((left, right) => (dayKeyToTime(left.day) ?? 0) - (dayKeyToTime(right.day) ?? 0))

  const models: UsageModelRow[] = [...byRoute.entries()]
    .map(([route, bucket]) => ({
      route,
      priced: bucket.priced,
      ...costedOf(bucket),
    }))
    .sort((left, right) => right.cost - left.cost || right.outputTokens - left.outputTokens)

  const projects: UsageProjectRow[] = [...byProject.entries()]
    .map(([path, bucket]) => ({
      path,
      ...costedOf(bucket),
      sessions: bucket.sessions.size,
    }))
    .sort((left, right) => right.cost - left.cost || right.outputTokens - left.outputTokens)

  sessionRows.sort((left, right) => right.cost - left.cost || right.updatedAt - left.updatedAt)

  return {
    generatedAt: meta.generatedAt,
    currency: options.currency,
    totals: { ...costedOf(totals), sessions: totals.sessions.size },
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
    peakMultiplier: options.peakMultiplier,
    prices: options.rules.map(rule => ({
      match: rule.match,
      input: rule.input,
      cacheRead: rule.cacheRead,
      cacheWrite: rule.cacheWrite,
      output: rule.output,
    })),
    fallbackPrice: {
      match: '',
      input: options.fallback.input,
      cacheRead: options.fallback.cacheRead,
      cacheWrite: options.fallback.cacheWrite,
      output: options.fallback.output,
    },
    peakWindows: options.peakWindows.map(window => `${clock(window.start)}-${clock(window.end)}`),
    peakWeekdaysOnly: options.peakWeekdaysOnly,
  }
}
