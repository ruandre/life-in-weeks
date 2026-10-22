import type { ResearchEffort } from '../types'

export const RESEARCH_EFFORTS: readonly ResearchEffort[] = ['low', 'medium', 'high']

// Fastest and cheapest; a week card needs little reasoning
export const DEFAULT_RESEARCH_EFFORT: ResearchEffort = 'low'

export function isResearchEffort(value: string): value is ResearchEffort {
  return (RESEARCH_EFFORTS as readonly string[]).includes(value)
}
