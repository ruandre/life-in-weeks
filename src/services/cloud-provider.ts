import type { CloudProviderId, ModelOption, ResearchChunkStream, ResearchEffort } from '../types'

export interface ModelListOptions {
  apiKey: string
  signal?: AbortSignal
}

export interface CompletionStreamOptions {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  /** Omitted leaves the model's default; providers without effort ignore it */
  effort?: ResearchEffort | null
  signal?: AbortSignal
}

export interface CloudCredentials {
  apiKey: string
  model: string
}

export interface CloudProvider {
  id: CloudProviderId
  name: string
  defaultModel: string
  keyPlaceholder: string
  keyConsoleUrl: string
  keyConsoleName: string
  billingNote: string
  fetchModels: (options: ModelListOptions) => Promise<ModelOption[]>
  streamCompletion: (options: CompletionStreamOptions) => Promise<ResearchChunkStream>
}
