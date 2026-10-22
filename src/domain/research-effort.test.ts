import { describe, expect, it } from 'vitest'
import { isResearchEffort } from './research-effort'

describe('isResearchEffort', () => {
  it.each(['low', 'medium', 'high'])('accepts %s', (value) => {
    expect(isResearchEffort(value)).toBe(true)
  })

  it.each(['xhigh', 'max', '', 'Low'])('rejects %j', (value) => {
    expect(isResearchEffort(value)).toBe(false)
  })
})
