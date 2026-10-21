import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { LIFESPAN_MAX_YEARS, LIFESPAN_MIN_YEARS, MILLISECONDS_PER_DAY } from '../config/constants'
import { localMidnight } from '../lib/date'
import { calculateTimeline, getWeekAge, getWeekEndDate, getWeekStartDate, WEEKS_PER_YEAR } from './timeline'

const dob = fc.record({
  year: fc.integer({ min: 1900, max: 2100 }),
  monthIndex: fc.integer({ min: 0, max: 11 }),
  day: fc.integer({ min: 1, max: 31 }),
}).map(({ year, monthIndex, day }) => localMidnight(year, monthIndex, day))

const lifespan = fc.integer({ min: LIFESPAN_MIN_YEARS, max: LIFESPAN_MAX_YEARS })
const weekIndex = fc.integer({ min: 1, max: LIFESPAN_MAX_YEARS * WEEKS_PER_YEAR })
const daysAlive = fc.integer({ min: 0, max: LIFESPAN_MAX_YEARS * 366 })

function addDays(date: Date, days: number): Date {
  return localMidnight(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / MILLISECONDS_PER_DAY)
}

describe('week date properties', () => {
  it('ends every week the day before the next one starts', () => {
    fc.assert(fc.property(dob, weekIndex, (birth, week) => {
      expect(getWeekEndDate(birth, week).getTime()).toBe(addDays(getWeekStartDate(birth, week + 1), -1).getTime())
    }))
  })

  it('gives weeks 1 to 51 of each age exactly seven days', () => {
    fc.assert(fc.property(dob, weekIndex, (birth, week) => {
      fc.pre(getWeekAge(week).weekInYear < WEEKS_PER_YEAR)
      expect(calendarDaysBetween(getWeekStartDate(birth, week), getWeekEndDate(birth, week))).toBe(6)
    }))
  })

  it('starts every week at local midnight, strictly after the previous week', () => {
    fc.assert(fc.property(dob, weekIndex, (birth, week) => {
      const start = getWeekStartDate(birth, week)
      expect([start.getHours(), start.getMinutes()]).toEqual([0, 0])
      expect(start.getTime()).toBeGreaterThan(getWeekStartDate(birth, week - 1).getTime())
    }))
  })

  it('maps every week index to an age and week that rebuild it', () => {
    fc.assert(fc.property(weekIndex, (week) => {
      const { age, weekInYear } = getWeekAge(week)
      expect(weekInYear).toBeGreaterThanOrEqual(1)
      expect(weekInYear).toBeLessThanOrEqual(WEEKS_PER_YEAR)
      expect(age * WEEKS_PER_YEAR + weekInYear).toBe(week)
    }))
  })
})

describe('timeline properties', () => {
  it('keeps passed weeks within bounds and derives current week and progress from them', () => {
    fc.assert(fc.property(dob, lifespan, daysAlive, (birth, years, days) => {
      const now = addDays(birth, days)
      const { totalWeeks, passedWeeks, currentWeek, progressPercent } = calculateTimeline(birth, years, now)
      expect(totalWeeks).toBe(years * WEEKS_PER_YEAR)
      expect(passedWeeks).toBeGreaterThanOrEqual(0)
      expect(passedWeeks).toBeLessThanOrEqual(totalWeeks)
      expect(currentWeek).toBe(passedWeeks < totalWeeks ? passedWeeks + 1 : null)
      expect(progressPercent).toBeCloseTo((passedWeeks / totalWeeks) * 100, 10)
    }))
  })

  it('places today inside the current week\'s date range', () => {
    fc.assert(fc.property(dob, lifespan, daysAlive, (birth, years, days) => {
      const now = addDays(birth, days)
      const { currentWeek } = calculateTimeline(birth, years, now)
      fc.pre(currentWeek !== null)
      expect(getWeekStartDate(birth, currentWeek!).getTime()).toBeLessThanOrEqual(now.getTime())
      expect(getWeekEndDate(birth, currentWeek!).getTime()).toBeGreaterThanOrEqual(now.getTime())
    }))
  })

  it('never counts fewer passed weeks on a later day', () => {
    fc.assert(fc.property(dob, lifespan, daysAlive, (birth, years, days) => {
      const today = calculateTimeline(birth, years, addDays(birth, days)).passedWeeks
      const tomorrow = calculateTimeline(birth, years, addDays(birth, days + 1)).passedWeeks
      expect(tomorrow).toBeGreaterThanOrEqual(today)
      expect(tomorrow - today).toBeLessThanOrEqual(1)
    }))
  })
})
