import type { GeminiModel } from '../types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_GEMINI_MODEL, fetchGeminiModels } from '../services/gemini'
import { warmUpLocalModel } from '../services/research-service'
import { SettingsState } from './settings.svelte'

vi.mock('../services/gemini', async importOriginal => ({
  ...await importOriginal<typeof import('../services/gemini')>(),
  fetchGeminiModels: vi.fn(),
}))

vi.mock('../services/research-service', () => ({
  warmUpLocalModel: vi.fn(),
}))

const DEBOUNCE_MS = 500

const defaultModel: GeminiModel = { id: DEFAULT_GEMINI_MODEL, name: 'Default' }
const otherModel: GeminiModel = { id: 'gemini-other', name: 'Other' }
const thirdModel: GeminiModel = { id: 'gemini-third', name: 'Third' }

const fetchModels = vi.mocked(fetchGeminiModels)

function abortError(): DOMException {
  return new DOMException('aborted', 'AbortError')
}

async function verifiedState(models: GeminiModel[] = [defaultModel, otherModel]): Promise<SettingsState> {
  fetchModels.mockResolvedValueOnce(models)
  const state = new SettingsState()
  state.setPanelOpen(true)
  state.setApiKey('key')
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
  fetchModels.mockClear()
  return state
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.resetAllMocks()
})

describe('setApiKey', () => {
  it('trims the key', () => {
    const state = new SettingsState()

    state.setApiKey('  key  ')

    expect(state.apiKey).toBe('key')
  })

  it('marks the key as checking before verification runs', () => {
    const state = new SettingsState()

    state.setApiKey('key')

    expect(state.keyStatus).toBe('checking')
    expect(fetchModels).not.toHaveBeenCalled()
  })

  it('verifies only the latest key once typing settles', async () => {
    fetchModels.mockResolvedValue([defaultModel])
    const state = new SettingsState()

    state.setApiKey('k')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1)
    state.setApiKey('ke')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1)
    state.setApiKey('key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(fetchModels).toHaveBeenCalledTimes(1)
    expect(fetchModels).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'key' }))
  })

  it('treats a blank key as empty without verifying', async () => {
    const state = new SettingsState()

    state.setApiKey('   ')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(state.keyStatus).toBe('empty')
    expect(fetchModels).not.toHaveBeenCalled()
  })

  it('cancels pending verification when the key is cleared', async () => {
    const state = new SettingsState()

    state.setApiKey('key')
    state.setApiKey('')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(state.keyStatus).toBe('empty')
    expect(fetchModels).not.toHaveBeenCalled()
  })
})

describe('key verification', () => {
  it('marks the key valid and exposes its models', async () => {
    fetchModels.mockResolvedValue([defaultModel, otherModel])
    const state = new SettingsState()

    state.setApiKey('key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(state.keyStatus).toBe('valid')
    expect(state.models).toEqual([defaultModel, otherModel])
    expect(state.canPickModel).toBe(true)
  })

  it('marks the key invalid with a readable error and drops models', async () => {
    const state = await verifiedState()
    fetchModels.mockRejectedValue(new Error(JSON.stringify({ error: { message: 'API key not valid' } })))

    state.setApiKey('bad-key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(state.keyStatus).toBe('invalid')
    expect(state.keyError).toBe('API key not valid')
    expect(state.models).toEqual([])
    expect(state.canPickModel).toBe(false)
  })

  it('ignores aborted verification', async () => {
    fetchModels.mockRejectedValue(abortError())
    const state = new SettingsState()

    state.setApiKey('key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(state.keyStatus).not.toBe('invalid')
    expect(state.keyError).toBeNull()
  })

  it('aborts superseded verification and ignores its late response', async () => {
    const first = Promise.withResolvers<GeminiModel[]>()
    fetchModels
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([thirdModel])
    const state = new SettingsState()

    state.setApiKey('old-key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    state.setApiKey('new-key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    first.resolve([defaultModel, otherModel])
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchModels.mock.calls[0][0].signal?.aborted).toBe(true)
    expect(state.keyStatus).toBe('valid')
    expect(state.models).toEqual([thirdModel])
    expect(state.model).toBe(thirdModel.id)
  })

  it('ignores a late failure from superseded verification', async () => {
    const first = Promise.withResolvers<GeminiModel[]>()
    fetchModels
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([otherModel])
    const state = new SettingsState()

    state.setApiKey('old-key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    state.setApiKey('new-key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    first.reject(new Error('Network down'))
    await vi.advanceTimersByTimeAsync(0)

    expect(state.keyStatus).toBe('valid')
    expect(state.keyError).toBeNull()
    expect(state.models).toEqual([otherModel])
  })

  it('ignores a late success from the old key while the new key is debouncing', async () => {
    const first = Promise.withResolvers<GeminiModel[]>()
    fetchModels
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([thirdModel])
    const state = new SettingsState()
    state.setApiKey('old-key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    state.setApiKey('new-key')
    first.resolve([defaultModel, otherModel])
    await vi.advanceTimersByTimeAsync(0)

    expect(state.keyStatus).toBe('checking')
    expect(state.models).toEqual([])
    expect(state.canPickModel).toBe(false)
  })

  it('verifies the new key after a late success from the old key', async () => {
    const first = Promise.withResolvers<GeminiModel[]>()
    fetchModels
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([thirdModel])
    const state = new SettingsState()
    state.setApiKey('old-key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    state.setApiKey('new-key')
    first.resolve([defaultModel, otherModel])
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(state.keyStatus).toBe('valid')
    expect(state.models).toEqual([thirdModel])
    expect(state.model).toBe(thirdModel.id)
  })
})

describe('default model selection', () => {
  it('keeps the current model when available', async () => {
    const state = await verifiedState([defaultModel, otherModel])
    state.setModel(otherModel.id)
    fetchModels.mockResolvedValue([defaultModel, otherModel])

    state.setApiKey('another-key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(state.model).toBe(otherModel.id)
  })

  it('falls back to the default model when the current one is missing', async () => {
    const state = await verifiedState([defaultModel, otherModel])
    state.setModel('gemini-retired')
    fetchModels.mockResolvedValue([otherModel, defaultModel])

    state.setApiKey('another-key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(state.model).toBe(DEFAULT_GEMINI_MODEL)
  })

  it('falls back to the first model when the default is missing', async () => {
    fetchModels.mockResolvedValue([otherModel, thirdModel])
    const state = new SettingsState()

    state.setApiKey('key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(state.model).toBe(otherModel.id)
  })
})

describe('setPanelOpen', () => {
  it('wipes credentials and models on close', async () => {
    const state = await verifiedState()
    state.setModel(otherModel.id)

    state.setPanelOpen(false)

    expect(state.apiKey).toBe('')
    expect(state.model).toBe(DEFAULT_GEMINI_MODEL)
    expect(state.models).toEqual([])
    expect(state.keyStatus).toBe('empty')
    expect(state.keyError).toBeNull()
  })

  it('clears a verification error on close', async () => {
    fetchModels.mockRejectedValue(new Error('API key not valid'))
    const state = new SettingsState()
    state.setPanelOpen(true)
    state.setApiKey('bad-key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    state.setPanelOpen(false)

    expect(state.keyStatus).toBe('empty')
    expect(state.keyError).toBeNull()
  })

  it('cancels pending verification on close', async () => {
    const state = new SettingsState()
    state.setPanelOpen(true)
    state.setApiKey('key')

    state.setPanelOpen(false)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(fetchModels).not.toHaveBeenCalled()
  })

  it('aborts in-flight verification on close', async () => {
    fetchModels.mockReturnValue(new Promise(() => {}))
    const state = new SettingsState()
    state.setPanelOpen(true)
    state.setApiKey('key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    state.setPanelOpen(false)

    expect(fetchModels.mock.calls[0][0].signal?.aborted).toBe(true)
  })

  it('ignores a late success from verification aborted on close', async () => {
    const pending = Promise.withResolvers<GeminiModel[]>()
    fetchModels.mockReturnValueOnce(pending.promise)
    const state = new SettingsState()
    state.setPanelOpen(true)
    state.setApiKey('key')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    state.setPanelOpen(false)
    pending.resolve([defaultModel, otherModel])
    await vi.advanceTimersByTimeAsync(0)

    expect(state.apiKey).toBe('')
    expect(state.keyStatus).toBe('empty')
    expect(state.models).toEqual([])
    expect(state.canPickModel).toBe(false)
  })

  it('warms up the local model on close', () => {
    const state = new SettingsState()

    state.setPanelOpen(false)

    expect(warmUpLocalModel).toHaveBeenCalledTimes(1)
  })

  it('verifies an unverified key immediately on open', async () => {
    fetchModels.mockResolvedValue([defaultModel])
    const state = new SettingsState()
    state.apiKey = 'key'

    state.setPanelOpen(true)
    await vi.advanceTimersByTimeAsync(0)

    expect(fetchModels).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'key' }))
    expect(state.keyStatus).toBe('valid')
  })

  it('replaces pending debounced verification when opening with an unverified key', async () => {
    fetchModels.mockResolvedValue([defaultModel])
    const state = new SettingsState()
    state.setApiKey('key')

    state.setPanelOpen(true)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(fetchModels).toHaveBeenCalledTimes(1)
  })

  it('does not re-verify a valid key on open', async () => {
    const state = await verifiedState()

    state.setPanelOpen(true)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(fetchModels).not.toHaveBeenCalled()
  })

  it('does not verify on open without a key', async () => {
    const state = new SettingsState()

    state.setPanelOpen(true)
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(fetchModels).not.toHaveBeenCalled()
  })
})

describe('provider', () => {
  it('uses the local model without a key while the panel is closed', () => {
    expect(new SettingsState().provider).toBe('local')
  })

  it('uses Gemini while the panel is open', () => {
    const state = new SettingsState()

    state.setPanelOpen(true)

    expect(state.provider).toBe('gemini')
  })

  it('uses Gemini when a key is set', () => {
    const state = new SettingsState()

    state.setApiKey('key')

    expect(state.provider).toBe('gemini')
  })
})

describe('hasCredentials', () => {
  it('requires a key', () => {
    expect(new SettingsState().hasCredentials).toBe(false)
  })

  it('requires a model', () => {
    const state = new SettingsState()
    state.setApiKey('key')

    state.setModel('')

    expect(state.hasCredentials).toBe(false)
  })

  it('holds with both key and model', () => {
    const state = new SettingsState()

    state.setApiKey('key')

    expect(state.hasCredentials).toBe(true)
  })
})
