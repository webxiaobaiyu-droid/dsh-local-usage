/**
 * The two shipped dictionaries, checked against each other.
 *
 * `en` is declared `satisfies Record<UsageInsightsLocaleKey, string>`, so a key
 * present in one and missing from the other is already a compile error. What
 * the type system cannot see is a *placeholder* mismatch: the locale runtime
 * substitutes `{name}` by name and leaves an unknown name in place, so an
 * English `{date}` against a Chinese `{day}` renders the literal text `{date}`
 * to a reader with no error anywhere. These checks close that gap, and pin the
 * weekday gutter's glyphs, which are a layout constraint as much as copy.
 *
 * @module dsh-local-usage/tests/locales
 */

import { describe, expect, it } from 'vitest'
import { en, zh } from '../src/client/locales.ts'

/** Placeholder names a template asks its caller to supply, in order. */
function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map(match => match[1] ?? '')
}

const keys = Object.keys(zh) as (keyof typeof zh)[]

describe('dictionary parity', () => {
  it('covers the same key set in both locales', () => {
    expect(Object.keys(en).sort()).toEqual([...keys].sort())
  })

  it('asks for the same placeholders in both locales', () => {
    for (const key of keys) {
      expect({ key, params: placeholders(zh[key]) }).toEqual({ key, params: placeholders(en[key]) })
    }
  })

  it('leaves no value empty', () => {
    for (const key of keys) {
      expect({ key, value: zh[key].trim() }).not.toEqual({ key, value: '' })
      expect({ key, value: en[key].trim() }).not.toEqual({ key, value: '' })
    }
  })
})

describe('weekday gutter', () => {
  const short = ['wdShort.0', 'wdShort.1', 'wdShort.2', 'wdShort.3', 'wdShort.4', 'wdShort.5', 'wdShort.6'] as const

  it('is the Sunday-first weekday glyphs in Chinese, not digits', () => {
    expect(short.map(key => zh[key])).toEqual(['日', '一', '二', '三', '四', '五', '六'])
  })

  it('stays within the gutter, one glyph per row', () => {
    // The gutter is a fixed 20px track measured alongside the cells, so a label
    // longer than a single character would overrun the column it names.
    for (const key of short) {
      expect({ key, width: [...zh[key]].length }).toEqual({ key, width: 1 })
      expect({ key, width: [...en[key]].length }).toEqual({ key, width: 1 })
    }
  })

  it('keeps the long form for the tooltip, which has room for it', () => {
    expect(zh['wd.0']).toBe('周日')
    expect(zh['wd.6']).toBe('周六')
  })
})
