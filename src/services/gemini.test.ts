import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchGeminiModels,
  formatGeminiError,
  isTextModel,
  RECOMMENDED_MODELS,
  streamGeminiCompletion,
} from './gemini'

const genai = vi.hoisted(() => ({
  construct: vi.fn(),
  list: vi.fn(),
  generateContentStream: vi.fn(),
}))

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { list: genai.list, generateContentStream: genai.generateContentStream }

    constructor(options: { apiKey: string }) {
      genai.construct(options)
    }
  },
}))

interface ListedModel {
  name?: string
  displayName?: string
  supportedActions?: string[]
}

async function* yieldAll<T>(items: T[], failure?: unknown): AsyncGenerator<T> {
  yield* items
  if (failure)
    throw failure
}

function listModels(models: ListedModel[]): void {
  genai.list.mockResolvedValue(yieldAll(models))
}

function streamChunks(chunks: { text?: string }[], failure?: unknown): void {
  genai.generateContentStream.mockResolvedValue(yieldAll(chunks, failure))
}

async function drain(stream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of stream)
    chunks.push(chunk)
  return chunks
}

function apiError(message: string): Error {
  return new Error(JSON.stringify({ error: { message } }))
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError')
}

const TEXT_ACTIONS = ['generateContent']

beforeEach(() => {
  vi.resetAllMocks()
})

describe('formatGeminiError', () => {
  it('returns a plain error message', () => {
    expect(formatGeminiError(new Error('quota exceeded'))).toBe('quota exceeded')
  })

  it('unwraps a JSON error payload', () => {
    expect(formatGeminiError(apiError('API key not valid'))).toBe('API key not valid')
  })

  it('unwraps a doubly nested JSON error payload', () => {
    const inner = JSON.stringify({ error: { message: 'model overloaded' } })

    expect(formatGeminiError(apiError(inner))).toBe('model overloaded')
  })

  it('unwraps a mid-stream error with a status prefix', () => {
    const payload = JSON.stringify({ error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } })

    expect(formatGeminiError(new Error(`got status: RESOURCE_EXHAUSTED. ${payload}`))).toBe('Quota exceeded')
  })

  it('keeps a message with braces that are not JSON', () => {
    expect(formatGeminiError(new Error('bad {value} here'))).toBe('bad {value} here')
  })

  it('unwraps a JSON payload with a top-level message', () => {
    const err = new Error(JSON.stringify({ message: 'bad request' }))

    expect(formatGeminiError(err)).toBe('bad request')
  })

  it('keeps JSON without a message as is', () => {
    const raw = JSON.stringify({ code: 500 })

    expect(formatGeminiError(new Error(raw))).toBe(raw)
  })

  it('accepts any object with a message', () => {
    expect(formatGeminiError({ message: 'plain object' })).toBe('plain object')
  })

  it('stringifies non-object errors', () => {
    expect(formatGeminiError('network down')).toBe('network down')
  })

  it.each([null, undefined, ''])('falls back to Unknown error for %o', (err) => {
    expect(formatGeminiError(err)).toBe('Unknown error')
  })
})

describe('isTextModel', () => {
  it.each(['gemini-2.5-flash', 'gemini-3.6-flash', 'Gemini-3.1-Pro-Preview', 'gemma-3-27b-it'])(
    'accepts text model %s',
    (id) => {
      expect(isTextModel(id)).toBe(true)
    },
  )

  it.each([
    'gemini-2.5-flash-image',
    'gemini-2.5-flash-preview-tts',
    'gemini-embedding-001',
    'veo-3.0-generate-001',
    'gemini-2.5-flash-native-audio',
  ])('rejects non-text model %s', (id) => {
    expect(isTextModel(id)).toBe(false)
  })

  it.each(['gemini-1.0-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'])(
    'rejects deprecated model %s',
    (id) => {
      expect(isTextModel(id)).toBe(false)
    },
  )

  it('rejects models that cannot generate content', () => {
    expect(isTextModel('gemini-2.5-flash', ['countTokens', 'embedContent'])).toBe(false)
  })

  it('accepts models that can generate content', () => {
    expect(isTextModel('gemini-2.5-flash', ['countTokens', 'generateContent'])).toBe(true)
  })

  it.each(['learnlm-2.0-flash', 'claude-text', 'text-bison-001'])(
    'rejects unknown model family %s',
    (id) => {
      expect(isTextModel(id)).toBe(false)
    },
  )
})

describe('fetchGeminiModels', () => {
  it('creates the client with the given API key and forwards the signal', async () => {
    listModels([])
    const { signal } = new AbortController()

    await fetchGeminiModels({ apiKey: 'secret', signal })

    expect(genai.construct).toHaveBeenCalledWith({ apiKey: 'secret' })
    expect(genai.list).toHaveBeenCalledWith({ config: { abortSignal: signal } })
  })

  it('returns recommended models in order when none are fetched', async () => {
    listModels([])

    await expect(fetchGeminiModels({ apiKey: 'k' })).resolves.toEqual(RECOMMENDED_MODELS)
  })

  it('strips the models/ prefix and drops non-text models', async () => {
    listModels([
      { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedActions: TEXT_ACTIONS },
      { name: 'models/gemini-2.5-flash-image', displayName: 'Image', supportedActions: TEXT_ACTIONS },
      { name: 'models/text-embedding-004', displayName: 'Embedding', supportedActions: ['embedContent'] },
      { displayName: 'Nameless', supportedActions: TEXT_ACTIONS },
    ])

    const models = await fetchGeminiModels({ apiKey: 'k' })

    expect(models.slice(RECOMMENDED_MODELS.length)).toEqual([
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ])
  })

  it('falls back to the id when a fetched model has no display name', async () => {
    listModels([{ name: 'models/gemma-3-27b-it', supportedActions: TEXT_ACTIONS }])

    const models = await fetchGeminiModels({ apiKey: 'k' })

    expect(models.at(-1)).toEqual({ id: 'gemma-3-27b-it', name: 'gemma-3-27b-it' })
  })

  it('lists recommended models first, replacing them with fetched entries of the same id', async () => {
    const [first, second, third] = RECOMMENDED_MODELS
    listModels([
      { name: 'models/gemma-3-27b-it', displayName: 'Gemma 3', supportedActions: TEXT_ACTIONS },
      { name: `models/${third.id}`, displayName: 'Fetched third', supportedActions: TEXT_ACTIONS },
      { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedActions: TEXT_ACTIONS },
      { name: `models/${first.id}`, displayName: 'Fetched first', supportedActions: TEXT_ACTIONS },
    ])

    const models = await fetchGeminiModels({ apiKey: 'k' })

    expect(models).toEqual([
      { id: first.id, name: 'Fetched first' },
      second,
      { id: third.id, name: 'Fetched third' },
      { id: 'gemma-3-27b-it', name: 'Gemma 3' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    ])
  })

  it('rethrows API failures as errors with the formatted message', async () => {
    genai.list.mockRejectedValue(apiError('API key not valid'))

    await expect(fetchGeminiModels({ apiKey: 'k' })).rejects.toThrow(new Error('API key not valid'))
  })

  it('formats failures raised while paging', async () => {
    genai.list.mockResolvedValue(yieldAll([], apiError('quota exceeded')))

    await expect(fetchGeminiModels({ apiKey: 'k' })).rejects.toThrow(new Error('quota exceeded'))
  })

  it('rethrows abort errors untouched', async () => {
    const abort = abortError()
    genai.list.mockRejectedValue(abort)

    await expect(fetchGeminiModels({ apiKey: 'k' })).rejects.toBe(abort)
  })

  it('rethrows any error untouched once the signal is aborted', async () => {
    const controller = new AbortController()
    const failure = apiError('socket closed')
    genai.list.mockImplementation(async () => {
      controller.abort()
      throw failure
    })

    await expect(fetchGeminiModels({ apiKey: 'k', signal: controller.signal })).rejects.toBe(failure)
  })
})

describe('streamGeminiCompletion', () => {
  const request = {
    apiKey: 'secret',
    model: 'gemini-3.6-flash',
    systemPrompt: 'You are a historian',
    userPrompt: 'What happened this week?',
  }

  it('passes the model, prompts and signal to the API', async () => {
    streamChunks([])
    const { signal } = new AbortController()

    await streamGeminiCompletion({ ...request, signal })

    expect(genai.construct).toHaveBeenCalledWith({ apiKey: 'secret' })
    expect(genai.generateContentStream).toHaveBeenCalledWith({
      model: 'gemini-3.6-flash',
      contents: 'What happened this week?',
      config: {
        systemInstruction: 'You are a historian',
        abortSignal: signal,
      },
    })
  })

  it('yields only chunks that carry text', async () => {
    streamChunks([{ text: 'Hello' }, {}, { text: '' }, { text: ' world' }])

    const stream = await streamGeminiCompletion(request)

    expect(await drain(stream)).toEqual(['Hello', ' world'])
  })

  it('rethrows a failed request as an error with the formatted message', async () => {
    genai.generateContentStream.mockRejectedValue(apiError('model not found'))

    await expect(streamGeminiCompletion(request)).rejects.toThrow(new Error('model not found'))
  })

  it('rethrows mid-stream failures as errors with the formatted message', async () => {
    streamChunks([{ text: 'partial' }], apiError('model overloaded'))
    const chunks: string[] = []

    const stream = await streamGeminiCompletion(request)

    await expect(async () => {
      for await (const chunk of stream)
        chunks.push(chunk)
    }).rejects.toThrow(new Error('model overloaded'))
    expect(chunks).toEqual(['partial'])
  })

  it('rethrows mid-stream abort errors untouched', async () => {
    const abort = abortError()
    streamChunks([{ text: 'partial' }], abort)

    const stream = await streamGeminiCompletion(request)

    await expect(drain(stream)).rejects.toBe(abort)
  })
})
