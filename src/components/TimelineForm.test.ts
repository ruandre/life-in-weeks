// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it, vi } from 'vitest'
import TimelineForm from './TimelineForm.svelte'

function renderForm(props: Partial<{ dob: string, country: string, lifespan: number }> = {}) {
  const onGenerate = vi.fn()
  render(TimelineForm, {
    props: { dob: '2000-01-01', country: '', lifespan: 70, isGenerating: false, onGenerate, ...props },
  })
  return { onGenerate }
}

function submit(): Promise<boolean> {
  return fireEvent.click(screen.getByRole('button', { name: /generate timeline/i }))
}

describe('timeline form', () => {
  it('generates with valid inputs', async () => {
    const { onGenerate } = renderForm({ country: 'japan' })

    await submit()

    expect(onGenerate).toHaveBeenCalledWith({ dob: '2000-01-01', country: 'Japan', lifespan: 70 })
  })

  it('rejects a future date of birth', async () => {
    const { onGenerate } = renderForm({ dob: '2999-01-01' })

    await submit()

    expect(onGenerate).not.toHaveBeenCalled()
    expect(screen.getByLabelText(/date of birth/i)).toHaveProperty('ariaInvalid', 'true')
    expect(document.getElementById('dob-error')?.textContent).toContain('not a future one')
  })

  it('marks the field invalid before moving focus to it', async () => {
    renderForm({ dob: '2999-01-01' })
    const dobInput = screen.getByLabelText(/date of birth/i)
    let invalidOnFocus: string | null = null
    dobInput.addEventListener('focus', () => {
      invalidOnFocus = dobInput.getAttribute('aria-invalid')
    })

    await submit()

    expect(document.activeElement).toBe(dobInput)
    expect(invalidOnFocus).toBe('true')
  })
})
