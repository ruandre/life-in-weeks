export const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

export const MONTH_YEAR_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
})

// setFullYear avoids Date's 0–99 → 1900s mapping
export function localMidnight(year: number, monthIndex: number, day: number): Date {
  const date = new Date(0)
  date.setFullYear(year, monthIndex, day)
  date.setHours(0, 0, 0, 0)
  return date
}

/** Parses YYYY-MM-DD to local midnight; new Date(str) shifts day by UTC offset */
export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string')
    return null

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match)
    return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = localMidnight(year, month, day)
  const isRealDate = date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
  return isRealDate ? date : null
}

export function formatLocalIsoDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
