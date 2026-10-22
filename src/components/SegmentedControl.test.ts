// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import SegmentedControl from './SegmentedControl.svelte'

const SIZES = [
  { value: 'small', label: 'Small' },
  { value: 'large', label: 'Large' },
] as const

function renderSizes(onchange = vi.fn()): void {
  render(SegmentedControl, { name: 'size', options: SIZES, value: 'small', onchange })
}

describe('segmented control', () => {
  it('offers one radio per option in a single named group', () => {
    renderSizes()

    const radios = screen.getAllByRole<HTMLInputElement>('radio')

    expect(radios.map(radio => radio.labels?.[0]?.textContent?.trim())).toEqual(['Small', 'Large'])
    expect(radios.map(radio => radio.name)).toEqual(['size', 'size'])
  })

  it('checks only the option matching the value', () => {
    renderSizes()

    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Small' }).checked).toBe(true)
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Large' }).checked).toBe(false)
  })

  it('reports the value of the option the user picks', async () => {
    const onchange = vi.fn()
    renderSizes(onchange)

    await fireEvent.click(screen.getByRole('radio', { name: 'Large' }))

    expect(onchange).toHaveBeenCalledExactlyOnceWith('large')
  })
})
