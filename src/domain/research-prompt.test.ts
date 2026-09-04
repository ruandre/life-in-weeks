import { describe, expect, it } from 'vitest'
import { buildResearchPrompt } from './research-prompt'

describe('buildResearchPrompt', () => {
  it('builds a past week prompt without country', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 100,
      age: 1,
      when: 'the week of January 1 to January 7, 2000',
      year: 2000,
      isFuture: false,
      country: null,
    })
    expect(prompt).toContain('Week 100 of the user\'s life')
    expect(prompt).toContain('## That week in history')
    expect(prompt).toContain('## Pop culture in 2000')
    expect(prompt).toContain('## Age 1 milestones')
    expect(prompt).toContain('## Dad joke')
    expect(prompt).not.toContain('## That week in null')
    expect(prompt).not.toMatch(/## That week in (?!history)/)
  })

  it('includes country section for past week when country provided', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 100,
      age: 1,
      when: 'the week of January 1 to January 7, 2000',
      year: 2000,
      isFuture: false,
      country: 'France',
    })
    expect(prompt).toContain('## That week in France')
    expect(prompt).toContain('## That week in history')
  })

  it('builds a future week prompt with outlook sections', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 3000,
      age: 57,
      when: 'a future week',
      year: 2055,
      isFuture: true,
      country: 'Japan',
    })
    expect(prompt).toContain('A future week that hasn\'t happened yet')
    expect(prompt).toContain('## Outlook for 2055 in Japan')
    expect(prompt).toContain('## Outlook for 2055')
    expect(prompt).toContain('## Coming in 2055')
  })
})
