import { DATE_FORMAT } from '../lib/date'

export const SYSTEM_PROMPT
  = 'You are a fast, warm historian and developmental-milestones assistant inside a life-calendar app. Write tight, information-dense markdown that reads well while it streams. No preamble, no analogies, no closing summary. Lead with what people enjoy remembering: music, film, TV, games, sport, science, everyday life, plus achievements and discoveries. Mention war, politics, or disaster only when nothing else defines the period, then keep it to one plain bullet. Keep the tone light and human, never gushing. Never invent a fact to stay positive; accuracy wins.'

export interface ResearchPromptOptions {
  weekIndex: number
  age: number
  weekStart: Date
  /** Inclusive; last week of each age runs to the day before next birthday */
  weekEnd: Date
  today: Date
  country: string | null
}

function formatYearSpan(start: Date, end: Date): string {
  const startYear = start.getFullYear()
  const endYear = end.getFullYear()
  return startYear === endYear ? String(startYear) : `${startYear}–${endYear}`
}

type WeekTense = 'past' | 'current' | 'future'

// Compares calendar days; time of day is irrelevant
function getWeekTense(weekStart: Date, weekEnd: Date, today: Date): WeekTense {
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (weekStart > startOfToday)
    return 'future'
  return weekEnd < startOfToday ? 'past' : 'current'
}

const UNFINISHED_WEEK_NOTES: Record<Exclude<WeekTense, 'past'>, string> = {
  current: 'The current week, still in progress.',
  future: 'A future week that hasn\'t happened yet.',
}

export function buildResearchPrompt({
  weekIndex,
  age,
  weekStart,
  weekEnd,
  today,
  country,
}: ResearchPromptOptions): string {
  const range = `${DATE_FORMAT.format(weekStart)} to ${DATE_FORMAT.format(weekEnd)}`
  const year = formatYearSpan(weekStart, weekEnd)
  const intro = `Week ${weekIndex} of the user's life: age ${age}, the week of ${range}. Today is ${DATE_FORMAT.format(today)}.`
  const shared
    = `## Age ${age} milestones\n2-3 bullets on typical development at that age. Each bullet under 20 words.\nNo preamble, no closing summary, no analogies.\n## Dad joke\nOne short, clean dad joke, pun-based and groan-worthy. No preamble, just the joke.`

  const tense = getWeekTense(weekStart, weekEnd, today)
  if (tense !== 'past') {
    const localSection = country
      ? `## Outlook for ${year} in ${country}\n2-3 bullets on things already known or scheduled for ${year} specific to ${country} (elections, sports events, national milestones). Each bullet under 20 words. If nothing concrete is known, say that in one bullet instead of guessing.\n`
      : ''
    return `${intro} ${UNFINISHED_WEEK_NOTES[tense]}\nReturn markdown with exactly these sections, nothing else:\n${localSection}## Outlook for ${year}\n2-3 bullets on things already known or scheduled for ${year} globally (elections, sports events, tech/space milestones). Each bullet under 20 words. If nothing concrete is known, say that in one bullet instead of guessing.\n## Coming in ${year}\n2-3 bullets on culture already scheduled for ${year}: film and game releases, tours, tournaments, anniversaries. Each bullet under 20 words. If nothing concrete is known, say so in one bullet instead of guessing.\n${shared}`
  }

  const localSection = country
    ? `## That week in ${country}\n2-3 bullets on real, notable events in ${country} from ${range} if you know any; otherwise the most significant events of ${year} in ${country}. Each bullet under 20 words.\n`
    : ''
  return `${intro}\nReturn markdown with exactly these sections, nothing else:\n${localSection}## That week in history\n2-3 bullets on real, notable world events from ${range} if you know any; otherwise the most significant world events of ${year} overall. Each bullet under 20 words.\n## Pop culture in ${year}\n2-3 bullets on what people were watching, playing, listening to, or wearing around then: films, music, TV, games, sport, fads. Name titles and artists. Each bullet under 20 words.\n${shared}`
}
