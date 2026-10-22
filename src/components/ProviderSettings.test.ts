// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { settingsState } from '../state/settings.svelte'
import ProviderSettings from './ProviderSettings.svelte'

afterEach(() => {
  settingsState.setCloudProvider('gemini')
  settingsState.keyStatus = 'empty'
  settingsState.models = []
})

describe('provider choice', () => {
  it('offers each cloud provider with Gemini selected by default', () => {
    render(ProviderSettings)

    const group = screen.getByRole('group', { name: /provider/i })

    expect(group).toBeTruthy()
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Gemini' }).checked).toBe(true)
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Claude' }).checked).toBe(false)
  })

  it('relabels the fields and wipes the key when another provider is chosen', async () => {
    settingsState.setApiKey('key')
    render(ProviderSettings)

    await fireEvent.click(screen.getByRole('radio', { name: 'Claude' }))

    expect(settingsState.cloudProviderId).toBe('claude')
    expect(screen.getByLabelText<HTMLInputElement>(/claude api key/i).value).toBe('')
    expect(screen.getByLabelText(/claude model/i)).toBeTruthy()
    expect(screen.queryByLabelText(/gemini model/i)).toBeNull()
  })
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

describe('key status', () => {
  it('reports how many models the key unlocks', () => {
    settingsState.keyStatus = 'valid'
    settingsState.models = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    render(ProviderSettings)

    expect(screen.getByRole('status').textContent?.trim()).toBe('2 models available')
  })
})
