export interface LanguageModelCreateOptions {
  expectedOutputs?: Array<{ type: string, languages?: string[] }>
  initialPrompts?: Array<{ role: 'system' | 'user' | 'assistant', content: string }>
  signal?: AbortSignal
}

export interface LanguageModelSession {
  clone: () => Promise<LanguageModelSession>
  promptStreaming: (prompt: string, options?: { signal?: AbortSignal }) => AsyncIterable<string>
  destroy: () => void
}

export interface LanguageModelStatic {
  create: (options?: LanguageModelCreateOptions) => Promise<LanguageModelSession>
  availability: () => Promise<'readily' | 'after-download' | 'no' | 'unavailable' | string>
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

export type ResearchProvider = 'local' | 'gemini'

export interface GeminiModel {
  id: string
  name: string
}

export type GeminiKeyStatus = 'empty' | 'checking' | 'valid' | 'invalid'
