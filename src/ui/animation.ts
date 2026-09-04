import { STATS_ANIMATION_MS } from '../config/constants'

export const easeOutExpo = (t: number): number => (t === 1 ? 1 : 1 - 2 ** (-10 * t))

export type AnimateCallback = (formatted: string, current: number) => void

export function animateValue(
  onTick: AnimateCallback,
  start: number,
  end: number,
  duration: number = STATS_ANIMATION_MS,
  formatStr: '' | '%' = '',
): () => void {
  let startTimestamp: number | null = null
  let rafId = 0
  let cancelled = false

  const format = (value: number): string => {
    if (formatStr === '%')
      return `${value.toFixed(1)}%`
    return Math.floor(value).toLocaleString()
  }

  const apply = (val: number): void => {
    onTick(format(val), val)
  }

  const step = (timestamp: number): void => {
    if (cancelled)
      return
    if (startTimestamp === null)
      startTimestamp = timestamp
    const progress = Math.min((timestamp - startTimestamp) / duration, 1)
    const eased = easeOutExpo(progress)
    const current = start + eased * (end - start)

    apply(current)

    if (progress < 1) {
      rafId = window.requestAnimationFrame(step)
    }
    else {
      apply(end)
    }
  }

  rafId = window.requestAnimationFrame(step)

  return () => {
    cancelled = true
    window.cancelAnimationFrame(rafId)
  }
}
