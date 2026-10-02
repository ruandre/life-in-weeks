import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createResearchStream, isLocalModelSupported } from '../services/research-service'
import { settingsState } from './settings.svelte'
import { TimelineState } from './timeline.svelte'

vi.mock('../services/research-service', () => ({
  createResearchStream: vi.fn(async () => (async function* () {
    yield 'done'
  })()),
  isLocalModelSupported: vi.fn(() => true),
  warmUpLocalModel: async () => {},
  LOCAL_MODEL_NEEDS_USER_ACTIVATION: 'NEEDS_USER_ACTIVATION',
  LOCAL_MODEL_UNAVAILABLE: 'UNAVAILABLE',
}))

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  settingsState.isPanelOpen = false
})

function generatedState(): TimelineState {
  const state = new TimelineState()
  state.generate({ dob: '2000-01-01', country: '', lifespan: 70 }, true)
  return state
}

describe('generate', () => {
  it('clears research for the previous inputs', async () => {
    const state = new TimelineState()
    state.generate({ dob: '2000-01-01', country: '', lifespan: 70 }, true)
    await state.selectWeek(10)

    state.generate({ dob: '1980-06-15', country: '', lifespan: 70 }, true)

    expect(state.selectedWeek).toBeNull()
    expect(state.research.status).toBe('idle')
  })

  it('cancels research still running for the previous inputs', async () => {
    const state = new TimelineState()
    state.generate({ dob: '2000-01-01', country: '', lifespan: 70 }, true)
    void state.selectWeek(10)
    const { signal } = vi.mocked(createResearchStream).mock.calls[0][0]

    state.generate({ dob: '2000-01-01', country: '', lifespan: 40 }, true)

    expect(signal?.aborted).toBe(true)
  })

  it('keeps research when regenerating unchanged inputs', async () => {
    const state = new TimelineState()
    state.generate({ dob: '2000-01-01', country: '', lifespan: 70 }, true)
    await state.selectWeek(10)

    state.generate({ dob: '2000-01-01', country: '', lifespan: 70 }, true)

    expect(state.selectedWeek).toBe(10)
    expect(state.research.status).toBe('ready')
  })
})

describe('selectWeek', () => {
  it('researches with the country submitted on generate, not the draft', async () => {
    const state = new TimelineState()
    state.generate({ dob: '2000-01-01', country: 'France', lifespan: 70 }, true)
    state.country = 'Fr'

    await state.selectWeek(1)

    expect(createResearchStream).toHaveBeenCalledWith(expect.objectContaining({ country: 'France' }))
  })

  it('researches with the date of birth submitted on generate, not the draft', async () => {
    const state = generatedState()
    state.dob = '1980-06-15'

    await state.selectWeek(1)

    expect(createResearchStream).toHaveBeenCalledWith(expect.objectContaining({ dobDate: new Date(2000, 0, 1) }))
  })

  it('refuses research without a valid date of birth', async () => {
    const state = new TimelineState()
    state.displayedDob = ''

    await state.selectWeek(1)

    expect(createResearchStream).not.toHaveBeenCalled()
    expect(state.research.status).toBe('error')
  })
})

describe('selectWeek outcomes', () => {
  it('renders streamed markdown and marks research ready', async () => {
    const state = generatedState()

    const result = await state.selectWeek(1)

    expect(result).toBe('done')
    expect(state.research.status).toBe('ready')
    expect(state.research.renderedHtml).toBe('<p>done</p>')
  })

  it('records the start date of the selected week', async () => {
    const state = generatedState()

    await state.selectWeek(8)

    expect(state.research.weekStart).toEqual(new Date(2000, 1, 19))
  })

  it('ignores weeks outside the timeline', async () => {
    const state = generatedState()

    expect(await state.selectWeek(70 * 52 + 1)).toBeNull()
    expect(state.selectedWeek).toBeNull()
  })

  it('reports unsupported when the browser has no local model', async () => {
    vi.mocked(isLocalModelSupported).mockReturnValueOnce(false)
    const state = generatedState()

    const result = await state.selectWeek(1)

    expect(result).toBe('This browser has no built-in AI model.')
    expect(state.research.status).toBe('unsupported')
  })

  it('asks for credentials when Gemini is chosen without a key', async () => {
    settingsState.isPanelOpen = true
    const state = generatedState()

    const result = await state.selectWeek(1)

    expect(result).toBe('Add a Gemini API key and pick a model to research this week.')
    expect(state.research.status).toBe('error')
  })

  it('asks for a click when the model download needs a user gesture', async () => {
    vi.mocked(createResearchStream).mockRejectedValueOnce(new Error('NEEDS_USER_ACTIVATION'))
    const state = generatedState()

    const result = await state.selectWeek(1)

    expect(result).toBe('Click a week to download the on-device model.')
    expect(state.research.status).toBe('error')
  })

  it('reports unavailable when the device cannot run the model', async () => {
    vi.mocked(createResearchStream).mockRejectedValueOnce(new Error('UNAVAILABLE'))
    const state = generatedState()

    const result = await state.selectWeek(1)

    expect(result).toBe('The model is not ready on this device.')
    expect(state.research.status).toBe('unavailable')
  })

  it('reports other failures with their message', async () => {
    vi.spyOn(console, 'error').mockImplementationOnce(() => {})
    vi.mocked(createResearchStream).mockRejectedValueOnce(new Error('boom'))
    const state = generatedState()

    const result = await state.selectWeek(1)

    expect(result).toBe('Research failed: boom')
    expect(state.research.errorMessage).toBe('Research failed: boom')
    expect(state.research.statusMessage).toBe('Research failed: boom')
  })

  it('returns null without an error when superseded', async () => {
    vi.mocked(createResearchStream).mockRejectedValueOnce(new DOMException('Superseded', 'AbortError'))
    const state = generatedState()

    expect(await state.selectWeek(1)).toBeNull()
    expect(state.research.errorMessage).toBeNull()
  })
})
