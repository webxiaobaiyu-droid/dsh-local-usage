import { describe, expect, it } from 'vitest'
import { dayKey, heatmapColumns, heatmapWindow, midnight, monthMarkers } from '../src/client/heatmap-grid.ts'

const MS_PER_DAY = 86_400_000

/** Local noon of one day, so no assertion depends on the hour a test runs at. */
function noon(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12).getTime()
}

describe('heatmapWindow', () => {
  it('opens on a Sunday and closes with today', () => {
    for (const day of [1, 5, 12, 19, 26, 30]) {
      const now = noon(2026, 9, day)
      const [from, to] = heatmapWindow(now, 52)
      expect(new Date(midnight(from)).getDay()).toBe(0)
      expect(midnight(to)).toBe(midnight(now))
    }
  })

  it('spans exactly fifty-two columns for every weekday', () => {
    // 2026-09-20 is a Sunday, so this walks a full week of endings.
    for (let offset = 0; offset < 7; offset += 1) {
      const now = noon(2026, 9, 20 + offset)
      const [from, to] = heatmapWindow(now, 52)
      expect(heatmapColumns(from, to)).toBe(52)
    }
  })

  it('ends on the given day even across a month boundary', () => {
    const now = noon(2026, 3, 1)
    const [from, to] = heatmapWindow(now, 52)
    expect(dayKey(to)).toBe('2026-03-01')
    expect(heatmapColumns(from, to)).toBe(52)
  })
})

describe('monthMarkers', () => {
  it('labels the visible months in ascending column order', () => {
    const now = noon(2026, 9, 19)
    const [from, to] = heatmapWindow(now, 52)
    const columns = heatmapColumns(from, to)
    const markers = monthMarkers(from, to, columns)

    expect(markers.length).toBeGreaterThanOrEqual(11)
    for (let index = 1; index < markers.length; index += 1) {
      expect(markers[index]!.index).toBeGreaterThan(markers[index - 1]!.index)
    }
    expect(markers.at(-1)?.month).toBe(9)
  })

  it('keeps every marker inside the visible columns', () => {
    const now = noon(2026, 9, 19)
    const [, to] = heatmapWindow(now, 52)
    for (const columns of [1, 5, 12, 52]) {
      const start = midnight(to) - (columns * 7 - (new Date(midnight(to)).getDay() + 1)) * MS_PER_DAY
      for (const marker of monthMarkers(start, to, columns)) {
        expect(marker.index).toBeGreaterThanOrEqual(0)
        expect(marker.index).toBeLessThan(columns)
      }
    }
  })

  it('never repeats a column', () => {
    const now = noon(2026, 1, 2)
    const [from, to] = heatmapWindow(now, 52)
    const markers = monthMarkers(from, to, heatmapColumns(from, to))
    expect(new Set(markers.map(marker => marker.index)).size).toBe(markers.length)
  })
})

describe('heatmapColumns', () => {
  it('reports one column for a single day', () => {
    const day = noon(2026, 9, 19)
    expect(heatmapColumns(day, day)).toBe(1)
  })

  it('rounds a partial trailing week up to a whole column', () => {
    const from = noon(2026, 9, 14)
    expect(heatmapColumns(from, noon(2026, 9, 15))).toBe(1)
    expect(heatmapColumns(from, noon(2026, 9, 20))).toBe(1)
    expect(heatmapColumns(from, noon(2026, 9, 21))).toBe(2)
  })
})
