import type { Message, MessageStreamEvent } from '@anthropic-ai/sdk/resources/messages'
import type { ModelOption, ResearchChunkStream } from '../types'
import type { CloudProvider, CompletionStreamOptions, ModelListOptions } from './cloud-provider'
import { mergeRecommendedModels } from '../domain/model-options'
import { getErrorMessage, isAbortError } from '../lib/errors'

export const RECOMMENDED_CLAUDE_MODELS: ModelOption[] = [
  { id: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5' },
  { id: 'claude-haiku-5-5', name: 'Claude Haiku 5.5' },
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5' },
]

export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5-5'

// Adaptive thinking counts toward this cap; a lower one risks cutting the card short
const MAX_OUTPUT_TOKENS = 16_000

// APIError.error carries the parsed body: { type: 'error', error: { type, message } }
function readApiErrorMessage(err: unknown): string | undefined {
  const message = (err as { error?: { error?: { message?: unknown } } } | null)?.error?.error?.message
  return typeof message === 'string' ? message : undefined
}

export function formatClaudeError(err: unknown): string {
  if (!err)
    return 'Unknown error'
  return readApiErrorMessage(err) ?? getErrorMessage(err)
}

function toReadableError(err: unknown, signal?: AbortSignal): unknown {
  if (signal?.aborted || isAbortError(err))
    return err
  return new Error(formatClaudeError(err))
}

async function createClient(apiKey: string) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  // Key is user supplied and held in tab memory only, so direct browser calls are intended
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
}

export async function fetchClaudeModels({
  apiKey,
  signal,
}: ModelListOptions): Promise<ModelOption[]> {
  const client = await createClient(apiKey)
  try {
    const fetched: ModelOption[] = []
    for await (const model of client.models.list({ lifecycle: ['active'] }, { signal }))
      fetched.push({ id: model.id, name: model.display_name || model.id })
    return mergeRecommendedModels(RECOMMENDED_CLAUDE_MODELS, fetched)
  }
  catch (err) {
    throw toReadableError(err, signal)
  }
}

function textDelta(event: MessageStreamEvent): string | undefined {
  if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta')
    return undefined
  return event.delta.text
}

function throwIfUnfinished(message: Message): void {
  if (message.stop_reason === 'max_tokens')
    throw new Error('Claude stopped at the output length limit before finishing.')
  if (message.stop_reason !== 'refusal')
    return
  const explanation = message.stop_details?.explanation
  throw new Error(explanation ? `Claude declined this request: ${explanation}` : 'Claude declined this request.')
}

export async function streamClaudeCompletion({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  signal,
}: CompletionStreamOptions): Promise<ResearchChunkStream> {
  const client = await createClient(apiKey)
  const stream = client.messages.stream({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  }, { signal })

  async function* generator(): AsyncGenerator<string, void, unknown> {
    try {
      for await (const event of stream) {
        const text = textDelta(event)
        if (text)
          yield text
      }
    }
    catch (err) {
      throw toReadableError(err, signal)
    }
    throwIfUnfinished(await stream.finalMessage())
  }

  return generator()
}

export const claudeProvider: CloudProvider = {
  id: 'claude',
  name: 'Claude',
  defaultModel: DEFAULT_CLAUDE_MODEL,
  keyPlaceholder: 'sk-ant-…',
  keyConsoleUrl: 'https://platform.claude.com/settings/keys',
  keyConsoleName: 'Claude Console',
  billingNote: 'No free tier: the account needs prepaid credits, and the key check passes even with a zero balance. Each week costs a few cents on Sonnet 5.5.',
  fetchModels: fetchClaudeModels,
  streamCompletion: streamClaudeCompletion,
}
