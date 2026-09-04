export const SYSTEM_PROMPT
  = 'You are a fast, warm historian and developmental-milestones assistant inside a life-calendar app. Write tight, information-dense markdown that reads well while it streams. No preamble, no analogies, no closing summary. Lead with what people enjoy remembering: music, film, TV, games, sport, science, everyday life, plus achievements and discoveries. Mention war, politics, or disaster only when nothing else defines the period, then keep it to one plain bullet. Keep the tone light and human, never gushing. Never invent a fact to stay positive; accuracy wins.'

export interface ResearchPromptOptions {
  weekIndex: number
  age: number
  when: string
  year: number | string
  isFuture: boolean
  country: string | null
}

export function buildResearchPrompt({
  weekIndex,
  age,
  when,
  year,
  isFuture,
  country,
}: ResearchPromptOptions): string {
  const shared
    = `## Age ${age} milestones\n2-3 bullets on typical development at that age. Each bullet under 20 words.\nNo preamble, no closing summary, no analogies.\n## Dad joke\nOne short, clean dad joke, pun-based and groan-worthy. No preamble, just the joke.`

  if (isFuture) {
    const localSection = country
      ? `## Outlook for ${year} in ${country}\n2-3 bullets on things already known or scheduled for ${year} specific to ${country} (elections, sports events, national milestones). Each bullet under 20 words. If nothing concrete is known this far out, say that in one bullet instead of guessing.\n`
      : ''
    return `Week ${weekIndex} of the user's life: age ${age}, ${when}. A future week that hasn't happened yet.\nReturn markdown with exactly these sections, nothing else:\n${localSection}## Outlook for ${year}\n2-3 bullets on things already known or scheduled for ${year} globally (elections, sports events, tech/space milestones). Each bullet under 20 words. If nothing concrete is known this far out, say that in one bullet instead of guessing.\n## Coming in ${year}\n2-3 bullets on culture already scheduled for ${year}: film and game releases, tours, tournaments, anniversaries. Each bullet under 20 words. If nothing concrete is known, say so in one bullet instead of guessing.\n${shared}`
  }

  const localSection = country
    ? `## That week in ${country}\n2-3 bullets on real, notable events from that specific week in ${country} if you know any; otherwise the most significant events of ${year} in ${country}. Each bullet under 20 words.\n`
    : ''
  return `Week ${weekIndex} of the user's life: age ${age}, ${when}.\nReturn markdown with exactly these sections, nothing else:\n${localSection}## That week in history\n2-3 bullets on real, notable world events from that specific week if you know any; otherwise the most significant world events of ${year} overall. Each bullet under 20 words.\n## Pop culture in ${year}\n2-3 bullets on what people were watching, playing, listening to, or wearing around then: films, music, TV, games, sport, fads. Name titles and artists. Each bullet under 20 words.\n${shared}`
}
