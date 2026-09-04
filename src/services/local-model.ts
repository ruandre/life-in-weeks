import type { LanguageModelSession, LanguageModelStatic, ResearchChunkStream } from '../types'
import { SYSTEM_PROMPT } from '../domain/research-prompt'

let baseSessionPromise: Promise<LanguageModelSession> | null = null

function getLanguageModel(): LanguageModelStatic | undefined {
  return globalThis.LanguageModel
}

// Warm session holds system prompt; clones keep turns isolated
function getBaseSession(): Promise<LanguageModelSession> {
  const LM = getLanguageModel()
  if (!LM)
    return Promise.reject(new Error('LanguageModel unavailable'))
  if (!baseSessionPromise) {
    baseSessionPromise = LM.create({
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
    })
  }
  return baseSessionPromise
}

export function warmUpLocalModel(): void {
  if ('LanguageModel' in globalThis)
    getBaseSession().catch(() => {})
}

export function isLocalModelSupported(): boolean {
  return typeof globalThis !== 'undefined' && 'LanguageModel' in globalThis
}

export async function checkLocalModelAvailability(): Promise<string> {
  const LM = getLanguageModel()
  if (!LM)
    return 'unavailable'
  return LM.availability()
}

export interface LocalModelStreamOptions {
  userPrompt: string
  signal?: AbortSignal
}

/** Throws UNAVAILABLE when model present but not downloaded */
export async function streamLocalCompletion({
  userPrompt,
  signal,
}: LocalModelStreamOptions): Promise<ResearchChunkStream> {
  if (await checkLocalModelAvailability() === 'unavailable')
    throw new Error('UNAVAILABLE')

  const base = await getBaseSession()
  const session = await base.clone()
  const stream = session.promptStreaming(userPrompt, { signal })

  async function* withCleanup(): AsyncGenerator<string, void, unknown> {
    try {
      for await (const chunk of stream) {
        yield chunk
      }
    }
    finally {
      try {
        session.destroy()
      }
      catch {}
    }
  }

  return withCleanup()
}

export function resetLocalModelForTesting(): void {
  baseSessionPromise = null
}
