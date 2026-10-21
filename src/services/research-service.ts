import type { CloudProviderId, ResearchChunkStream, ResearchProvider } from '../types'
import type { CloudCredentials } from './cloud-provider'
import { buildResearchPrompt, SYSTEM_PROMPT } from '../domain/research-prompt'
import { getWeekAge, getWeekEndDate, getWeekStartDate } from '../domain/timeline'
import { CLOUD_PROVIDERS } from './cloud-provider-registry'
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

export interface ResearchStreamOptions {
  weekIndex: number
  dobDate: Date
  country?: string | null
  provider: ResearchProvider
  credentials?: CloudCredentials | null
  signal?: AbortSignal
  onDownloadProgress?: (loaded: number) => void
}

async function streamFromCloud(
  providerId: CloudProviderId,
  credentials: CloudCredentials | null | undefined,
  userPrompt: string,
  signal?: AbortSignal,
): Promise<ResearchChunkStream> {
  const provider = CLOUD_PROVIDERS[providerId]
  if (!credentials?.apiKey || !credentials.model)
    throw new Error(`Add a ${provider.name} API key and pick a model first.`)

  return provider.streamCompletion({
    apiKey: credentials.apiKey,
    model: credentials.model,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    signal,
  })
}

// Caller owns rendering and cancellation
export async function createResearchStream({
  weekIndex,
  dobDate,
  country,
  provider,
  credentials,
  signal,
  onDownloadProgress,
}: ResearchStreamOptions): Promise<ResearchChunkStream> {
  throwIfAborted(signal)

  const weekStart = getWeekStartDate(dobDate, weekIndex)
  const userPrompt = buildResearchPrompt({
    weekIndex,
    age: getWeekAge(weekIndex).age,
    weekStart,
    weekEnd: getWeekEndDate(dobDate, weekIndex),
    today: new Date(),
    country: country?.trim() || null,
  })

  const stream = provider === 'local'
    ? await streamLocalCompletion({ userPrompt, signal, onDownloadProgress })
    : await streamFromCloud(provider, credentials, userPrompt, signal)
  throwIfAborted(signal)
  return stream
}
