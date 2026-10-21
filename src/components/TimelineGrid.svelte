<script lang='ts'>
  import type { Timeline } from '../domain/timeline'
  import { prefersReducedMotion } from 'svelte/motion'
  import { WEEKS_PER_YEAR } from '../config/constants'
  import { findTargetWeek } from '../domain/grid-navigation'
  import { buildGridRows } from '../domain/grid-rows'
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

  // Integer size guarantees 1:1 square ratio; eliminates subpixel gap rounding
  const cellSize = $derived.by(() => {
    if (!wrapperWidth || !wrapperHeight || !lifespan)
      return 10

    const maxCellW = Math.floor((wrapperWidth - (WEEKS_PER_YEAR - 1) * GAP) / WEEKS_PER_YEAR)

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

  const dobDate = $derived(parseLocalDate(dob))
  const gridRows = $derived(buildGridRows(timeline, dobDate))

  function formatTooltipText(weekIndex: number): string {
    const { age, weekInYear } = getWeekAge(weekIndex)
    const yearText = dobDate ? ` (${getWeekStartDate(dobDate, weekIndex).getFullYear()})` : ''
    return `Age ${age}, week ${weekInYear}${yearText}`
  }

  function warmOnce(): void {
    if (warmed)
      return
    warmed = true
    onWarmUp()
  }

  const ACTIVATION_KEYS = new Set(['Enter', ' '])

  function handleKeydown(e: KeyboardEvent): void {
    const target = (e.target as HTMLElement)?.closest<HTMLElement>('.week')
    if (!target || !gridEl)
      return

    const currentWeek = Number(target.dataset.week)
    if (!Number.isInteger(currentWeek))
      return

    if (ACTIVATION_KEYS.has(e.key)) {
      // Space would scroll the page; repeats would restart research every tick
      e.preventDefault()
      if (!e.repeat)
        selectWeek(currentWeek)
      return
    }

    const targetWeek = findTargetWeek(e, currentWeek, timeline?.totalWeeks ?? 0)
    if (targetWeek === null)
      return
    const targetEl = gridEl.querySelector<HTMLElement>(`.week[data-week="${targetWeek}"]`)
    if (!targetEl)
      return

    e.preventDefault()
    focusedWeek = targetWeek
    targetEl.focus()
  }

  function selectWeek(weekIndex: number): void {
    if (!Number.isInteger(weekIndex) || weekIndex < 1)
      return
    focusedWeek = weekIndex
    onSelectWeek(weekIndex)
    if (window.innerWidth <= 1024) {
      const behavior = prefersReducedMotion.current ? 'auto' : 'smooth'
      document.getElementById('research-panel')?.scrollIntoView({ behavior, block: 'start' })
    }
  }

  function handleGridClick(e: MouseEvent): void {
    const target = (e.target as HTMLElement)?.closest<HTMLElement>('.week')
    if (target)
      selectWeek(Number(target.dataset.week))
  }

  function handlePointerOver(e: MouseEvent): void {
    const target = (e.target as HTMLElement)?.closest<HTMLElement>('.week')
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
    const target = (e.target as HTMLElement)?.closest<HTMLElement>('.week')
    if (target) {
      tooltipVisible = false
    }
  }

  function handleFocusIn(e: FocusEvent): void {
    warmOnce()
    const target = (e.target as HTMLElement)?.closest<HTMLElement>('.week')
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
    const target = (e.target as HTMLElement)?.closest<HTMLElement>('.week')
    if (target) {
      tooltipVisible = false
    }
  }

  $effect(() => {
    if (!selectedWeek || !gridEl)
      return
    const weekEl = gridEl.querySelector<HTMLElement>(`.week[data-week="${selectedWeek}"]`)
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
    <!-- Roving tabindex on cells; grid itself must not be a tab or click focus target -->
    <!-- svelte-ignore a11y_interactive_supports_focus -->
    <div
      bind:this={gridEl}
      class={['timeline', isLoaded && 'loaded']}
      id='grid'
      role='grid'
      aria-label='Life in weeks'
      style:--lifespan={lifespan}
      style:--cell-size='{cellSize}px'
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
        <div role='row' class='grid-row'>
          <!-- Hidden visually; screen readers still need the row's year -->
          <div role='rowheader' class='visually-hidden'>{row.yearLabel}</div>
          {#each row.weeks as week (week.index)}
            <!-- Per-cell deriveds: selection or focus change re-runs only cells whose value flipped -->
            {@const isSelected = selectedWeek === week.index}
            {@const isTabStop = rovingWeek === week.index}
            <div
              role='gridcell'
              class={[
                'week',
                week.isPassed && 'passed',
                week.isCurrent && 'current',
                isSelected && 'selected',
              ]}
              data-week={week.index}
              tabindex={isTabStop ? 0 : -1}
              aria-selected={isSelected}
              aria-current={week.isCurrent ? 'date' : undefined}
              aria-label={week.ariaLabel}
            ></div>
          {/each}
        </div>
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
    grid-template-columns: repeat(52, var(--cell-size, 10px));
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

  /* Rows exist for ARIA only; cells stay items of .timeline grid */
  .grid-row {
    display: contents;
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
    border: 1px solid var(--control-border);
    cursor: pointer;
    forced-color-adjust: none;
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

  /* Must live here: unlayered component rules beat any @layer override */
  @media (forced-colors: active) {
    .week {
      forced-color-adjust: auto;
      border: 1px solid ButtonBorder;
    }

    .week.passed,
    .week.passed:hover,
    .week.passed:focus-visible {
      background: Highlight;
      border-color: Highlight;
    }

    .week.current {
      outline: 2px solid CanvasText;
      background: CanvasText;
    }

    .week.selected {
      outline: 2px solid Highlight;
    }
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
