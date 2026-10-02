import { describe, expect, it } from 'vitest'
import { buildResearchPrompt } from './research-prompt'

describe('buildResearchPrompt', () => {
  it('builds a past week prompt without country', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 100,
      age: 1,
      weekStart: new Date(2000, 0, 1),
      weekEnd: new Date(2000, 0, 7),
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

  it('states the exact inclusive date range of the week', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 100,
      age: 1,
      weekStart: new Date(2000, 0, 1),
      weekEnd: new Date(2000, 0, 7),
      isFuture: false,
      country: null,
    })
    expect(prompt).toContain('January 1, 2000 to January 7, 2000')
  })

  it('anchors every week-specific instruction to the exact dates', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 100,
      age: 1,
      weekStart: new Date(2000, 0, 1),
      weekEnd: new Date(2000, 0, 7),
      isFuture: false,
      country: 'France',
    })
    expect(prompt).not.toContain('that specific week')
    expect(prompt.match(/January 1, 2000 to January 7, 2000/g)).toHaveLength(3)
  })

  it('names both years when the week spans New Year', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 7,
      age: 0,
      weekStart: new Date(1999, 11, 29),
      weekEnd: new Date(2000, 0, 4),
      isFuture: false,
      country: null,
    })
    expect(prompt).toContain('December 29, 1999 to January 4, 2000')
    expect(prompt).toContain('## Pop culture in 1999–2000')
  })

  it('includes country section for past week when country provided', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 100,
      age: 1,
      weekStart: new Date(2000, 0, 1),
      weekEnd: new Date(2000, 0, 7),
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
      weekStart: new Date(2055, 4, 10),
      weekEnd: new Date(2055, 4, 16),
      isFuture: true,
      country: 'Japan',
    })
    expect(prompt).toContain('A future week that hasn\'t happened yet')
    expect(prompt).toContain('May 10, 2055 to May 16, 2055')
    expect(prompt).toContain('## Outlook for 2055 in Japan')
    expect(prompt).toContain('## Outlook for 2055')
    expect(prompt).toContain('## Coming in 2055')
  })
})
