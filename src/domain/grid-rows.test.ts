import { describe, expect, it } from 'vitest'
import { buildGridRows } from './grid-rows'
import { calculateTimeline } from './timeline'

const LIFESPAN_YEARS = 10
const NOW = new Date(2003, 0, 1)

function rows(dob: Date | null = new Date(2000, 0, 1)) {
  const timeline = calculateTimeline(dob ?? new Date(2000, 0, 1), LIFESPAN_YEARS, NOW)
  return buildGridRows(timeline, dob)
}

describe('buildGridRows', () => {
  it('returns no rows without a timeline', () => {
    expect(buildGridRows(null, new Date(2000, 0, 1))).toEqual([])
  })

  it('builds one row per year with 52 weeks each', () => {
    const built = rows()
    expect(built).toHaveLength(LIFESPAN_YEARS)
    expect(built.every(row => row.weeks.length === 52)).toBe(true)
    expect(built[0]!.weeks[0]!.index).toBe(1)
    expect(built[9]!.weeks[51]!.index).toBe(LIFESPAN_YEARS * 52)
  })

  it('labels rows with the calendar year when the date of birth is known', () => {
    expect(rows()[3]!.yearLabel).toBe('2003')
  })

  it('labels rows with the age when the date of birth is unknown', () => {
    expect(rows(null)[3]!.yearLabel).toBe('Age 3')
  })

  it('flags passed weeks and the current week', () => {
    const built = rows()
    const currentWeek = 3 * 52 + 1
    expect(built[2]!.weeks[51]!.isPassed).toBe(true)
    expect(built[3]!.weeks[0]).toMatchObject({ index: currentWeek, isPassed: false, isCurrent: true })
    expect(built[3]!.weeks[1]!.isCurrent).toBe(false)
  })

  it('describes a week by age and week, adding passed state', () => {
    const built = rows()
    expect(built[0]!.weeks[0]!.ariaLabel).toBe('Age 0, week 1 (passed)')
    expect(built[3]!.weeks[0]!.ariaLabel).toBe('Age 3, week 1')
  })

  it('names the calendar year only when it differs from the row header year', () => {
    const built = rows(new Date(2000, 6, 1))
    expect(built[0]!.weeks[0]!.ariaLabel).toBe('Age 0, week 1 (passed)')
    expect(built[0]!.weeks[29]!.ariaLabel).toBe('Age 0, week 30, 2001 (passed)')
  })
})
