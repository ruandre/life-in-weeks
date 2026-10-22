import type { CloudProviderId } from '../types'
import type { CloudProvider } from './cloud-provider'
import { claudeProvider } from './claude'
import { geminiProvider } from './gemini'

export const CLOUD_PROVIDERS: Record<CloudProviderId, CloudProvider> = {
  gemini: geminiProvider,
  claude: claudeProvider,
}

export function isCloudProviderId(value: string): value is CloudProviderId {
  return Object.hasOwn(CLOUD_PROVIDERS, value)
}
