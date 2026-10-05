<script lang='ts'>
  import type { Timeline } from '../domain/timeline'
  import { prefersReducedMotion } from 'svelte/motion'
  import { WEEKS_PER_YEAR } from '../config/constants'
  import { getWeekAge, getWeekStartDate } from '../domain/timeline'
  import { parseLocalDate } from '../lib/date'
  import Tooltip from './Tooltip.svelte'

  interface Props {
    timeline: Timeline | null
    dob: string
    lifespan: number
    hasGenerated: boolean
    isLoaded: boolean
    selectedWeek: number | null
    onSelectWeek: (weekIndex: number) => void
    onWarmUp: () => void
  }

  const {
    timeline,
    dob,
    lifespan,
    hasGenerated,
    isLoaded,
    selectedWeek,
    onSelectWeek,
    onWarmUp,
  }: Props = $props()

  let gridEl: HTMLDivElement | null = null
  let focusedWeek = $state(1)
  let warmed = false

  // Clamp prevents shrunk lifespan stranding tabindex
  const rovingWeek = $derived(
    Math.min(Math.max(focusedWeek, 1), timeline?.totalWeeks ?? 1),
  )

  let wrapperWidth = $state(0)
  let wrapperHeight = $state(0)

  function observeSize(element: HTMLElement) {
    let rafId: number | null = null

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry)
        return
      const width = Math.floor(entry.contentRect.width)
      const height = Math.floor(entry.contentRect.height)

      if (rafId !== null)
        cancelAnimationFrame(rafId)

      rafId = requestAnimationFrame(() => {
        if (width > 0 && height > 0 && (width !== wrapperWidth || height !== wrapperHeight)) {
          wrapperWidth = width
          wrapperHeight = height
        }
      })
    })

    observer.observe(element)
    return () => {
      if (rafId !== null)
        cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }

  const GAP = 2
  const YEAR_LABEL_WIDTH = 38

  // Integer size guarantees 1:1 square ratio; eliminates subpixel gap rounding
  const cellSize = $derived.by(() => {
    if (!wrapperWidth || !wrapperHeight || !lifespan)
      return 10

    const availableW = wrapperWidth - YEAR_LABEL_WIDTH - GAP
    const maxCellW = Math.floor((availableW - (WEEKS_PER_YEAR - 1) * GAP) / WEEKS_PER_YEAR)

    const availableH = wrapperHeight
    const maxCellH = Math.floor((availableH - (lifespan - 1) * GAP) / lifespan)

    const size = Math.min(maxCellW, maxCellH)
    return Math.max(5, size)
  })

  let tooltipVisible = $state(false)
  let tooltipText = $state('')
  let tooltipX = $state(0)
  let tooltipY = $state(0)

  const TOOLTIP_OFFSET = 15
  const VIEWPORT_PADDING = 8
  const ESTIMATED_TOOLTIP_WIDTH = 200
  const ESTIMATED_TOOLTIP_HEIGHT = 36

  function clampToViewport(value: number, size: number, viewportSize: number): number {
    return Math.max(VIEWPORT_PADDING, Math.min(value, viewportSize - size - VIEWPORT_PADDING))
  }

  function formatTooltipText(weekIndex: number): string {
    const { age, weekInYear } = getWeekAge(weekIndex)
    let yearText = ''
    if (dob) {
      const d = parseLocalDate(dob)
      if (d) {
        const year = getWeekStartDate(d, weekIndex).getFullYear()
        yearText = ` (${year})`
      }
    }
    return `Age ${age}, week ${weekInYear}${yearText}`
  }

  function describeWeek(weekIndex: number, dobDate: Date | null, isPassed: boolean, isCurrent: boolean): string {
    const { age, weekInYear } = getWeekAge(weekIndex)
    const year = dobDate ? getWeekStartDate(dobDate, weekIndex).getFullYear() : null

    let label = `Age ${age}, week ${weekInYear}`
    if (year)
      label += `, ${year}`
    if (isCurrent)
      label += ' (current week)'
    else if (isPassed)
      label += ' (passed)'
    return label
  }

  interface GridRow {
    yearIndex: number
    yearLabel: string
    weeks: Array<{
      index: number
      isPassed: boolean
      isCurrent: boolean
      ariaLabel: string
    }>
  }

  const gridRows = $derived.by<GridRow[]>(() => {
    if (!timeline || timeline.totalWeeks <= 0)
      return []

    const validDob = dob ? parseLocalDate(dob) : null
    const passedWeeks = timeline.passedWeeks
    const currentWeek = timeline.currentWeek
    const totalWeeks = timeline.totalWeeks
    const numYears = Math.ceil(totalWeeks / WEEKS_PER_YEAR)

    const rows: GridRow[] = []

    for (let y = 0; y < numYears; y++) {
      const firstWeekOfYear = y * WEEKS_PER_YEAR + 1
      const calendarYear = validDob
        ? validDob.getFullYear() + y
        : null
      const yearLabel = String(calendarYear ?? `Age ${y}`)

      const weeks = []
      for (let w = 0; w < WEEKS_PER_YEAR; w++) {
        const weekIndex = firstWeekOfYear + w
        if (weekIndex > totalWeeks)
          break

        const isPassed = weekIndex <= passedWeeks
        const isCurrent = currentWeek !== null && weekIndex === currentWeek

        weeks.push({
          index: weekIndex,
          isPassed,
          isCurrent,
          ariaLabel: describeWeek(weekIndex, validDob, isPassed, isCurrent),
        })
      }

      rows.push({
        yearIndex: y,
        yearLabel,
        weeks,
      })
    }

    return rows
  })

  function warmOnce(): void {
    if (warmed)
      return
    warmed = true
    onWarmUp()
  }

  function handleKeydown(e: KeyboardEvent): void {
    const target = (e.target as HTMLElement)?.closest<HTMLButtonElement>('.week')
    if (!target || !gridEl)
      return

    const currentWeek = Number(target.dataset.week)
    if (!Number.isInteger(currentWeek))
      return
    const column = (currentWeek - 1) % WEEKS_PER_YEAR

    let delta = 0
    if (e.key === 'ArrowRight')
      delta = 1
    else if (e.key === 'ArrowLeft')
      delta = -1
    else if (e.key === 'ArrowDown')
      delta = WEEKS_PER_YEAR
    else if (e.key === 'ArrowUp')
      delta = -WEEKS_PER_YEAR
    else if (e.key === 'PageDown')
      delta = WEEKS_PER_YEAR * 5
    else if (e.key === 'PageUp')
      delta = -WEEKS_PER_YEAR * 5
    else if (e.key === 'Home')
      delta = -column
    else if (e.key === 'End')
      delta = WEEKS_PER_YEAR - 1 - column
    else
      return

    const targetWeek = currentWeek + delta
    const targetEl = gridEl.querySelector<HTMLButtonElement>(`.week[data-week="${targetWeek}"]`)
    if (!targetEl)
      return

    e.preventDefault()
    focusedWeek = targetWeek
    targetEl.focus()
  }

  function handleGridClick(e: MouseEvent): void {
    const target = (e.target as HTMLElement)?.closest<HTMLButtonElement>('.week')
    if (!target)
      return
    const weekIndex = Number(target.dataset.week)
    if (Number.isInteger(weekIndex) && weekIndex >= 1) {
      focusedWeek = weekIndex
      onSelectWeek(weekIndex)
      if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
        const behavior = prefersReducedMotion.current ? 'auto' : 'smooth'
        document.getElementById('research-panel')?.scrollIntoView({ behavior, block: 'start' })
      }
    }
  }

  function handlePointerOver(e: MouseEvent): void {
    const target = (e.target as HTMLElement)?.closest<HTMLButtonElement>('.week')
    if (!target)
      return
    const weekIndex = Number(target.dataset.week)
    if (!Number.isInteger(weekIndex))
      return

    tooltipText = formatTooltipText(weekIndex)
    updatePointerTooltip(e.clientX, e.clientY)
    tooltipVisible = true
  }

  function updatePointerTooltip(clientX: number, clientY: number): void {
    const x = clientX + TOOLTIP_OFFSET
    const y = clientY + TOOLTIP_OFFSET
    const clampedX = clampToViewport(x, ESTIMATED_TOOLTIP_WIDTH, window.innerWidth)
    const clampedY = clampToViewport(y, ESTIMATED_TOOLTIP_HEIGHT, window.innerHeight)
    tooltipX = clampedX
    tooltipY = clampedY
  }

  function handlePointerMove(e: MouseEvent): void {
    if (tooltipVisible) {
      updatePointerTooltip(e.clientX, e.clientY)
    }
  }

  function handlePointerOut(e: MouseEvent): void {
    const target = (e.target as HTMLElement)?.closest<HTMLButtonElement>('.week')
    if (target) {
      tooltipVisible = false
    }
  }

  function handleFocusIn(e: FocusEvent): void {
    warmOnce()
    const target = (e.target as HTMLElement)?.closest<HTMLButtonElement>('.week')
    if (!target)
      return
    const weekIndex = Number(target.dataset.week)
    if (!Number.isInteger(weekIndex))
      return

    focusedWeek = weekIndex
    tooltipText = formatTooltipText(weekIndex)

    const rect = target.getBoundingClientRect()
    let x = rect.right + 8
    let y = rect.top
    x = clampToViewport(x, ESTIMATED_TOOLTIP_WIDTH, window.innerWidth)
    y = clampToViewport(y, ESTIMATED_TOOLTIP_HEIGHT, window.innerHeight)
    tooltipX = x
    tooltipY = y
    tooltipVisible = true
  }

  // WCAG 1.4.13: dismissible without moving pointer or focus
  function handleWindowKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && tooltipVisible)
      tooltipVisible = false
  }

  function handleFocusOut(e: FocusEvent): void {
    const target = (e.target as HTMLElement)?.closest<HTMLButtonElement>('.week')
    if (target) {
      tooltipVisible = false
    }
  }

  $effect(() => {
    if (!selectedWeek || !gridEl)
      return
    const weekEl = gridEl.querySelector<HTMLButtonElement>(`.week[data-week="${selectedWeek}"]`)
    weekEl?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<main class='main-content' id='main-content' tabindex='-1'>
  {#if !hasGenerated}
    <div
      class='empty-state'
      id='empty-state'
      aria-live='polite'
    >
      Add your date of birth, then generate to see your life in weeks.
    </div>
  {/if}

  <div
    {@attach observeSize}
    class='timeline-wrapper'
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      bind:this={gridEl}
      class={['timeline', isLoaded && 'loaded']}
      id='grid'
      role='group'
      aria-label='Life in weeks grid'
      style:--lifespan={lifespan}
      style:--cell-size='{cellSize}px'
      style:--year-col-width='{YEAR_LABEL_WIDTH}px'
      style:--gap='{GAP}px'
      onkeydown={handleKeydown}
      onclick={handleGridClick}
      onpointerenter={warmOnce}
      onmouseover={handlePointerOver}
      onmousemove={handlePointerMove}
      onmouseout={handlePointerOut}
      onfocus={handleFocusIn}
      onblur={handleFocusOut}
      onfocusin={handleFocusIn}
      onfocusout={handleFocusOut}
    >
      {#each gridRows as row (row.yearIndex)}
        <div class='year-label' aria-hidden='true'>{row.yearLabel}</div>
        {#each row.weeks as week (week.index)}
          <button
            type='button'
            class={[
              'week',
              week.isPassed && 'passed',
              week.isCurrent && 'current',
              selectedWeek === week.index && 'selected',
            ]}
            data-week={week.index}
            tabindex={rovingWeek === week.index ? 0 : -1}
            aria-pressed={selectedWeek === week.index ? 'true' : 'false'}
            aria-label={week.ariaLabel}
          ></button>
        {/each}
      {/each}
    </div>
  </div>
</main>

<Tooltip visible={tooltipVisible} text={tooltipText} x={tooltipX} y={tooltipY} />

<style>
  .main-content {
    padding: var(--space-4) var(--space-6);
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    overflow-y: auto;
    overflow-x: auto;
    position: relative;
  }

  .main-content:focus,
  .main-content:focus-visible {
    outline: none;
  }

  .timeline-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  @media (max-width: 1024px) {
    .main-content {
      padding: var(--space-6) var(--space-3);
      height: auto;
      min-height: 50vh;
      overflow-x: auto;
      overflow-y: visible;
      -webkit-overflow-scrolling: touch;
    }

    .timeline-wrapper {
      height: min(70vh, 650px);
      min-height: 400px;
    }
  }

  @media (max-width: 480px) {
    .main-content {
      padding: var(--space-4) var(--space-1);
    }

    .timeline-wrapper {
      height: min(75vh, 580px);
      min-height: 360px;
    }
  }

  .timeline {
    display: grid;
    grid-template-columns: var(--year-col-width, 38px) repeat(52, var(--cell-size, 10px));
    grid-template-rows: repeat(var(--lifespan, 70), var(--cell-size, 10px));
    gap: var(--gap, 2px);
    width: fit-content;
    height: fit-content;
    margin: auto;
    opacity: 0;
    transform: translateY(10px);
    transition:
      opacity 0.6s var(--ease-out-quart),
      transform 0.6s var(--ease-out-quart);
    will-change: opacity, transform;
    isolation: isolate;
  }

  .year-label {
    width: var(--year-col-width, 38px);
    height: var(--cell-size, 10px);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 6px;
    font-size: clamp(7px, calc(var(--cell-size, 10px) * 0.85), 11px);
    line-height: 1;
    color: var(--grey);
    font-family: monospace;
    user-select: none;
    white-space: nowrap;
    box-sizing: border-box;
  }

  .timeline.loaded {
    opacity: 1;
    transform: translateY(0);
  }

  .week {
    width: var(--cell-size, 10px);
    height: var(--cell-size, 10px);
    aspect-ratio: 1 / 1;
    box-sizing: border-box;
    appearance: none;
    font: inherit;
    background: transparent;
    border: 1px solid var(--control-border);
    cursor: pointer;
    forced-color-adjust: none;
    padding: 0;
    transition:
      transform 0.2s var(--ease-out-quint),
      background-color 0.2s var(--ease-out-quint),
      border-color 0.2s var(--ease-out-quint),
      box-shadow 0.2s var(--ease-out-quint),
      border-radius 0.2s var(--ease-out-quint);
  }

  .week:hover,
  .week:focus-visible {
    transform: scale(1.8);
    background-color: var(--grey-dark);
    border-color: var(--fg);
    box-shadow: var(--hover-shadow);
    border-radius: 2px;
    position: relative;
    z-index: 1;
  }

  .week:focus-visible {
    outline: 2px solid var(--fg);
    outline-offset: 2px;
    scroll-margin: var(--space-8);
  }

  .week.passed {
    background: var(--accent);
    border: none;
    box-shadow: none;
  }

  .week.passed:hover,
  .week.passed:focus-visible {
    background-color: var(--accent);
    border: 1px solid var(--fg);
    box-shadow: color-mix(in oklch, var(--accent) 40%, transparent) 0 4px 12px;
  }

  .week.current {
    background: var(--fg);
    border: 1px solid var(--fg);
    box-shadow: var(--current-glow);
    position: relative;
    z-index: 1;
  }

  .week.current:hover,
  .week.current:focus-visible {
    transform: scale(2.2);
    box-shadow: var(--current-glow-hover);
    z-index: 2;
  }

  .week.selected {
    transform: scale(1.8);
    background-color: var(--grey-dark);
    border: 1px solid var(--accent);
    border-radius: 2px;
    box-shadow: color-mix(in oklch, var(--accent) 50%, transparent) 0 0 0 2px inset;
    z-index: 2;
  }

  .week.selected:hover,
  .week.selected:focus-visible {
    transform: scale(2.2);
  }

  .week.selected.passed {
    background-color: var(--accent);
    border: 1px solid var(--accent);
    box-shadow: oklch(0.9702 0 0 / 0.8) 0 0 0 2px inset;
  }

  .empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: var(--grey);
    text-align: center;
    pointer-events: none;
  }
</style>
