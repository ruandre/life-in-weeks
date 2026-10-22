import type { CloudProvider } from '../services/cloud-provider'
import type { CloudProviderId, KeyStatus, ModelOption, ResearchEffort, ResearchProvider } from '../types'
import { DEFAULT_RESEARCH_EFFORT } from '../domain/research-effort'
import { getErrorMessage, isAbortError } from '../lib/errors'
import { CLOUD_PROVIDERS } from '../services/cloud-provider-registry'
import { warmUpLocalModel } from '../services/research-service'

const VERIFY_DEBOUNCE_MS = 500
const DEFAULT_CLOUD_PROVIDER: CloudProviderId = 'gemini'

export class SettingsState {
  cloudProviderId = $state<CloudProviderId>(DEFAULT_CLOUD_PROVIDER)

  // In-memory only; do not persist credentials
  apiKey = $state('')
  // eslint-disable-next-line security/detect-object-injection -- constant CloudProviderId key
  model = $state(CLOUD_PROVIDERS[DEFAULT_CLOUD_PROVIDER].defaultModel)

  // A preference, not a credential: survives provider switches and panel close
  effort = $state<ResearchEffort>(DEFAULT_RESEARCH_EFFORT)

  models = $state.raw<ModelOption[]>([])
  keyStatus = $state<KeyStatus>('empty')
  keyError = $state<string | null>(null)

  isPanelOpen = $state(false)

  private verifyTimer: ReturnType<typeof setTimeout> | null = null
  private verifyController: AbortController | null = null

  get cloudProvider(): CloudProvider {
    return CLOUD_PROVIDERS[this.cloudProviderId]
  }

  // Open panel routes to the cloud provider; prevents silent local fallback during configuration
  get provider(): ResearchProvider {
    return this.apiKey.trim() || this.isPanelOpen ? this.cloudProviderId : 'local'
  }

  get hasCredentials(): boolean {
    return Boolean(this.apiKey.trim() && this.model)
  }

  get canPickModel(): boolean {
    return this.keyStatus === 'valid' && this.models.length > 0
  }

  // Recommended entries cover the default model before the list loads
  private get selectedModel(): ModelOption | undefined {
    return [...this.models, ...this.cloudProvider.recommendedModels].find(option => option.id === this.model)
  }

  get canChooseEffort(): boolean {
    return this.cloudProvider.offersEffort && this.selectedModel?.supportsEffort === true
  }

  /** Effort to send with research; null leaves the model's default */
  get requestEffort(): ResearchEffort | null {
    return this.canChooseEffort ? this.effort : null
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

  // A key belongs to one provider, so switching wipes it
  setCloudProvider(id: CloudProviderId): void {
    if (id === this.cloudProviderId)
      return
    this.cloudProviderId = id
    this.clearCredentials()
  }

  setApiKey(value: string): void {
    this.apiKey = value.trim()
    this.scheduleVerification()
  }

  setModel(value: string): void {
    this.model = value
  }

  setEffort(value: ResearchEffort): void {
    this.effort = value
  }

  private clearCredentials(): void {
    this.cancelPendingVerification()
    this.keyError = null
    this.apiKey = ''
    this.model = this.cloudProvider.defaultModel
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
      const models = await this.cloudProvider.fetchModels({
        apiKey: this.apiKey,
        signal: controller.signal,
      })
      if (controller.signal.aborted)
        return
      this.keyStatus = 'valid'
      this.models = models
      this.selectDefaultModel(models)
    }
    catch (err: unknown) {
      this.recordFailure(err, controller)
    }
  }

  private recordFailure(err: unknown, controller: AbortController): void {
    if (isAbortError(err) || controller.signal.aborted)
      return
    this.keyStatus = 'invalid'
    this.keyError = getErrorMessage(err) || `Could not reach ${this.cloudProvider.name} API.`
    this.models = []
  }

  private selectDefaultModel(models: ModelOption[]): void {
    const { defaultModel } = this.cloudProvider
    if (models.some(model => model.id === this.model))
      return
    if (models.some(model => model.id === defaultModel)) {
      this.setModel(defaultModel)
      return
    }
    this.setModel(models[0]?.id ?? defaultModel)
  }
}

export const settingsState = new SettingsState()
