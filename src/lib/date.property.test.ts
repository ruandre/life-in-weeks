import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { formatLocalIsoDate, localMidnight, parseLocalDate } from './date'

const calendarDate = fc.record({
  year: fc.integer({ min: 1, max: 9999 }),
  monthIndex: fc.integer({ min: 0, max: 11 }),
  day: fc.integer({ min: 1, max: 28 }),
}).map(({ year, monthIndex, day }) => localMidnight(year, monthIndex, day))

describe('date properties', () => {
  it('round-trips any calendar date through format and parse', () => {
    fc.assert(fc.property(calendarDate, (date) => {
      expect(parseLocalDate(formatLocalIsoDate(date))?.getTime()).toBe(date.getTime())
    }))
  })

  it('never throws and only yields local midnight for arbitrary input', () => {
    fc.assert(fc.property(fc.string(), (input) => {
      const parsed = parseLocalDate(input)
      if (parsed === null)
        return
      expect(Number.isNaN(parsed.getTime())).toBe(false)
      expect([parsed.getHours(), parsed.getMinutes(), parsed.getSeconds()]).toEqual([0, 0, 0])
      expect(formatLocalIsoDate(parsed)).toBe(input)
    }))
  })
})
