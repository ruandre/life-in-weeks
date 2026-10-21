import type { CloudProviderId } from '../types'
import type { CloudProvider } from './cloud-provider'
import { geminiProvider } from './gemini'

export const CLOUD_PROVIDERS: Record<CloudProviderId, CloudProvider> = {
  gemini: geminiProvider,
}
