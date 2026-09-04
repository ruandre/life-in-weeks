import { describe, expect, it } from 'vitest'
import {
  calculateTimeline,
  getWeekAge,
  getWeekStartDate,
  MILLISECONDS_PER_WEEK,
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

  it('correctly computes passedWeeks and currentWeek at birth', () => {
    const dob = new Date(2000, 0, 1)
    const result = calculateTimeline(dob, 80, dob)
    expect(result.passedWeeks).toBe(0)
    expect(result.currentWeek).toBe(1)
    expect(result.progressPercent).toBe(0)
  })

  it('correctly calculates elapsed weeks after 52 weeks', () => {
    const dob = new Date(2000, 0, 1)
    const exactly52WeeksLater = new Date(dob.getTime() + 52 * MILLISECONDS_PER_WEEK)
    const result = calculateTimeline(dob, 80, exactly52WeeksLater)
    expect(result.passedWeeks).toBe(52)
    expect(result.currentWeek).toBe(53)
    expect(result.progressPercent).toBeCloseTo((52 / (80 * 52)) * 100, 2)
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
    expect(getWeekStartDate(dob, 1).getTime()).toBe(dob.getTime())
  })

  it('offsets correctly for week 2 and beyond', () => {
    const dob = new Date(2000, 5, 15)
    expect(getWeekStartDate(dob, 2).getTime()).toBe(dob.getTime() + MILLISECONDS_PER_WEEK)
    expect(getWeekStartDate(dob, 53).getTime()).toBe(dob.getTime() + 52 * MILLISECONDS_PER_WEEK)
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
