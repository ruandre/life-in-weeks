import type { Timeline } from './timeline'
import { WEEKS_PER_YEAR } from '../config/constants'
import { getWeekAge, getWeekStartDate } from './timeline'

export interface GridWeek {
  index: number
  isPassed: boolean
  isCurrent: boolean
  ariaLabel: string
}

export interface GridRow {
  yearIndex: number
  yearLabel: string
  weeks: GridWeek[]
}

// Row header announces its year; cell names only a later calendar year
function describeWeek(weekIndex: number, isPassed: boolean, yearPastRowHeader: number | null): string {
  const { age, weekInYear } = getWeekAge(weekIndex)
  const yearText = yearPastRowHeader === null ? '' : `, ${yearPastRowHeader}`
  const statusText = isPassed ? ' (passed)' : ''
  return `Age ${age}, week ${weekInYear}${yearText}${statusText}`
}

function buildWeek(timeline: Timeline, dob: Date | null, weekIndex: number, rowYear: number | null): GridWeek {
  const isPassed = weekIndex <= timeline.passedWeeks
  const weekYear = dob ? getWeekStartDate(dob, weekIndex).getFullYear() : null
  const yearPastRowHeader = weekYear === rowYear ? null : weekYear
  return {
    index: weekIndex,
    isPassed,
    isCurrent: weekIndex === timeline.currentWeek,
    ariaLabel: describeWeek(weekIndex, isPassed, yearPastRowHeader),
  }
}

function buildRow(timeline: Timeline, dob: Date | null, yearIndex: number): GridRow {
  const rowYear = dob ? dob.getFullYear() + yearIndex : null
  const firstWeek = yearIndex * WEEKS_PER_YEAR + 1
  const lastWeek = Math.min(firstWeek + WEEKS_PER_YEAR - 1, timeline.totalWeeks)
  const weeks: GridWeek[] = []
  for (let weekIndex = firstWeek; weekIndex <= lastWeek; weekIndex++)
    weeks.push(buildWeek(timeline, dob, weekIndex, rowYear))
  return { yearIndex, yearLabel: rowYear === null ? `Age ${yearIndex}` : String(rowYear), weeks }
}

/** One row per year of age; dob null falls back to age labels */
export function buildGridRows(timeline: Timeline | null, dob: Date | null): GridRow[] {
  if (!timeline || timeline.totalWeeks <= 0)
    return []
  const yearCount = Math.ceil(timeline.totalWeeks / WEEKS_PER_YEAR)
  return Array.from({ length: yearCount }, (_, yearIndex) => buildRow(timeline, dob, yearIndex))
}
