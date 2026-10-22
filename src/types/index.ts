export type LanguageModelAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

export interface LanguageModelExpected {
  type: 'text' | 'image' | 'audio'
  languages?: string[]
}

export interface LanguageModelAvailabilityOptions {
  expectedInputs?: LanguageModelExpected[]
  expectedOutputs?: LanguageModelExpected[]
}

export interface LanguageModelCreateOptions extends LanguageModelAvailabilityOptions {
  initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant', content: string }>
  signal?: AbortSignal
  /** Receives target firing `downloadprogress` events; `loaded` spans 0 to 1 */
  monitor?: (monitor: EventTarget) => void
}

export interface LanguageModelSession {
  clone: () => Promise<LanguageModelSession>
  promptStreaming: (prompt: string, options?: { signal?: AbortSignal }) => AsyncIterable<string>
  destroy: () => void
}

export interface LanguageModelStatic {
  create: (options?: LanguageModelCreateOptions) => Promise<LanguageModelSession>
  availability: (options?: LanguageModelAvailabilityOptions) => Promise<LanguageModelAvailability>
}

export interface ModelContextTool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  execute: (args: any) => Promise<unknown> | unknown
  annotations?: { readOnlyHint?: boolean }
}

export interface ModelContext {
  registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => Promise<void>
}

export type ResearchChunkStream = AsyncIterable<string>

export type CloudProviderId = 'gemini' | 'claude'

export type ResearchProvider = 'local' | CloudProviderId

export interface ModelOption {
  id: string
  name: string
}

export type KeyStatus = 'empty' | 'checking' | 'valid' | 'invalid'
