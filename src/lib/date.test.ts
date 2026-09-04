import { describe, expect, it } from 'vitest'
import { parseLocalDate } from './date'

describe('parseLocalDate', () => {
  it('parses standard YYYY-MM-DD to local midnight', () => {
    const d = parseLocalDate('2024-03-15')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(2) // 0-indexed March
    expect(d!.getDate()).toBe(15)
    expect(d!.getHours()).toBe(0)
    expect(d!.getMinutes()).toBe(0)
  })

  it('handles leap years correctly', () => {
    const leap = parseLocalDate('2024-02-29')
    expect(leap).not.toBeNull()
    expect(leap!.getDate()).toBe(29)

    const nonLeap = parseLocalDate('2023-02-29')
    expect(nonLeap).toBeNull()
  })

  it('rejects invalid dates like 31st of April', () => {
    expect(parseLocalDate('2024-04-31')).toBeNull()
  })

  it('rejects empty, null, or malformed strings', () => {
    expect(parseLocalDate('')).toBeNull()
    expect(parseLocalDate('not-a-date')).toBeNull()
    expect(parseLocalDate(null as any)).toBeNull()
    expect(parseLocalDate(undefined as any)).toBeNull()
  })
})
