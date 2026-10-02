import type { GeminiKeyStatus, GeminiModel, ResearchProvider } from '../types'
import {
  DEFAULT_GEMINI_MODEL,
  fetchGeminiModels,
  formatGeminiError,
} from '../services/gemini'
import { warmUpLocalModel } from '../services/research-service'

const VERIFY_DEBOUNCE_MS = 500

export class SettingsState {
  // In-memory only; do not persist credentials
  apiKey = $state('')
  model = $state(DEFAULT_GEMINI_MODEL)

  models = $state.raw<GeminiModel[]>([])
  keyStatus = $state<GeminiKeyStatus>('empty')
  keyError = $state<string | null>(null)

  isPanelOpen = $state(false)

  private verifyTimer: ReturnType<typeof setTimeout> | null = null
  private verifyController: AbortController | null = null

  // Open panel routes to Gemini; prevents silent local fallback during configuration
  get provider(): ResearchProvider {
    return this.apiKey.trim() || this.isPanelOpen ? 'gemini' : 'local'
  }

  get hasCredentials(): boolean {
    return Boolean(this.apiKey.trim() && this.model)
  }

  get canPickModel(): boolean {
    return this.keyStatus === 'valid' && this.models.length > 0
  }

  setPanelOpen(isOpen: boolean): void {
    this.isPanelOpen = isOpen
    if (isOpen) {
      if (this.apiKey && this.keyStatus !== 'valid')
        this.verifyAndLoad()
    }
    else {
      this.clearCredentials()
      warmUpLocalModel()
    }
  }

  setApiKey(value: string): void {
    this.apiKey = value.trim()
    this.scheduleVerification()
  }

  setModel(value: string): void {
    this.model = value
  }

  private clearCredentials(): void {
    this.cancelPendingVerification()
    this.keyError = null
    this.apiKey = ''
    this.model = DEFAULT_GEMINI_MODEL
    this.models = []
    this.keyStatus = 'empty'
  }

  private scheduleVerification(): void {
    this.cancelPendingVerification()
    this.keyError = null

    if (!this.apiKey) {
      this.clearCredentials()
      return
    }

    this.keyStatus = 'checking'
    this.verifyTimer = setTimeout(() => this.verifyAndLoad(), VERIFY_DEBOUNCE_MS)
  }

  private cancelPendingVerification(): void {
    if (this.verifyTimer !== null)
      clearTimeout(this.verifyTimer)
    this.verifyTimer = null
    this.verifyController?.abort()
  }

  private startRequest(): AbortController {
    this.cancelPendingVerification()
    const controller = new AbortController()
    this.verifyController = controller
    return controller
  }

  private async verifyAndLoad(): Promise<void> {
    const controller = this.startRequest()
    this.keyStatus = 'checking'
    this.keyError = null

    try {
      const models = await fetchGeminiModels({
        apiKey: this.apiKey,
        signal: controller.signal,
      })
      if (controller.signal.aborted)
        return
      this.keyStatus = 'valid'
      this.models = models
      this.selectDefaultModel(models)
    }
    catch (err: any) {
      this.recordFailure(err, controller)
    }
  }

  private recordFailure(err: any, controller: AbortController): void {
    if (err?.name === 'AbortError' || controller.signal.aborted)
      return
    this.keyStatus = 'invalid'
    this.keyError = formatGeminiError(err) || 'Could not reach Gemini API.'
    this.models = []
  }

  private selectDefaultModel(models: GeminiModel[]): void {
    if (models.some(model => model.id === this.model))
      return
    if (models.some(model => model.id === DEFAULT_GEMINI_MODEL)) {
      this.setModel(DEFAULT_GEMINI_MODEL)
      return
    }
    this.setModel(models[0]?.id ?? DEFAULT_GEMINI_MODEL)
  }
}

export const settingsState = new SettingsState()
