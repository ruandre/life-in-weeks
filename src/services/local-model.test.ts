import type { LanguageModelAvailability, LanguageModelCreateOptions, LanguageModelSession } from '../types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  checkLocalModelAvailability,
  LOCAL_MODEL_NEEDS_USER_ACTIVATION,
  LOCAL_MODEL_UNAVAILABLE,
  resetLocalModelForTesting,
  streamLocalCompletion,
  warmUpLocalModel,
} from './local-model'

const ENGLISH_TEXT = [{ type: 'text', languages: ['en'] }]

function fakeSession(): LanguageModelSession {
  const session: LanguageModelSession = {
    clone: async () => session,
    async* promptStreaming() {
      yield 'chunk'
    },
    destroy: () => {},
  }
  return session
}

function progressEvent(loaded: number): Event {
  return Object.assign(new Event('downloadprogress'), { loaded })
}

function stubLanguageModel(
  availability: LanguageModelAvailability,
  create: (options?: LanguageModelCreateOptions) => Promise<LanguageModelSession> = async () => fakeSession(),
) {
  const fake = {
    availability: vi.fn(async () => availability),
    create: vi.fn(create),
  }
  vi.stubGlobal('LanguageModel', fake)
  return fake
}

function stubUserActivation(isActive: boolean): void {
  vi.stubGlobal('navigator', { userActivation: { isActive } })
}

async function drain(stream: AsyncIterable<string>): Promise<string> {
  let text = ''
  for await (const chunk of stream)
    text += chunk
  return text
}

beforeEach(() => {
  resetLocalModelForTesting()
  stubUserActivation(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('checkLocalModelAvailability', () => {
  it('declares English text input and output', async () => {
    const LM = stubLanguageModel('available')

    await checkLocalModelAvailability()

    expect(LM.availability).toHaveBeenCalledWith({
      expectedInputs: ENGLISH_TEXT,
      expectedOutputs: ENGLISH_TEXT,
    })
  })
})

describe('warmUpLocalModel', () => {
  it('creates a session when the model is available', async () => {
    const LM = stubLanguageModel('available')

    await warmUpLocalModel()

    expect(LM.create).toHaveBeenCalledWith(expect.objectContaining({
      expectedInputs: ENGLISH_TEXT,
      expectedOutputs: ENGLISH_TEXT,
      initialPrompts: [expect.objectContaining({ role: 'system' })],
    }))
  })

  it.each(['downloadable', 'downloading'] as const)(
    'skips session creation when the model is %s',
    async (availability) => {
      const LM = stubLanguageModel(availability)

      await warmUpLocalModel()

      expect(LM.create).not.toHaveBeenCalled()
    },
  )
})

describe('streamLocalCompletion', () => {
  it('rejects with UNAVAILABLE when the device cannot run the model', async () => {
    stubLanguageModel('unavailable')

    await expect(streamLocalCompletion({ userPrompt: 'hi' }))
      .rejects
      .toThrow(LOCAL_MODEL_UNAVAILABLE)
  })

  it('rejects without creating a session when a download needs a user gesture', async () => {
    const LM = stubLanguageModel('downloadable')

    await expect(streamLocalCompletion({ userPrompt: 'hi' }))
      .rejects
      .toThrow(LOCAL_MODEL_NEEDS_USER_ACTIVATION)
    expect(LM.create).not.toHaveBeenCalled()
  })

  it('reports download progress when started by a user gesture', async () => {
    stubUserActivation(true)
    stubLanguageModel('downloadable', async (options) => {
      const monitor = new EventTarget()
      options?.monitor?.(monitor)
      monitor.dispatchEvent(progressEvent(0.5))
      monitor.dispatchEvent(progressEvent(1))
      return fakeSession()
    })
    const onDownloadProgress = vi.fn()

    const stream = await streamLocalCompletion({ userPrompt: 'hi', onDownloadProgress })

    expect(onDownloadProgress.mock.calls).toEqual([[0.5], [1]])
    expect(await drain(stream)).toBe('chunk')
  })

  it('does not report download progress when the model is available', async () => {
    stubLanguageModel('available', async (options) => {
      const monitor = new EventTarget()
      options?.monitor?.(monitor)
      monitor.dispatchEvent(progressEvent(0))
      monitor.dispatchEvent(progressEvent(1))
      return fakeSession()
    })
    const onDownloadProgress = vi.fn()

    await streamLocalCompletion({ userPrompt: 'hi', onDownloadProgress })

    expect(onDownloadProgress).not.toHaveBeenCalled()
  })

  it('reuses an in-flight download without a new user gesture', async () => {
    stubUserActivation(true)
    const LM = stubLanguageModel('downloading')
    const first = streamLocalCompletion({ userPrompt: 'hi' })
    await vi.waitFor(() => expect(LM.create).toHaveBeenCalled())

    stubUserActivation(false)
    const second = streamLocalCompletion({ userPrompt: 'hi' })

    await expect(first).resolves.toBeDefined()
    await expect(second).resolves.toBeDefined()
    expect(LM.create).toHaveBeenCalledTimes(1)
  })

  it('destroys the cloned session when aborted before streaming starts', async () => {
    const clone = { ...fakeSession(), destroy: vi.fn() }
    stubLanguageModel('available', async () => ({ ...fakeSession(), clone: async () => clone }))
    const controller = new AbortController()

    await streamLocalCompletion({ userPrompt: 'hi', signal: controller.signal })
    controller.abort()

    expect(clone.destroy).toHaveBeenCalledOnce()
  })

  it('destroys the cloned session when the signal aborted during cloning', async () => {
    const clone = { ...fakeSession(), destroy: vi.fn() }
    const controller = new AbortController()
    stubLanguageModel('available', async () => ({
      ...fakeSession(),
      clone: async () => {
        controller.abort()
        return clone
      },
    }))

    await expect(streamLocalCompletion({ userPrompt: 'hi', signal: controller.signal }))
      .rejects
      .toThrow()
    expect(clone.destroy).toHaveBeenCalledOnce()
  })

  it('destroys the cloned session once after streaming completes', async () => {
    const clone = { ...fakeSession(), destroy: vi.fn() }
    stubLanguageModel('available', async () => ({ ...fakeSession(), clone: async () => clone }))
    const controller = new AbortController()

    await drain(await streamLocalCompletion({ userPrompt: 'hi', signal: controller.signal }))
    controller.abort()

    expect(clone.destroy).toHaveBeenCalledOnce()
  })

  it('retries session creation after a failed attempt', async () => {
    stubUserActivation(true)
    const LM = stubLanguageModel('downloadable')
    LM.create.mockRejectedValueOnce(new DOMException('Requires a user gesture', 'NotAllowedError'))

    await expect(streamLocalCompletion({ userPrompt: 'hi' })).rejects.toThrow('user gesture')
    const stream = await streamLocalCompletion({ userPrompt: 'hi' })

    expect(LM.create).toHaveBeenCalledTimes(2)
    expect(await drain(stream)).toBe('chunk')
  })
})
