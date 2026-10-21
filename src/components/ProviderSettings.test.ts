// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { settingsState } from '../state/settings.svelte'
import ProviderSettings from './ProviderSettings.svelte'

afterEach(() => {
  settingsState.keyStatus = 'empty'
  settingsState.models = []
})

describe('provider settings model select', () => {
  it('shows the placeholder option until models load', () => {
    render(ProviderSettings)

    const select = screen.getByLabelText<HTMLSelectElement>(/gemini model/i)

    expect(select.disabled).toBe(true)
    expect(select.selectedOptions[0]?.textContent).toBe('Paste a key to load models')
  })

  it('selects the chosen model once models load', () => {
    settingsState.keyStatus = 'valid'
    settingsState.models = [{ id: 'gemini-test', name: 'Gemini Test' }]
    settingsState.setModel('gemini-test')
    render(ProviderSettings)

    const select = screen.getByLabelText<HTMLSelectElement>(/gemini model/i)

    expect(select.disabled).toBe(false)
    expect(select.value).toBe('gemini-test')
  })
})
