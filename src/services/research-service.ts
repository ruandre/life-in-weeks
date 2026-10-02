import type { ResearchChunkStream, ResearchProvider } from '../types'
import { buildResearchPrompt, SYSTEM_PROMPT } from '../domain/research-prompt'
import { getWeekAge, getWeekEndDate, getWeekStartDate } from '../domain/timeline'
import { DATE_FORMAT } from '../lib/date'
import { streamGeminiCompletion } from './gemini'
import { streamLocalCompletion } from './local-model'

export {
  isLocalModelSupported,
  LOCAL_MODEL_NEEDS_USER_ACTIVATION,
  LOCAL_MODEL_UNAVAILABLE,
  warmUpLocalModel,
} from './local-model'

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw new DOMException('Superseded by a newer selection', 'AbortError')
}

export interface GeminiCredentials {
  apiKey: string
  model: string
}

export interface ResearchStreamOptions {
  weekIndex: number
  dobDate: Date | null
  country?: string | null
  provider: ResearchProvider
  gemini?: GeminiCredentials | null
  signal?: AbortSignal
  onDownloadProgress?: (loaded: number) => void
}

interface WeekDescription {
  age: number
  year: number | null
  isFuture: boolean
  weekRangeText: string | null
}

function describeWeek(weekIndex: number, dobDate: Date | null): WeekDescription {
  const { age } = getWeekAge(weekIndex)
  if (!dobDate)
    return { age, year: null, isFuture: false, weekRangeText: null }

  const weekStart = getWeekStartDate(dobDate, weekIndex)
  const weekEnd = getWeekEndDate(dobDate, weekIndex)
  return {
    age,
    year: weekStart.getFullYear(),
    isFuture: weekStart.getTime() > Date.now(),
    weekRangeText: `${DATE_FORMAT.format(weekStart)} to ${DATE_FORMAT.format(weekEnd)}`,
  }
}

// Caller owns rendering and cancellation
export async function createResearchStream({
  weekIndex,
  dobDate,
  country,
  provider,
  gemini,
  signal,
  onDownloadProgress,
}: ResearchStreamOptions): Promise<ResearchChunkStream> {
  throwIfAborted(signal)

  const meta = describeWeek(weekIndex, dobDate)
  const when = meta.weekRangeText
    ? `the week of ${meta.weekRangeText}`
    : `calendar year ${meta.year ?? 'unknown'}`

  const userPrompt = buildResearchPrompt({
    weekIndex,
    age: meta.age,
    when,
    year: meta.year ?? 'unknown year',
    isFuture: meta.isFuture,
    country: country?.trim() || null,
  })

  if (provider === 'gemini') {
    if (!gemini?.apiKey || !gemini.model)
      throw new Error('Add a Gemini API key and pick a model first.')

    const stream = await streamGeminiCompletion({
      apiKey: gemini.apiKey,
      model: gemini.model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      signal,
    })
    throwIfAborted(signal)
    return stream
  }

  const stream = await streamLocalCompletion({ userPrompt, signal, onDownloadProgress })
  throwIfAborted(signal)
  return stream
}
