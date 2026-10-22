import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LIFESPAN_MAX_YEARS, LIFESPAN_MIN_YEARS } from '../config/constants'
import { formatLocalIsoDate, localMidnight } from '../lib/date'
import { isValidLifespan, parseBirthDate } from './timeline-input'

const NOW = new Date(2026, 9, 22, 15, 30)

describe('isValidLifespan', () => {
  it.each([LIFESPAN_MIN_YEARS, 70, LIFESPAN_MAX_YEARS])('accepts %d years', (years) => {
    expect(isValidLifespan(years)).toBe(true)
  })

  it.each([
    ['below the minimum', LIFESPAN_MIN_YEARS - 1],
    ['above the maximum', LIFESPAN_MAX_YEARS + 1],
    ['a fraction', 70.5],
    ['NaN', Number.NaN],
    ['an empty number input', null],
  ])('rejects %s', (_, years) => {
    expect(isValidLifespan(years as number)).toBe(false)
  })

  it('accepts exactly the whole numbers in range', () => {
    fc.assert(fc.property(fc.double(), (years) => {
      const isInRange = Number.isInteger(years) && years >= LIFESPAN_MIN_YEARS && years <= LIFESPAN_MAX_YEARS
      expect(isValidLifespan(years)).toBe(isInRange)
    }))
  })
})

describe('parseBirthDate', () => {
  it('parses a past date to local midnight', () => {
    expect(parseBirthDate('2000-01-31', NOW)).toEqual(new Date(2000, 0, 31))
  })

  it('accepts today', () => {
    expect(parseBirthDate('2026-10-22', NOW)).toEqual(new Date(2026, 9, 22))
  })

  it.each([
    ['tomorrow', '2026-10-23'],
    ['an impossible date', '2001-02-29'],
    ['a malformed string', '22/10/2000'],
    ['an empty string', ''],
  ])('rejects %s', (_, dob) => {
    expect(parseBirthDate(dob, NOW)).toBeNull()
  })

  it('accepts a date exactly when it is not after today', () => {
    const date = fc.date({ min: localMidnight(1, 0, 1), max: localMidnight(9999, 11, 31), noInvalidDate: true })
      .map(d => localMidnight(d.getFullYear(), d.getMonth(), d.getDate()))
    fc.assert(fc.property(date, (birth) => {
      const isFuture = birth.getTime() > NOW.getTime()
      expect(parseBirthDate(formatLocalIsoDate(birth), NOW) === null).toBe(isFuture)
    }))
  })
})
