import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatLocalIsoDate, MONTH_YEAR_FORMAT, parseLocalDate } from './date'

describe('parseLocalDate', () => {
  it('parses standard YYYY-MM-DD to local midnight', () => {
    const d = parseLocalDate('2024-03-15')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(2) // 0-indexed March
    expect(d!.getDate()).toBe(15)
    expect(d!.getHours()).toBe(0)
    expect(d!.getMinutes()).toBe(0)
  })

  it('handles leap years correctly', () => {
    const leap = parseLocalDate('2024-02-29')
    expect(leap).not.toBeNull()
    expect(leap!.getDate()).toBe(29)

    const nonLeap = parseLocalDate('2023-02-29')
    expect(nonLeap).toBeNull()
  })

  it('rejects invalid dates like 31st of April', () => {
    expect(parseLocalDate('2024-04-31')).toBeNull()
  })

  it('rejects empty, null, or malformed strings', () => {
    expect(parseLocalDate('')).toBeNull()
    expect(parseLocalDate('not-a-date')).toBeNull()
    expect(parseLocalDate(null as any)).toBeNull()
    expect(parseLocalDate(undefined as any)).toBeNull()
  })

  // new Date() would read these as instants and land on the previous day west of UTC
  it.each(['2000-01-01T00:00:00Z', 'March 15, 2024', '2024/03/15'])('rejects non-ISO calendar date %s', (input) => {
    expect(parseLocalDate(input)).toBeNull()
  })

  it('parses years 0-99 literally, not as 1900s', () => {
    const d = parseLocalDate('0050-03-04')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(50)
    expect(d!.getMonth()).toBe(2)
    expect(d!.getDate()).toBe(4)
    expect(d!.getHours()).toBe(0)
  })
})

describe('parseLocalDate with Temporal', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubTemporal() {
    vi.stubGlobal('Temporal', {
      PlainDate: {
        from: (dateStr: string) => {
          const [year, month, day] = dateStr.split('-').map(Number)
          return { year, month, day }
        },
      },
    })
  }

  it('parses standard YYYY-MM-DD to local midnight', () => {
    stubTemporal()
    const d = parseLocalDate('2024-03-15')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2024)
    expect(d!.getMonth()).toBe(2)
    expect(d!.getDate()).toBe(15)
    expect(d!.getHours()).toBe(0)
    expect(d!.getMinutes()).toBe(0)
  })

  it('parses years 0-99 literally, not as 1900s', () => {
    stubTemporal()
    const d = parseLocalDate('0050-03-04')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(50)
    expect(d!.getMonth()).toBe(2)
    expect(d!.getDate()).toBe(4)
    expect(d!.getHours()).toBe(0)
  })
})

describe('formatLocalIsoDate', () => {
  it('formats the local calendar date, not the UTC one', () => {
    const justAfterLocalMidnight = new Date(2026, 9, 3, 0, 30)
    expect(formatLocalIsoDate(justAfterLocalMidnight)).toBe('2026-10-03')
  })

  it('zero-pads month and day', () => {
    expect(formatLocalIsoDate(new Date(987, 0, 5))).toBe('0987-01-05')
  })

  it('round-trips years 0-99 through parseLocalDate', () => {
    expect(formatLocalIsoDate(parseLocalDate('0050-03-04')!)).toBe('0050-03-04')
  })
})

describe('month-year format', () => {
  it('formats a three-letter month and the year', () => {
    expect(MONTH_YEAR_FORMAT.format(new Date(1998, 0, 14))).toBe('Jan 1998')
    expect(MONTH_YEAR_FORMAT.format(new Date(1998, 8, 1))).toBe('Sep 1998')
  })
})
