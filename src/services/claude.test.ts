import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  claudeProvider,
  fetchClaudeModels,
  formatClaudeError,
  RECOMMENDED_CLAUDE_MODELS,
  streamClaudeCompletion,
} from './claude'

const anthropic = vi.hoisted(() => ({
  construct: vi.fn(),
  list: vi.fn(),
  stream: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    models = { list: anthropic.list }
    messages = { stream: anthropic.stream }

    constructor(options: { apiKey: string }) {
      anthropic.construct(options)
    }
  },
}))

interface ListedModel {
  id: string
  display_name?: string
}

interface FinalMessage {
  stop_reason: string
  stop_details?: { explanation: string | null } | null
}

async function* yieldAll<T>(items: T[], failure?: unknown): AsyncGenerator<T> {
  yield* items
  if (failure)
    throw failure
}

function listModels(models: ListedModel[], failure?: unknown): void {
  anthropic.list.mockReturnValue(yieldAll(models, failure))
}

function textDelta(text: string): unknown {
  return { type: 'content_block_delta', delta: { type: 'text_delta', text } }
}

const ended: FinalMessage = { stop_reason: 'end_turn', stop_details: null }

function streamEvents(events: unknown[], options: { failure?: unknown, final?: FinalMessage } = {}): void {
  anthropic.stream.mockReturnValue({
    [Symbol.asyncIterator]: () => yieldAll(events, options.failure),
    finalMessage: vi.fn().mockResolvedValue(options.final ?? ended),
  })
}

async function drain(stream: AsyncIterable<string>): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of stream)
    chunks.push(chunk)
  return chunks
}

function apiError(message: string): Error {
  return Object.assign(new Error(`401 {"type":"error","error":{"type":"authentication_error","message":"${message}"}}`), {
    error: { type: 'error', error: { type: 'authentication_error', message } },
  })
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError')
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('formatClaudeError', () => {
  it('reads the message from an API error body', () => {
    expect(formatClaudeError(apiError('invalid x-api-key'))).toBe('invalid x-api-key')
  })

  it('falls back to the error message when the body has no message', () => {
    const err = Object.assign(new Error('500 upstream'), { error: { type: 'error', error: { type: 'api_error' } } })

    expect(formatClaudeError(err)).toBe('500 upstream')
  })

  it('returns a plain error message', () => {
    expect(formatClaudeError(new Error('network down'))).toBe('network down')
  })

  it('stringifies non-object errors', () => {
    expect(formatClaudeError('offline')).toBe('offline')
  })

  it.each([null, undefined, ''])('falls back to Unknown error for %o', (err) => {
    expect(formatClaudeError(err)).toBe('Unknown error')
  })
})

describe('fetchClaudeModels', () => {
  it('creates a browser client with the given key and requests active models with the signal', async () => {
    listModels([])
    const { signal } = new AbortController()

    await fetchClaudeModels({ apiKey: 'secret', signal })

    expect(anthropic.construct).toHaveBeenCalledWith({ apiKey: 'secret', dangerouslyAllowBrowser: true })
    expect(anthropic.list).toHaveBeenCalledWith({ lifecycle: ['active'] }, { signal })
  })

  it('returns recommended models in order when none are fetched', async () => {
    listModels([])

    await expect(fetchClaudeModels({ apiKey: 'k' })).resolves.toEqual(RECOMMENDED_CLAUDE_MODELS)
  })

  it('maps fetched models to options and falls back to the id without a display name', async () => {
    listModels([
      { id: 'claude-test-1', display_name: 'Claude Test' },
      { id: 'claude-test-2' },
    ])

    const models = await fetchClaudeModels({ apiKey: 'k' })

    expect(models.slice(RECOMMENDED_CLAUDE_MODELS.length)).toEqual([
      { id: 'claude-test-1', name: 'Claude Test' },
      { id: 'claude-test-2', name: 'claude-test-2' },
    ])
  })

  it('lists recommended models first, replacing them with fetched entries of the same id', async () => {
    const [first, second, third] = RECOMMENDED_CLAUDE_MODELS
    listModels([
      { id: third.id, display_name: 'Fetched third' },
      { id: 'claude-other', display_name: 'Other' },
      { id: first.id, display_name: 'Fetched first' },
    ])

    const models = await fetchClaudeModels({ apiKey: 'k' })

    expect(models).toEqual([
      { id: first.id, name: 'Fetched first' },
      second,
      { id: third.id, name: 'Fetched third' },
      { id: 'claude-other', name: 'Other' },
    ])
  })

  it('rethrows API failures as errors with the formatted message', async () => {
    listModels([], apiError('invalid x-api-key'))

    await expect(fetchClaudeModels({ apiKey: 'k' })).rejects.toThrow(new Error('invalid x-api-key'))
  })

  it('rethrows abort errors untouched', async () => {
    const abort = abortError()
    listModels([], abort)

    await expect(fetchClaudeModels({ apiKey: 'k' })).rejects.toBe(abort)
  })

  it('rethrows any error untouched once the signal is aborted', async () => {
    const controller = new AbortController()
    const failure = apiError('socket closed')
    anthropic.list.mockImplementation(() => {
      controller.abort()
      return yieldAll([], failure)
    })

    await expect(fetchClaudeModels({ apiKey: 'k', signal: controller.signal })).rejects.toBe(failure)
  })
})

describe('streamClaudeCompletion', () => {
  const request = {
    apiKey: 'secret',
    model: 'claude-sonnet-5-5',
    systemPrompt: 'You are a historian',
    userPrompt: 'What happened this week?',
  }

  it('passes the model, prompts and signal to the API', async () => {
    streamEvents([])
    const { signal } = new AbortController()

    await drain(await streamClaudeCompletion({ ...request, signal }))

    expect(anthropic.construct).toHaveBeenCalledWith({ apiKey: 'secret', dangerouslyAllowBrowser: true })
    expect(anthropic.stream).toHaveBeenCalledWith({
      model: 'claude-sonnet-5-5',
      max_tokens: 16_000,
      system: 'You are a historian',
      messages: [{ role: 'user', content: 'What happened this week?' }],
    }, { signal })
  })

  it('yields only text deltas', async () => {
    streamEvents([
      { type: 'message_start' },
      textDelta('Hello'),
      { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'hmm' } },
      textDelta(''),
      textDelta(' world'),
      { type: 'message_stop' },
    ])

    const stream = await streamClaudeCompletion(request)

    expect(await drain(stream)).toEqual(['Hello', ' world'])
  })

  it('rethrows mid-stream failures as errors with the formatted message', async () => {
    streamEvents([textDelta('partial')], { failure: apiError('overloaded') })
    const chunks: string[] = []

    const stream = await streamClaudeCompletion(request)

    await expect(async () => {
      for await (const chunk of stream)
        chunks.push(chunk)
    }).rejects.toThrow(new Error('overloaded'))
    expect(chunks).toEqual(['partial'])
  })

  it('rethrows mid-stream abort errors untouched', async () => {
    const abort = abortError()
    streamEvents([textDelta('partial')], { failure: abort })

    const stream = await streamClaudeCompletion(request)

    await expect(drain(stream)).rejects.toBe(abort)
  })

  it('fails with the explanation when Claude declines the request', async () => {
    streamEvents([], { final: { stop_reason: 'refusal', stop_details: { explanation: 'Policy blocks this.' } } })

    const stream = await streamClaudeCompletion(request)

    await expect(drain(stream)).rejects.toThrow(new Error('Claude declined this request: Policy blocks this.'))
  })

  it('fails instead of passing off a cut-off answer as complete', async () => {
    streamEvents([textDelta('partial')], { final: { stop_reason: 'max_tokens', stop_details: null } })

    const stream = await streamClaudeCompletion(request)

    await expect(drain(stream)).rejects.toThrow(new Error('Claude stopped at the output length limit before finishing.'))
  })

  it('fails with a generic message when Claude declines without an explanation', async () => {
    streamEvents([], { final: { stop_reason: 'refusal', stop_details: { explanation: null } } })

    const stream = await streamClaudeCompletion(request)

    await expect(drain(stream)).rejects.toThrow(new Error('Claude declined this request.'))
  })
})

describe('claudeProvider', () => {
  it('describes the provider and points at the Claude Console', () => {
    expect(claudeProvider).toMatchObject({
      id: 'claude',
      name: 'Claude',
      defaultModel: 'claude-sonnet-5-5',
      keyConsoleUrl: 'https://platform.claude.com/settings/keys',
      fetchModels: fetchClaudeModels,
      streamCompletion: streamClaudeCompletion,
    })
  })

  it('warns that keys need a funded account', () => {
    expect(claudeProvider.billingNote).toMatch(/prepaid credits/i)
    expect(claudeProvider.billingNote).toMatch(/no free tier/i)
  })
})
