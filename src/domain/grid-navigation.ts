import { WEEKS_PER_YEAR } from '../config/constants'

export const PAGE_ROWS = 5

export type NavigationKey = Pick<KeyboardEvent, 'key' | 'ctrlKey'>

function clampRow(row: number, lastRow: number): number {
  return Math.min(Math.max(row, 0), lastRow)
}

/** Week a grid shortcut moves to; null for other keys or moves off the grid */
export function findTargetWeek({ key, ctrlKey }: NavigationKey, week: number, totalWeeks: number): number | null {
  const row = Math.floor((week - 1) / WEEKS_PER_YEAR)
  const column = (week - 1) % WEEKS_PER_YEAR
  const lastRow = Math.ceil(totalWeeks / WEEKS_PER_YEAR) - 1
  const weekInRow = (targetRow: number) => clampRow(targetRow, lastRow) * WEEKS_PER_YEAR + column + 1

  const moves: Record<string, () => number> = {
    'ArrowRight': () => week + 1,
    'ArrowLeft': () => week - 1,
    'ArrowDown': () => week + WEEKS_PER_YEAR,
    'ArrowUp': () => week - WEEKS_PER_YEAR,
    'PageDown': () => weekInRow(row + PAGE_ROWS),
    'PageUp': () => weekInRow(row - PAGE_ROWS),
    'Home': () => week - column,
    'End': () => week + WEEKS_PER_YEAR - 1 - column,
    'Ctrl+Home': () => 1,
    'Ctrl+End': () => totalWeeks,
  }
  const shortcut = ctrlKey ? `Ctrl+${key}` : key
  // Ctrl+Arrow etc. fall back to the unmodified move
  // eslint-disable-next-line security/detect-object-injection -- lookup on local literal map, unknown keys yield null
  const target = (moves[shortcut] ?? moves[key])?.()
  if (target === undefined || target < 1 || target > totalWeeks)
    return null
  return target
}
