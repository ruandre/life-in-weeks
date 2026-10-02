import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createResearchStream } from '../services/research-service'
import { TimelineState } from './timeline.svelte'

vi.mock('../services/research-service', () => ({
  createResearchStream: vi.fn(async () => ({
    stream: (async function* () {
      yield 'done'
    })(),
    meta: { age: 0, year: 2000, isFuture: false, weekRangeText: null },
  })),
  isLocalModelSupported: () => true,
  warmUpLocalModel: async () => {},
  LOCAL_MODEL_NEEDS_USER_ACTIVATION: 'NEEDS_USER_ACTIVATION',
  LOCAL_MODEL_UNAVAILABLE: 'UNAVAILABLE',
}))

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(callback, 0))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

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
})
