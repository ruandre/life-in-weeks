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
