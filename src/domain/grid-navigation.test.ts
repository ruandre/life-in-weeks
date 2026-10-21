import { describe, expect, it } from 'vitest'
import { findTargetWeek, PAGE_ROWS } from './grid-navigation'

const TOTAL_WEEKS = 10 * 52

function target(key: string, week: number, ctrlKey = false): number | null {
  return findTargetWeek({ key, ctrlKey }, week, TOTAL_WEEKS)
}

describe('findTargetWeek', () => {
  it.each([
    ['ArrowRight', 3, 4],
    ['ArrowLeft', 3, 2],
    ['ArrowDown', 3, 55],
    ['ArrowUp', 55, 3],
    ['Home', 30, 1],
    ['End', 30, 52],
    ['PageDown', 3, PAGE_ROWS * 52 + 3],
    ['PageUp', PAGE_ROWS * 52 + 3, 3],
  ])('%s from week %i lands on week %i', (key, from, expected) => {
    expect(target(key, from)).toBe(expected)
  })

  it('wraps ArrowRight onto the next row', () => {
    expect(target('ArrowRight', 52)).toBe(53)
  })

  it.each([
    ['ArrowLeft', 1],
    ['ArrowRight', TOTAL_WEEKS],
    ['ArrowUp', 3],
    ['ArrowDown', TOTAL_WEEKS - 3],
  ])('returns null when %s would leave the grid from week %i', (key, from) => {
    expect(target(key, from)).toBeNull()
  })

  it('clamps PageDown to the last row in the same column', () => {
    expect(target('PageDown', 7 * 52 + 3)).toBe(9 * 52 + 3)
  })

  it('clamps PageUp to the first row in the same column', () => {
    expect(target('PageUp', 2 * 52 + 3)).toBe(3)
  })

  it('jumps to the first and last week with Ctrl+Home and Ctrl+End', () => {
    expect(target('Home', 4 * 52 + 30, true)).toBe(1)
    expect(target('End', 30, true)).toBe(TOTAL_WEEKS)
  })

  it('treats Ctrl with an arrow like the plain arrow', () => {
    expect(target('ArrowRight', 3, true)).toBe(4)
  })

  it('returns null for keys that do not navigate', () => {
    expect(target('a', 3)).toBeNull()
    expect(target('Tab', 3)).toBeNull()
  })
})
