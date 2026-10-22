// @vitest-environment jsdom
import type { ResearchState } from '../state/timeline.svelte'
import { fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { settingsState } from '../state/settings.svelte'
import ResearchPanel from './ResearchPanel.svelte'

const idleResearch: ResearchState = {
  status: 'idle',
  weekIndex: null,
  age: null,
  weekInYear: null,
  weekStart: null,
  renderedHtml: '',
  downloadProgress: null,
  errorMessage: null,
  statusMessage: '',
}

// jsdom lacks ResizeObserver; key note measures its overflow. File-scoped: state resets re-render after hooks
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  disconnect() {}
})

afterEach(() => {
  settingsState.setPanelOpen(false)
  settingsState.apiKey = ''
})

describe('privacy note', () => {
  it('discloses that a cloud request reveals the date of birth', () => {
    settingsState.apiKey = 'key'
    render(ResearchPanel, { research: idleResearch })

    expect(screen.getByText(/date of birth/i).textContent).toMatch(/Gemini/)
  })

  it('says nothing leaves the browser on device', () => {
    render(ResearchPanel, { research: idleResearch })

    expect(screen.getByText(/nothing leaves the browser/i)).toBeTruthy()
  })
})

describe('model settings panel', () => {
  function modelToggle(): HTMLElement {
    return screen.getByRole('button', { name: /^model/i })
  }

  it('keeps the settings hidden until the model toggle opens them', async () => {
    render(ResearchPanel, { research: idleResearch })

    expect(modelToggle().getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: /model settings/i })).toBeNull()

    await fireEvent.click(modelToggle())

    expect(modelToggle().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('region', { name: /model settings/i })).toBeTruthy()
    expect(settingsState.isPanelOpen).toBe(true)
  })

  it('clears the key and returns to the on-device model on close', async () => {
    render(ResearchPanel, { research: idleResearch })
    await fireEvent.click(modelToggle())
    settingsState.setApiKey('key')

    await fireEvent.click(modelToggle())

    expect(settingsState.apiKey).toBe('')
    expect(settingsState.provider).toBe('local')
    expect(screen.queryByRole('region', { name: /model settings/i })).toBeNull()
  })
})
