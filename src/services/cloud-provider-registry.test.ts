import { describe, expect, it } from 'vitest'
import { isCloudProviderId } from './cloud-provider-registry'

describe('isCloudProviderId', () => {
  it.each(['gemini', 'claude'])('accepts %s', (id) => {
    expect(isCloudProviderId(id)).toBe(true)
  })

  it.each(['local', '', 'constructor', 'toString'])('rejects %j', (id) => {
    expect(isCloudProviderId(id)).toBe(false)
  })
})
