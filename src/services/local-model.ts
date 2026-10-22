import type {
  LanguageModelAvailability,
  LanguageModelAvailabilityOptions,
  LanguageModelSession,
  LanguageModelStatic,
  ResearchChunkStream,
} from '../types'
import { SYSTEM_PROMPT } from '../domain/research-prompt'

export type LocalModelFailure = 'unavailable' | 'needs-user-activation'

export class LocalModelError extends Error {
  override readonly name = 'LocalModelError'

  constructor(readonly code: LocalModelFailure) {
    super(`On-device model failure: ${code}`)
  }
}

// availability() answers accurately only when given create() options
const LANGUAGE_OPTIONS = {
  expectedInputs: [{ type: 'text', languages: ['en'] }],
  expectedOutputs: [{ type: 'text', languages: ['en'] }],
} satisfies LanguageModelAvailabilityOptions

type DownloadProgressListener = (loaded: number) => void

let baseSessionPromise: Promise<LanguageModelSession> | null = null
// Latest caller wins; superseded selections stop receiving progress
let downloadProgressListener: DownloadProgressListener | null = null

function getLanguageModel(): LanguageModelStatic | undefined {
  return globalThis.LanguageModel
}

// Warm session holds system prompt; clones keep turns isolated
function getBaseSession(): Promise<LanguageModelSession> {
  const LM = getLanguageModel()
  if (!LM)
    return Promise.reject(new Error('LanguageModel unavailable'))
  if (!baseSessionPromise) {
    const pending = LM.create({
      ...LANGUAGE_OPTIONS,
      initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
      monitor(monitor) {
        monitor.addEventListener('downloadprogress', (event) => {
          downloadProgressListener?.((event as ProgressEvent).loaded)
        })
      },
    })
    // Cached rejection would fail every later attempt
    pending.catch(() => {
      if (baseSessionPromise === pending)
        baseSessionPromise = null
    })
    baseSessionPromise = pending
  }
  return baseSessionPromise
}

// Unknown activation support defers decision to create()
function hasUserActivation(): boolean {
  return globalThis.navigator?.userActivation?.isActive ?? true
}

// create() demands user gesture until model downloaded; warm-up runs without one
export async function warmUpLocalModel(): Promise<void> {
  try {
    if (await checkLocalModelAvailability() === 'available')
      await getBaseSession()
  }
  catch {}
}

export function isLocalModelSupported(): boolean {
  return typeof globalThis !== 'undefined' && 'LanguageModel' in globalThis
}

export async function checkLocalModelAvailability(): Promise<LanguageModelAvailability> {
  const LM = getLanguageModel()
  if (!LM)
    return 'unavailable'
  return LM.availability(LANGUAGE_OPTIONS)
}

export interface LocalModelStreamOptions {
  userPrompt: string
  signal?: AbortSignal
  /** Fires only while model downloads; `loaded` spans 0 to 1 */
  onDownloadProgress?: DownloadProgressListener
}

/**
 * Throws LocalModelError 'unavailable' when device cannot run model;
 * 'needs-user-activation' when download must start from user gesture
 */
export async function streamLocalCompletion({
  userPrompt,
  signal,
  onDownloadProgress,
}: LocalModelStreamOptions): Promise<ResearchChunkStream> {
  const availability = await checkLocalModelAvailability()
  if (availability === 'unavailable')
    throw new LocalModelError('unavailable')

  const needsDownload = availability !== 'available'
  if (needsDownload && !baseSessionPromise && !hasUserActivation())
    throw new LocalModelError('needs-user-activation')

  downloadProgressListener = needsDownload ? onDownloadProgress ?? null : null

  const base = await getBaseSession()
  const session = await base.clone()
  const destroySession = (): void => {
    try {
      session.destroy()
    }
    catch {}
  }

  // Unstarted generators skip finally; abort must free the session itself
  if (signal?.aborted) {
    destroySession()
    signal.throwIfAborted()
  }
  signal?.addEventListener('abort', destroySession, { once: true })

  async function* withCleanup(): AsyncGenerator<string, void, unknown> {
    try {
      yield* session.promptStreaming(userPrompt, { signal })
    }
    finally {
      signal?.removeEventListener('abort', destroySession)
      destroySession()
    }
  }

  return withCleanup()
}

export function resetLocalModelForTesting(): void {
  baseSessionPromise = null
  downloadProgressListener = null
}
