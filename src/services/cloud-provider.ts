import type { CloudProviderId, ModelOption, ResearchChunkStream } from '../types'

export interface ModelListOptions {
  apiKey: string
  signal?: AbortSignal
}

export interface CompletionStreamOptions {
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
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
