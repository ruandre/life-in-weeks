// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculateTimeline } from '../domain/timeline'
import { parseLocalDate } from '../lib/date'
import TimelineGrid from './TimelineGrid.svelte'

// jsdom lacks matchMedia; svelte/motion queries it on import
vi.hoisted(() => {
  window.matchMedia = query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
})

const DOB = '2000-01-01'
const LIFESPAN_YEARS = 10

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderGrid() {
  const timeline = calculateTimeline(parseLocalDate(DOB)!, LIFESPAN_YEARS, new Date(2003, 0, 1))
  render(TimelineGrid, {
    props: {
      timeline,
      dob: DOB,
      lifespan: LIFESPAN_YEARS,
      hasGenerated: true,
      isLoaded: true,
      selectedWeek: null,
      onSelectWeek: vi.fn(),
      onWarmUp: vi.fn(),
    },
  })
}

function week(index: number): HTMLElement {
  const element = document.querySelector<HTMLElement>(`.week[data-week="${index}"]`)
  if (!element)
    throw new Error(`Week ${index} not rendered`)
  return element
}

function tooltip(): HTMLElement {
  return screen.getByRole('tooltip', { hidden: true })
}

describe('timeline grid tooltip', () => {
  it('shows for the focused week', async () => {
    renderGrid()

    await fireEvent.focusIn(week(1))

    expect(tooltip().getAttribute('aria-hidden')).toBe('false')
    expect(tooltip().textContent).toContain('Age 0, week 1')
  })

  it('dismisses on Escape without moving focus', async () => {
    renderGrid()
    week(1).focus()
    await fireEvent.focusIn(week(1))

    await fireEvent.keyDown(week(1), { key: 'Escape' })

    expect(tooltip().getAttribute('aria-hidden')).toBe('true')
    expect(document.activeElement).toBe(week(1))
  })

  it('dismisses a hover tooltip on Escape while focus is elsewhere', async () => {
    renderGrid()
    await fireEvent.mouseOver(week(5))

    await fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(tooltip().getAttribute('aria-hidden')).toBe('true')
  })
})

describe('timeline grid keyboard navigation', () => {
  async function press(key: string, from: number): Promise<void> {
    week(from).focus()
    await fireEvent.focusIn(week(from))
    await fireEvent.keyDown(week(from), { key })
  }

  it('moves five rows with PageDown and makes the target the tab stop', async () => {
    renderGrid()

    await press('PageDown', 3)

    expect(document.activeElement).toBe(week(5 * 52 + 3))
    expect(week(5 * 52 + 3).tabIndex).toBe(0)
    expect(week(3).tabIndex).toBe(-1)
  })

  it('stops PageDown at the last row in the same column', async () => {
    renderGrid()

    await press('PageDown', 7 * 52 + 3)

    expect(document.activeElement).toBe(week(9 * 52 + 3))
  })

  it('stops PageUp at the first row in the same column', async () => {
    renderGrid()

    await press('PageUp', 2 * 52 + 3)

    expect(document.activeElement).toBe(week(3))
  })

  it('does not move past the grid edge with arrow keys', async () => {
    renderGrid()

    await press('ArrowUp', 3)

    expect(document.activeElement).toBe(week(3))
  })
})
