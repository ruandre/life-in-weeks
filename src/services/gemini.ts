import type { GeminiModel, ResearchChunkStream } from '../types'

export const RECOMMENDED_MODELS: GeminiModel[] = [
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
]

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash'

export function formatGeminiError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    let msg = String(err.message)
    // Google API error payloads may nest JSON strings
    for (let i = 0; i < 4; i++) {
      try {
        const parsed = JSON.parse(msg)
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

function isAbortError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted)
    return true
  if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError')
    return true
  return false
}

export interface ModelListOptions {
  apiKey: string
  signal?: AbortSignal
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
}: ModelListOptions): Promise<GeminiModel[]> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })
  try {
    const pager = await ai.models.list({
      config: {
        abortSignal: signal,
      },
    })

    const fetched: GeminiModel[] = []
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

    const results: GeminiModel[] = []
    for (const rec of RECOMMENDED_MODELS) {
      const existing = fetched.find(m => m.id === rec.id)
      results.push(existing || rec)
    }
    for (const model of fetched) {
      if (!results.some(r => r.id === model.id)) {
        results.push(model)
      }
    }

    return results
  }
  catch (err) {
    if (isAbortError(err, signal))
      throw err
    throw new Error(formatGeminiError(err))
  }
}

export interface GeminiStreamOptions {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  signal?: AbortSignal
}

export async function streamGeminiCompletion({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  signal,
}: GeminiStreamOptions): Promise<ResearchChunkStream> {
  const { GoogleGenAI } = await import('@google/genai')
  const ai = new GoogleGenAI({ apiKey })

  let responseStream: AsyncGenerator<any, void, unknown>
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
    if (isAbortError(err, signal))
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
      if (isAbortError(err, signal))
        throw err
      throw new Error(formatGeminiError(err))
    }
  }

  return generator()
}
