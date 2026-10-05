import { MILLISECONDS_PER_DAY, WEEKS_PER_YEAR } from '../config/constants'
import { localMidnight } from '../lib/date'

export { WEEKS_PER_YEAR } from '../config/constants'

export interface Timeline {
  totalWeeks: number
  passedWeeks: number
  currentWeek: number | null
  progressPercent: number
}

export interface WeekAge {
  age: number
  weekInYear: number
}

const DAYS_PER_WEEK = 7

// Calendar arithmetic keeps local midnight across DST changes
function addDays(date: Date, days: number): Date {
  return localMidnight(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

// Feb 29 birthdays fall on Mar 1 in common years
function getBirthday(dobDate: Date, age: number): Date {
  return localMidnight(dobDate.getFullYear() + age, dobDate.getMonth(), dobDate.getDate())
}

// setUTCFullYear avoids Date.UTC's 0–99 → 1900s mapping
function utcDayStart(date: Date): number {
  const utc = new Date(0)
  utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate())
  return utc.getTime()
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((utcDayStart(to) - utcDayStart(from)) / MILLISECONDS_PER_DAY)
}

function getAgeInYears(dobDate: Date, now: Date): number {
  const age = now.getFullYear() - dobDate.getFullYear()
  return getBirthday(dobDate, age) > now ? age - 1 : age
}

// Each row of age starts on a birthday; week 52 runs to the day before the next one
function countPassedWeeks(dobDate: Date, now: Date): number {
  const age = getAgeInYears(dobDate, now)
  if (age < 0)
    return 0
  const daysSinceBirthday = calendarDaysBetween(getBirthday(dobDate, age), now)
  const weeksIntoYear = Math.min(Math.floor(daysSinceBirthday / DAYS_PER_WEEK), WEEKS_PER_YEAR - 1)
  return age * WEEKS_PER_YEAR + weeksIntoYear
}

export function calculateTimeline(
  dobDate: Date,
  lifespanYears: number,
  now: Date = new Date(),
): Timeline {
  const totalWeeks = lifespanYears * WEEKS_PER_YEAR
  if (totalWeeks <= 0) {
    return { totalWeeks: 0, passedWeeks: 0, currentWeek: null, progressPercent: 0 }
  }

  const isBorn = now >= dobDate
  const passedWeeks = Math.min(countPassedWeeks(dobDate, now), totalWeeks)
  const progressPercent = (passedWeeks / totalWeeks) * 100

  const currentWeek = isBorn && passedWeeks < totalWeeks ? passedWeeks + 1 : null

  return { totalWeeks, passedWeeks, currentWeek, progressPercent }
}

// 1-based; week 1 starts at dob
export function getWeekStartDate(dobDate: Date, weekIndex: number): Date {
  const { age, weekInYear } = getWeekAge(weekIndex)
  return addDays(getBirthday(dobDate, age), (weekInYear - 1) * DAYS_PER_WEEK)
}

// 1-based; inclusive last day of the week
export function getWeekEndDate(dobDate: Date, weekIndex: number): Date {
  return addDays(getWeekStartDate(dobDate, weekIndex + 1), -1)
}

// 1-based; weekInYear is 1..52
export function getWeekAge(weekIndex: number): WeekAge {
  return {
    age: Math.floor((weekIndex - 1) / WEEKS_PER_YEAR),
    weekInYear: ((weekIndex - 1) % WEEKS_PER_YEAR) + 1,
  }
}
