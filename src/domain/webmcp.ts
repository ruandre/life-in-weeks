import { LIFESPAN_MAX_YEARS, LIFESPAN_MIN_YEARS } from '../config/constants'
import { parseLocalDate } from '../lib/date'
import { calculateTimeline } from './timeline'

export interface WebMCPOptions {
  getDob: () => string
  getLifespan: () => number
  /** Resolves null when a newer selection supersedes this one */
  selectWeek: (weekIndex: number) => Promise<string | null>
}

// No-ops when modelContext unsupported
export function initWebMCP({ getDob, getLifespan, selectWeek }: WebMCPOptions): () => void {
  const modelContext = (typeof document !== 'undefined' ? document.modelContext : undefined)
    || (typeof navigator !== 'undefined' ? navigator.modelContext : undefined)

  if (!modelContext || !('registerTool' in modelContext)) {
    return () => {}
  }

  const controller = new AbortController()
  const { signal } = controller

  modelContext.registerTool(
    {
      name: 'select_and_research_week',
      description:
        'Selects a week on the user\'s timeline and researches it: world and local events, pop culture of the period, typical development at that age, and a dad joke. Use this when the user asks about a specific week or age. Weeks are numbered from 1, with 52 weeks per year of age (e.g. week 53 is the first week of age 1).',
      inputSchema: {
        type: 'object',
        properties: {
          week_index: {
            type: 'integer',
            description: 'The 1-based index of the week to research, within the range currently rendered on the timeline.',
          },
        },
        required: ['week_index'],
      },
      execute: async (args?: { week_index?: unknown } | null) => {
        const weekIndex = args?.week_index
        if (typeof weekIndex !== 'number' || !Number.isInteger(weekIndex) || weekIndex < 1)
          return `Invalid week_index ${String(weekIndex)}: must be a positive integer.`
        const result = await selectWeek(weekIndex)
        if (result === null)
          return `Research for week ${weekIndex} was cancelled because another week was selected.`
        return result
      },
    },
    { signal },
  ).catch(err => console.error('[WebMCP] select_and_research_week failed', err))

  modelContext.registerTool(
    {
      name: 'get_timeline_stats',
      description:
        'Returns the user\'s current date of birth, expected lifespan, total weeks lived, and overall life progress percentage.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => {
        const dobStr = getDob()
        const dob = parseLocalDate(dobStr)
        const lifespan = getLifespan()

        if (
          !dob
          || !Number.isInteger(lifespan)
          || lifespan < LIFESPAN_MIN_YEARS
          || lifespan > LIFESPAN_MAX_YEARS
        ) {
          return 'The timeline has not been generated yet. Set a date of birth and an expected lifespan first.'
        }

        const { passedWeeks, progressPercent, currentWeek, totalWeeks } = calculateTimeline(dob, lifespan)

        return JSON.stringify({
          dob: dobStr,
          expectedLifespanYears: lifespan,
          weeksLived: passedWeeks,
          currentWeek,
          totalWeeks,
          progressPercentage: Number(progressPercent.toFixed(1)),
        })
      },
      annotations: { readOnlyHint: true },
    },
    { signal },
  ).catch(err => console.error('[WebMCP] get_timeline_stats failed', err))

  return () => controller.abort()
}
