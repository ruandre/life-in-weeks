import {
  MILLISECONDS_PER_WEEK,
  WEEKS_PER_YEAR,
} from '../config/constants'

export { MILLISECONDS_PER_DAY, MILLISECONDS_PER_WEEK, WEEKS_PER_YEAR } from '../config/constants'

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

export function calculateTimeline(
  dobDate: Date,
  lifespanYears: number,
  now: Date = new Date(),
): Timeline {
  const totalWeeks = lifespanYears * WEEKS_PER_YEAR
  if (totalWeeks <= 0) {
    return { totalWeeks: 0, passedWeeks: 0, currentWeek: null, progressPercent: 0 }
  }

  const elapsedWeeks = Math.floor((now.getTime() - dobDate.getTime()) / MILLISECONDS_PER_WEEK)
  const passedWeeks = Math.max(0, Math.min(elapsedWeeks, totalWeeks))
  const progressPercent = (passedWeeks / totalWeeks) * 100

  const currentWeek = passedWeeks < totalWeeks ? passedWeeks + 1 : null

  return { totalWeeks, passedWeeks, currentWeek, progressPercent }
}

// 1-based; week 1 starts at dob
export function getWeekStartDate(dobDate: Date, weekIndex: number): Date {
  return new Date(dobDate.getTime() + (weekIndex - 1) * MILLISECONDS_PER_WEEK)
}

// 1-based; weekInYear is 1..52
export function getWeekAge(weekIndex: number): WeekAge {
  return {
    age: Math.floor((weekIndex - 1) / WEEKS_PER_YEAR),
    weekInYear: ((weekIndex - 1) % WEEKS_PER_YEAR) + 1,
  }
}
