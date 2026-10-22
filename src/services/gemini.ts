import type { GenerateContentResponse } from '@google/genai'
import type { ModelOption, ResearchChunkStream } from '../types'
import type { CloudProvider, CompletionStreamOptions, ModelListOptions } from './cloud-provider'
import { mergeRecommendedModels } from '../domain/model-options'
import { isAbortError } from '../lib/errors'

export const RECOMMENDED_MODELS: ModelOption[] = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
]

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'

// Mid-stream errors prefix the payload with "got status: …"
function sliceJsonObject(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start === -1 || end < start ? text : text.slice(start, end + 1)
}

export function formatGeminiError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    let msg = String(err.message)
    // Google API error payloads may nest JSON strings
    for (let i = 0; i < 4; i++) {
      try {
        const parsed = JSON.parse(sliceJsonObject(msg))
        if (typeof parsed?.error?.message === 'string')
          msg = parsed.error.message
        else if (typeof parsed?.message === 'string')
          msg = parsed.message
        else
          break
      }
      catch {
        break
      }
    }
    return msg
  }
  return String(err || 'Unknown error')
}

function isCancelled(err: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || isAbortError(err)
}

const NON_TEXT_KEYWORDS = [
  'image',
  'imagen',
  'banana',
  'audio',
  'tts',
  'speech',
  'video',
  'veo',
  'lyria',
  'music',
  'embedding',
  'embed',
  'robotics',
  'aqa',
  'customtools',
]

export function isTextModel(id: string, supportedActions?: string[]): boolean {
  const lower = id.toLowerCase()

  if (supportedActions && !supportedActions.includes('generateContent'))
    return false

  if (NON_TEXT_KEYWORDS.some(kw => lower.includes(kw)))
    return false

  // Deprecated models
  if (lower.startsWith('gemini-1.') || lower.startsWith('gemini-2.0'))
    return false

  return lower.startsWith('gemini-') || lower.startsWith('gemma-')
}

export async function fetchGeminiModels({
  apiKey,
  signal,
}: ModelListOptions): Promise<ModelOption[]> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })
  try {
    const pager = await ai.models.list({
      config: {
        abortSignal: signal,
      },
    })

    const fetched: ModelOption[] = []
    for await (const model of pager) {
      if (!model.name)
        continue
      const id = model.name.replace(/^models\//, '')
      if (!isTextModel(id, model.supportedActions))
        continue
      fetched.push({
        id,
        name: model.displayName || id,
      })
    }

    return mergeRecommendedModels(RECOMMENDED_MODELS, fetched)
  }
  catch (err) {
    if (isCancelled(err, signal))
      throw err
    throw new Error(formatGeminiError(err))
  }
}

export async function streamGeminiCompletion({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  signal,
}: CompletionStreamOptions): Promise<ResearchChunkStream> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })

  let responseStream: AsyncGenerator<GenerateContentResponse>
  try {
    responseStream = await ai.models.generateContentStream({
      model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        abortSignal: signal,
      },
    })
  }
  catch (err) {
    if (isCancelled(err, signal))
      throw err
    throw new Error(formatGeminiError(err))
  }

  async function* generator(): AsyncGenerator<string, void, unknown> {
    try {
      for await (const chunk of responseStream) {
        if (chunk.text)
          yield chunk.text
      }
    }
    catch (err) {
      if (isCancelled(err, signal))
        throw err
      throw new Error(formatGeminiError(err))
    }
  }

  return generator()
}

export const geminiProvider: CloudProvider = {
  id: 'gemini',
  name: 'Gemini',
  defaultModel: DEFAULT_GEMINI_MODEL,
  recommendedModels: RECOMMENDED_MODELS,
  offersEffort: false,
  keyPlaceholder: 'AIzaSy…',
  keyConsoleUrl: 'https://aistudio.google.com/apikey',
  keyConsoleName: 'Google AI Studio',
  billingNote: 'Free keys are available.',
  fetchModels: fetchGeminiModels,
  streamCompletion: streamGeminiCompletion,
}
