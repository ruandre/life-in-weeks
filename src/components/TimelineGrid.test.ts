// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/svelte'
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
  // jsdom lacks scrollIntoView; grid scrolls selected week into view
  Element.prototype.scrollIntoView = () => {}
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

function renderGrid({ dob = DOB, selectedWeek = null as number | null } = {}) {
  const timeline = calculateTimeline(parseLocalDate(dob)!, LIFESPAN_YEARS, new Date(2003, 0, 1))
  const onSelectWeek = vi.fn()
  const props = {
    timeline,
    dob,
    lifespan: LIFESPAN_YEARS,
    hasGenerated: true,
    isLoaded: true,
    selectedWeek,
    onSelectWeek,
    onWarmUp: vi.fn(),
  }
  const { rerender } = render(TimelineGrid, { props })
  const selectWeek = (weekIndex: number) => rerender({ ...props, selectedWeek: weekIndex })
  return { onSelectWeek, selectWeek }
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
  async function press(key: string, from: number, modifiers: { ctrlKey?: boolean } = {}): Promise<void> {
    week(from).focus()
    await fireEvent.focusIn(week(from))
    await fireEvent.keyDown(week(from), { key, ...modifiers })
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

  it('jumps to the first week with Ctrl+Home', async () => {
    renderGrid()

    await press('Home', 4 * 52 + 30, { ctrlKey: true })

    expect(document.activeElement).toBe(week(1))
  })

  it('jumps to the last week with Ctrl+End', async () => {
    renderGrid()

    await press('End', 30, { ctrlKey: true })

    expect(document.activeElement).toBe(week(LIFESPAN_YEARS * 52))
  })

  it('does not move past the grid edge with arrow keys', async () => {
    renderGrid()

    await press('ArrowUp', 3)

    expect(document.activeElement).toBe(week(3))
  })
})

describe('timeline grid semantics', () => {
  it('exposes one row per year of age with a year header and 52 cells', () => {
    renderGrid()

    const rows = within(screen.getByRole('grid', { name: 'Life in weeks' })).getAllByRole('row')

    expect(rows).toHaveLength(LIFESPAN_YEARS)
    expect(within(rows[3]!).getByRole('rowheader').textContent).toBe('2003')
    expect(within(rows[3]!).getAllByRole('gridcell')).toHaveLength(52)
  })

  it('marks only the selected week as selected', async () => {
    const { selectWeek } = renderGrid()

    await selectWeek(60)

    expect(week(60).getAttribute('aria-selected')).toBe('true')
    expect(week(61).getAttribute('aria-selected')).toBe('false')
  })

  it('keeps one tab stop when a week is selected', async () => {
    const { selectWeek } = renderGrid()

    await selectWeek(60)

    expect(document.querySelectorAll('.week[tabindex="0"]')).toHaveLength(1)
  })
})

describe('timeline grid selection', () => {
  it('selects the clicked week', async () => {
    const { onSelectWeek } = renderGrid()

    await fireEvent.click(week(12))

    expect(onSelectWeek).toHaveBeenCalledWith(12)
  })

  it.each(['Enter', ' '])('selects the focused week with %j', async (key) => {
    const { onSelectWeek } = renderGrid()
    week(12).focus()

    await fireEvent.keyDown(week(12), { key })

    expect(onSelectWeek).toHaveBeenCalledWith(12)
  })

  it('ignores auto-repeated activation keys', async () => {
    const { onSelectWeek } = renderGrid()

    await fireEvent.keyDown(week(12), { key: 'Enter', repeat: true })

    expect(onSelectWeek).not.toHaveBeenCalled()
  })

  it('stops Space from scrolling the page', async () => {
    renderGrid()

    const isNotCancelled = await fireEvent.keyDown(week(12), { key: ' ' })

    expect(isNotCancelled).toBe(false)
  })
})

describe('timeline grid week labels', () => {
  const CURRENT_WEEK = 3 * 52 + 1

  it('marks the current week with aria-current instead of label text', () => {
    renderGrid()

    expect(week(CURRENT_WEEK).getAttribute('aria-current')).toBe('date')
    expect(week(CURRENT_WEEK).getAttribute('aria-label')).toBe('Age 3, week 1')
    expect(week(CURRENT_WEEK + 1).hasAttribute('aria-current')).toBe(false)
  })

  it('leaves the year to the row header when the week falls in it', () => {
    renderGrid({ dob: '2000-07-01' })

    expect(week(1).getAttribute('aria-label')).toBe('Age 0, week 1 (passed)')
  })

  it('names the year when the week falls past the row header year', () => {
    renderGrid({ dob: '2000-07-01' })

    expect(week(30).getAttribute('aria-label')).toBe('Age 0, week 30, 2001 (passed)')
  })
})

describe('selection in the stacked layout', () => {
  function stubLayout({ isStacked }: { isStacked: boolean }): void {
    const matchMedia = window.matchMedia
    vi.spyOn(window, 'matchMedia').mockImplementation(query => ({
      ...matchMedia(query),
      matches: isStacked && query === '(max-width: 1024px)',
    }))
  }

  function addResearchPanel(): HTMLElement {
    const panel = document.createElement('aside')
    panel.id = 'research-panel'
    panel.scrollIntoView = vi.fn()
    document.body.append(panel)
    return panel
  }

  afterEach(() => {
    document.getElementById('research-panel')?.remove()
    vi.restoreAllMocks()
  })

  it('scrolls the research panel into view when panels stack', async () => {
    stubLayout({ isStacked: true })
    const panel = addResearchPanel()
    renderGrid()

    await fireEvent.click(week(12))

    expect(panel.scrollIntoView).toHaveBeenCalled()
  })

  it('leaves the page in place when panels sit side by side', async () => {
    stubLayout({ isStacked: false })
    const panel = addResearchPanel()
    renderGrid()

    await fireEvent.click(week(12))

    expect(panel.scrollIntoView).not.toHaveBeenCalled()
  })
})
