import { describe, expect, it } from 'vitest'
import { formatLocalIsoDate, parseLocalDate } from '../lib/date'
import {
  calculateTimeline,
  getWeekAge,
  getWeekEndDate,
  getWeekStartDate,
  WEEKS_PER_YEAR,
} from './timeline'

describe('calculateTimeline', () => {
  it('calculates totalWeeks as lifespanYears * WEEKS_PER_YEAR', () => {
    const dob = new Date(2000, 0, 1)
    const result = calculateTimeline(dob, 80, new Date(2000, 0, 1))
    expect(result.totalWeeks).toBe(80 * WEEKS_PER_YEAR)
  })

  it('handles edge case of 0 or negative lifespan', () => {
    const dob = new Date(2000, 0, 1)
    expect(calculateTimeline(dob, 0)).toEqual({
      totalWeeks: 0,
      passedWeeks: 0,
      currentWeek: null,
      progressPercent: 0,
    })
  })

  it.each([
    ['an invalid date of birth', new Date(Number.NaN), 80],
    ['a NaN lifespan', new Date(2000, 0, 1), Number.NaN],
    ['an infinite lifespan', new Date(2000, 0, 1), Number.POSITIVE_INFINITY],
  ])('returns an empty timeline for %s', (_, dob, lifespan) => {
    expect(calculateTimeline(dob, lifespan, new Date(2020, 0, 1))).toEqual({
      totalWeeks: 0,
      passedWeeks: 0,
      currentWeek: null,
      progressPercent: 0,
    })
  })

  it('correctly computes passedWeeks and currentWeek at birth', () => {
    const dob = new Date(2000, 0, 1)
    const result = calculateTimeline(dob, 80, dob)
    expect(result.passedWeeks).toBe(0)
    expect(result.currentWeek).toBe(1)
    expect(result.progressPercent).toBe(0)
  })

  it('starts the first week of age 1 on the first birthday', () => {
    const dob = new Date(2000, 0, 1)
    const result = calculateTimeline(dob, 80, new Date(2001, 0, 1))
    expect(result.passedWeeks).toBe(52)
    expect(result.currentWeek).toBe(53)
    expect(result.progressPercent).toBeCloseTo((52 / (80 * 52)) * 100, 2)
  })

  it('stretches the 52nd week to the day before the next birthday', () => {
    const dob = new Date(2000, 0, 1)
    const result = calculateTimeline(dob, 80, new Date(2000, 11, 31))
    expect(result.currentWeek).toBe(52)
  })

  it('advances the week at local midnight across a DST change', () => {
    const dob = new Date(2025, 2, 25)
    const result = calculateTimeline(dob, 80, new Date(2025, 3, 1))
    expect(result.passedWeeks).toBe(1)
  })

  it('reports no passed weeks and no current week before birth', () => {
    const dob = new Date(2000, 0, 1)
    const result = calculateTimeline(dob, 80, new Date(1999, 11, 31))
    expect(result.passedWeeks).toBe(0)
    expect(result.currentWeek).toBeNull()
  })

  it('counts weeks for a birth year 0–99 as written', () => {
    const dob = parseLocalDate('0050-01-01')!
    const result = calculateTimeline(dob, 80, parseLocalDate('0051-01-01')!)
    expect(result.passedWeeks).toBe(WEEKS_PER_YEAR)
  })

  it('counts days across the year 99 to 100 boundary', () => {
    const dob = parseLocalDate('0099-12-18')!
    const result = calculateTimeline(dob, 80, parseLocalDate('0100-01-01')!)
    expect(result.passedWeeks).toBe(2)
  })

  it('caps passedWeeks at totalWeeks and sets currentWeek to null when lifespan exceeded', () => {
    const dob = new Date(1900, 0, 1)
    const result = calculateTimeline(dob, 50, new Date(2000, 0, 1))
    expect(result.passedWeeks).toBe(50 * WEEKS_PER_YEAR)
    expect(result.currentWeek).toBeNull()
    expect(result.progressPercent).toBe(100)
  })
})

describe('getWeekStartDate', () => {
  it('returns dob for week 1', () => {
    const dob = new Date(2000, 5, 15)
    expect(getWeekStartDate(dob, 1)).toEqual(dob)
  })

  it('offsets by whole calendar weeks within a year', () => {
    const dob = new Date(2000, 5, 15)
    expect(getWeekStartDate(dob, 2)).toEqual(new Date(2000, 5, 22))
  })

  it('stays on local midnight across a DST change', () => {
    const dob = new Date(1997, 6, 1)
    expect(getWeekStartDate(dob, 20)).toEqual(new Date(1997, 10, 11))
  })

  it('starts each year of age on the birthday', () => {
    const dob = new Date(1990, 0, 5)
    expect(getWeekStartDate(dob, 40 * WEEKS_PER_YEAR + 1)).toEqual(new Date(2030, 0, 5))
  })

  it('keeps years 0–99 literal instead of mapping them to the 1900s', () => {
    const dob = parseLocalDate('0050-03-04')!
    expect(formatLocalIsoDate(getWeekStartDate(dob, 2))).toBe('0050-03-11')
    expect(formatLocalIsoDate(getWeekStartDate(dob, WEEKS_PER_YEAR + 1))).toBe('0051-03-04')
  })
})

describe('getWeekEndDate', () => {
  it('ends six days after the week starts', () => {
    const dob = new Date(1997, 6, 1)
    expect(getWeekEndDate(dob, 20)).toEqual(new Date(1997, 10, 17))
  })

  it('ends the 52nd week the day before the next birthday', () => {
    const dob = new Date(2000, 0, 1)
    expect(getWeekEndDate(dob, 52)).toEqual(new Date(2000, 11, 31))
  })

  it('keeps years 0–99 literal', () => {
    const dob = parseLocalDate('0050-03-04')!
    expect(formatLocalIsoDate(getWeekEndDate(dob, 1))).toBe('0050-03-10')
  })
})

describe('getWeekAge', () => {
  it('returns age 0 for weeks 1 through 52', () => {
    expect(getWeekAge(1)).toEqual({ age: 0, weekInYear: 1 })
    expect(getWeekAge(52)).toEqual({ age: 0, weekInYear: 52 })
  })

  it('returns age 1 for week 53', () => {
    expect(getWeekAge(53)).toEqual({ age: 1, weekInYear: 1 })
    expect(getWeekAge(104)).toEqual({ age: 1, weekInYear: 52 })
  })

  it('returns age 20 for week 1041', () => {
    expect(getWeekAge(20 * 52 + 1)).toEqual({ age: 20, weekInYear: 1 })
  })
})
