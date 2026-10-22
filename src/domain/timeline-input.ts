import { LIFESPAN_MAX_YEARS, LIFESPAN_MIN_YEARS } from '../config/constants'
import { parseLocalDate } from '../lib/date'

export function isValidLifespan(years: number): boolean {
  return Number.isInteger(years) && years >= LIFESPAN_MIN_YEARS && years <= LIFESPAN_MAX_YEARS
}

/** Local midnight of a YYYY-MM-DD birth date; null when malformed or after now */
export function parseBirthDate(dob: string, now: Date = new Date()): Date | null {
  const date = parseLocalDate(dob)
  return date && date.getTime() <= now.getTime() ? date : null
}
