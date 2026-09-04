/* eslint-disable vars-on-top */
import type { LanguageModelStatic, ModelContext } from './types'

declare global {
  var LanguageModel: LanguageModelStatic | undefined
  var Temporal: any

  interface Navigator {
    modelContext?: ModelContext
  }

  interface Document {
    modelContext?: ModelContext
  }

  interface Window {
    __LIFE_IN_WEEKS__?: unknown
  }

  interface SubmitEvent {
    agentInvoked?: boolean
    respondWith?: (promise: Promise<unknown>) => void
  }
}

declare module 'svelte/elements' {
  export interface HTMLAttributes<T extends EventTarget> {
    toolname?: string
    tooldescription?: string
    toolautosubmit?: boolean | ''
    toolparamdescription?: string
  }
}

export {}
