import { describe, expect, it } from 'vitest'
import {
  formatCost, formatDay, formatInteger, formatRate, formatTokens,
} from '../src/client/format.ts'

describe('formatCost', () => {
  it('writes the figure in the currency the report states', () => {
    expect(formatCost(8.26, 'CNY', 'zh')).toContain('8.26')
    expect(formatCost(184.53, 'USD', 'en')).toContain('184.53')
  })

  it('follows the locale rather than the browser for symbol placement', () => {
    // The locale decides where the symbol goes and how a foreign currency is
    // disambiguated; the same figure must not render identically in both.
    expect(formatCost(8.26, 'CNY', 'zh')).not.toBe(formatCost(8.26, 'CNY', 'en'))
  })

  it('widens precision so a sub-cent day does not read as a flat zero', () => {
    expect(formatCost(0.0042, 'CNY', 'en')).toContain('0.0042')
    expect(formatCost(0.42, 'CNY', 'en')).toContain('0.420')
    expect(formatCost(0, 'CNY', 'en')).toContain('0.00')
  })

  it('falls back to a plain suffix for a currency code Intl does not know', () => {
    // A configured currency outside ISO 4217 throws inside Intl; the panel owes
    // the reader a figure, not a crash.
    expect(formatCost(8.26, 'NOTACODE', 'en')).toBe('NOTACODE 8.26')
  })
})

describe('formatTokens', () => {
  it('keeps the English compact scale it replaced', () => {
    // Regression guard: the switch to Intl must not move any English figure.
    expect(formatTokens(918, 'en')).toBe('918')
    expect(formatTokens(635_000, 'en')).toBe('635K')
    expect(formatTokens(1_470_000, 'en')).toBe('1.47M')
    expect(formatTokens(214_870_000, 'en')).toBe('214.87M')
  })

  it('counts in the scale the reader actually counts in', () => {
    expect(formatTokens(1_470_000, 'zh')).toBe('147万')
    expect(formatTokens(214_870_000, 'zh')).toBe('2.15亿')
    expect(formatTokens(214_870_000, 'zh')).not.toContain('M')
  })

  it('leaves a figure below the first scale step alone', () => {
    expect(formatTokens(0, 'zh')).toBe('0')
    expect(formatTokens(999, 'zh')).toBe('999')
  })
})

describe('formatInteger', () => {
  it('renders every digit rather than a rounded scale', () => {
    expect(formatInteger(214_870_000, 'en')).toBe('214,870,000')
    expect(formatInteger(214_870_000, 'zh')).toBe('214,870,000')
  })

  it('rounds a fractional count before grouping it', () => {
    expect(formatInteger(1234.6, 'en')).toBe('1,235')
  })
})

describe('formatRate', () => {
  it('never renders a price in exponential notation', () => {
    // The bug this replaced: String(2e-7) is "2e-7", which is not a price a
    // reader can check against a provider's published rate card.
    const tiny = formatRate(0.0000002, 'en')

    expect(tiny).not.toContain('e')
    expect(tiny).toBe('0.0000002')
  })

  it('keeps the shipped cards readable, and the cheap buckets unrounded', () => {
    expect(formatRate(4.5, 'en')).toBe('4.5')
    expect(formatRate(13.5, 'en')).toBe('13.5')
    expect(formatRate(0.15, 'en')).toBe('0.15')
    expect(formatRate(0.02, 'en')).toBe('0.02')
    expect(formatRate(1, 'en')).toBe('1')
    expect(formatRate(0, 'en')).toBe('0')
  })
})

describe('formatDay', () => {
  it('writes the day the way the reader writes dates', () => {
    expect(formatDay('2026-08-28', 'zh')).toBe('2026年8月28日')
    expect(formatDay('2026-08-28', 'en')).toBe('Aug 28, 2026')
  })

  it('returns an unparseable key unchanged rather than rendering a wrong day', () => {
    expect(formatDay('not-a-day', 'en')).toBe('not-a-day')
    expect(formatDay('', 'en')).toBe('')
  })
})

describe('locale handling', () => {
  it('does not throw for a well-formed tag Intl has no data for', () => {
    // A language pack may register a tag nothing has data for; the reader gets
    // the default locale's figures rather than a blank panel.
    expect(() => formatTokens(1_500_000, 'xx')).not.toThrow()
    expect(() => formatCost(1, 'CNY', 'xx')).not.toThrow()
  })
})
