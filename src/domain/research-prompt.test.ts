import { describe, expect, it } from 'vitest'
import { buildResearchPrompt } from './research-prompt'

describe('buildResearchPrompt', () => {
  it('builds a past week prompt without country', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 100,
      age: 1,
      weekStart: new Date(2000, 0, 1),
      weekEnd: new Date(2000, 0, 7),
      today: new Date(2026, 9, 2),
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
      today: new Date(2026, 9, 2),
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
      today: new Date(2026, 9, 2),
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
      today: new Date(2026, 9, 2),
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
      today: new Date(2026, 9, 2),
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
      today: new Date(2026, 9, 2),
      country: 'Japan',
    })
    expect(prompt).toContain('A future week that hasn\'t happened yet')
    expect(prompt).toContain('May 10, 2055 to May 16, 2055')
    expect(prompt).toContain('## Outlook for 2055 in Japan')
    expect(prompt).toContain('## Outlook for 2055')
    expect(prompt).toContain('## Coming in 2055')
  })

  it('states today\'s date', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 100,
      age: 1,
      weekStart: new Date(2000, 0, 1),
      weekEnd: new Date(2000, 0, 7),
      today: new Date(2026, 9, 2, 15, 30),
      country: null,
    })
    expect(prompt).toContain('Today is October 2, 2026.')
  })

  it('treats a week starting tomorrow as future late in the day', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 1500,
      age: 28,
      weekStart: new Date(2026, 9, 3),
      weekEnd: new Date(2026, 9, 9),
      today: new Date(2026, 9, 2, 23, 59),
      country: null,
    })
    expect(prompt).toContain('A future week that hasn\'t happened yet')
  })

  it('frames the week containing today as in progress, not history', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 1500,
      age: 28,
      weekStart: new Date(2026, 8, 28),
      weekEnd: new Date(2026, 9, 4),
      today: new Date(2026, 9, 2, 15, 30),
      country: null,
    })
    expect(prompt).toContain('The current week, still in progress.')
    expect(prompt).toContain('## Outlook for 2026')
    expect(prompt).not.toContain('## That week in history')
  })

  it('treats a week starting today as current', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 1500,
      age: 28,
      weekStart: new Date(2026, 9, 2),
      weekEnd: new Date(2026, 9, 8),
      today: new Date(2026, 9, 2),
      country: null,
    })
    expect(prompt).toContain('The current week, still in progress.')
  })

  it('treats a week ending today as current late in the day', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 1500,
      age: 28,
      weekStart: new Date(2026, 8, 26),
      weekEnd: new Date(2026, 9, 2),
      today: new Date(2026, 9, 2, 23, 59),
      country: null,
    })
    expect(prompt).toContain('The current week, still in progress.')
  })

  it('treats a week that ended yesterday as history', () => {
    const prompt = buildResearchPrompt({
      weekIndex: 1500,
      age: 28,
      weekStart: new Date(2026, 8, 25),
      weekEnd: new Date(2026, 9, 1),
      today: new Date(2026, 9, 2),
      country: null,
    })
    expect(prompt).toContain('## That week in history')
  })
})
