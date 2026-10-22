// @vitest-environment jsdom
import type { ResearchState } from '../state/timeline.svelte'
import { render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
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

afterEach(() => {
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
