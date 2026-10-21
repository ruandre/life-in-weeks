import { afterEach, describe, expect, it, vi } from 'vitest'
import { SYSTEM_PROMPT } from '../domain/research-prompt'
import { CLOUD_PROVIDERS } from './cloud-provider-registry'
import { streamLocalCompletion } from './local-model'
import { createResearchStream } from './research-service'

vi.mock('./cloud-provider-registry', () => ({
  CLOUD_PROVIDERS: {
    gemini: {
      name: 'Gemini',
      streamCompletion: vi.fn(async () => (async function* () {
        yield 'gemini'
      })()),
    },
  },
}))

vi.mock('./local-model', () => ({
  streamLocalCompletion: vi.fn(async () => (async function* () {
    yield 'local'
  })()),
}))

const streamGeminiCompletion = vi.mocked(CLOUD_PROVIDERS.gemini.streamCompletion)
const dobDate = new Date(2000, 0, 1)
const credentials = { apiKey: 'key', model: 'gemini-test' }

afterEach(() => {
  vi.clearAllMocks()
})

describe('createResearchStream', () => {
  it('streams from the local model with the week prompt', async () => {
    const onDownloadProgress = vi.fn()

    await createResearchStream({ weekIndex: 53, dobDate, country: ' Japan ', provider: 'local', onDownloadProgress })

    expect(streamGeminiCompletion).not.toHaveBeenCalled()
    const [{ userPrompt, onDownloadProgress: passedListener }] = vi.mocked(streamLocalCompletion).mock.calls[0]
    expect(userPrompt).toContain('in Japan\n')
    expect(userPrompt).toContain('2001')
    expect(passedListener).toBe(onDownloadProgress)
  })

  it('streams from Gemini with the system prompt and credentials', async () => {
    await createResearchStream({ weekIndex: 1, dobDate, provider: 'gemini', credentials })

    expect(streamLocalCompletion).not.toHaveBeenCalled()
    expect(streamGeminiCompletion).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: 'key',
      model: 'gemini-test',
      systemPrompt: SYSTEM_PROMPT,
    }))
  })

  it.each([
    ['no credentials', null],
    ['an empty key', { apiKey: '', model: 'gemini-test' }],
    ['an empty model', { apiKey: 'key', model: '' }],
  ])('rejects Gemini with %s', async (_, credentials) => {
    await expect(createResearchStream({ weekIndex: 1, dobDate, provider: 'gemini', credentials }))
      .rejects
      .toThrow('Add a Gemini API key')
    expect(streamGeminiCompletion).not.toHaveBeenCalled()
  })

  it('throws AbortError without calling a provider when already aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(createResearchStream({ weekIndex: 1, dobDate, provider: 'local', signal: controller.signal }))
      .rejects
      .toMatchObject({ name: 'AbortError' })
    expect(streamLocalCompletion).not.toHaveBeenCalled()
  })

  it.each(['local', 'gemini'] as const)('throws AbortError when aborted while the %s stream starts', async (provider) => {
    const controller = new AbortController()
    const start = provider === 'local' ? streamLocalCompletion : streamGeminiCompletion
    vi.mocked(start).mockImplementationOnce(async () => {
      controller.abort()
      return (async function* () {})()
    })

    await expect(createResearchStream({ weekIndex: 1, dobDate, provider, credentials, signal: controller.signal }))
      .rejects
      .toMatchObject({ name: 'AbortError' })
  })
})
