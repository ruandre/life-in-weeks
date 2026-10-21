import type { Timeline } from '../domain/timeline'
import {
  GRID_FADE_MS,
  LIFESPAN_DEFAULT_YEARS,
  LIFESPAN_MAX_YEARS,
  LIFESPAN_MIN_YEARS,
} from '../config/constants'
import { renderMarkdown } from '../domain/markdown'
import { calculateTimeline, getWeekAge, getWeekStartDate } from '../domain/timeline'
import { parseLocalDate } from '../lib/date'
import {
  createResearchStream,
  isLocalModelSupported,
  LOCAL_MODEL_NEEDS_USER_ACTIVATION,
  LOCAL_MODEL_UNAVAILABLE,
  warmUpLocalModel,
} from '../services/research-service'
import { settingsState } from './settings.svelte'

export interface ResearchState {
  status: 'idle' | 'loading' | 'downloading' | 'streaming' | 'ready' | 'unsupported' | 'unavailable' | 'error'
  weekIndex: number | null
  age: number | null
  weekInYear: number | null
  weekStart: Date | null
  renderedHtml: string
  /** On-device model download fraction, 0 to 1 */
  downloadProgress: number | null
  errorMessage: string | null
  statusMessage: string
}

function createIdleResearch(): ResearchState {
  return {
    status: 'idle',
    weekIndex: null,
    age: null,
    weekInYear: null,
    weekStart: null,
    renderedHtml: '',
    downloadProgress: null,
    errorMessage: null,
    statusMessage: '',
  }
}

type FailureStatus = Extract<ResearchState['status'], 'unsupported' | 'unavailable' | 'error'>

const LOCAL_MODEL_FAILURES: Record<string, { status: FailureStatus, message: string }> = {
  [LOCAL_MODEL_NEEDS_USER_ACTIVATION]: { status: 'error', message: 'Click a week to download the on-device model.' },
  [LOCAL_MODEL_UNAVAILABLE]: { status: 'unavailable', message: 'The model is not ready on this device.' },
}

export interface TimelineInput {
  dob: string
  country: string
  lifespan: number
}

export class TimelineState {
  dob = $state('1997-11-21')
  country = $state('')
  lifespan = $state(LIFESPAN_DEFAULT_YEARS)

  hasGenerated = $state(false)
  isGenerating = $state(false)
  isGridLoaded = $state(false)

  timeline = $state.raw<Timeline | null>(null)
  displayedDob = $state<string>('1997-11-21')
  displayedLifespan = $state<number>(LIFESPAN_DEFAULT_YEARS)
  displayedCountry = $state('')

  selectedWeek = $state<number | null>(null)

  stats = $state({
    targetLived: 0,
    targetProgress: 0,
  })

  research = $state<ResearchState>(createIdleResearch())

  private activeController: AbortController | null = null
  private fadeTimer: ReturnType<typeof setTimeout> | null = null

  /** User action: fades the grid out before the new timeline appears */
  generate(input: TimelineInput): boolean {
    return this.applyTimeline(input, GRID_FADE_MS)
  }

  /** Initial load: shows the saved timeline without a fade */
  restore(input: TimelineInput): boolean {
    return this.applyTimeline(input, 0)
  }

  private applyTimeline({ dob: dobStr, country, lifespan: lifespanYears }: TimelineInput, fadeMs: number): boolean {
    const dob = parseLocalDate(dobStr)
    if (!dob || dob.getTime() > Date.now())
      return false
    if (!Number.isInteger(lifespanYears) || lifespanYears < LIFESPAN_MIN_YEARS || lifespanYears > LIFESPAN_MAX_YEARS)
      return false

    if (this.fadeTimer !== null)
      clearTimeout(this.fadeTimer)

    const newTimeline = calculateTimeline(dob, lifespanYears)

    const inputsChanged = dobStr !== this.displayedDob
      || country !== this.displayedCountry
      || lifespanYears !== this.displayedLifespan
    if (inputsChanged)
      this.clearResearch()

    this.dob = dobStr
    this.country = country
    this.lifespan = lifespanYears
    this.isGenerating = true
    this.isGridLoaded = false

    this.stats.targetLived = newTimeline.passedWeeks
    this.stats.targetProgress = newTimeline.progressPercent

    const apply = () => {
      this.fadeTimer = null
      this.timeline = newTimeline
      this.displayedDob = dobStr
      this.displayedLifespan = lifespanYears
      this.displayedCountry = country
      this.hasGenerated = true
      this.isGenerating = false

      // Double rAF ensures paint before transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.isGridLoaded = true
        })
      })
    }

    if (fadeMs === 0)
      apply()
    else
      this.fadeTimer = setTimeout(apply, fadeMs)

    return true
  }

  private clearResearch(): void {
    this.activeController?.abort()
    this.activeController = null
    this.selectedWeek = null
    this.research = createIdleResearch()
  }

  async selectWeek(weekIndex: number): Promise<string | null> {
    if (!Number.isInteger(weekIndex) || weekIndex < 1)
      return this.showFailure('error', 'Pick a week on the grid.')

    if (this.timeline && weekIndex > this.timeline.totalWeeks)
      return `Week ${weekIndex} is outside the timeline. Check the expected lifespan.`

    const dobDate = parseLocalDate(this.displayedDob)
    if (!dobDate)
      return this.showFailure('error', 'Set a valid date of birth first.')

    this.activeController?.abort()
    const controller = new AbortController()
    this.activeController = controller
    const isCurrent = () => this.activeController === controller

    const { age, weekInYear } = getWeekAge(weekIndex)
    this.selectedWeek = weekIndex
    this.research = {
      ...createIdleResearch(),
      status: 'loading',
      weekIndex,
      age,
      weekInYear,
      weekStart: getWeekStartDate(dobDate, weekIndex),
      statusMessage: 'Researching that week…',
    }

    const { provider } = settingsState
    if (provider === 'local' && !isLocalModelSupported())
      return this.showFailure('unsupported', 'This browser has no built-in AI model.')
    if (provider === 'gemini' && !settingsState.hasCredentials)
      return this.showFailure('error', 'Add a Gemini API key and pick a model to research this week.')

    try {
      const stream = await createResearchStream({
        weekIndex,
        dobDate,
        country: this.displayedCountry,
        provider,
        gemini: { apiKey: settingsState.apiKey, model: settingsState.model },
        signal: controller.signal,
        onDownloadProgress: (loaded) => {
          if (!isCurrent())
            return
          this.research.status = 'downloading'
          this.research.downloadProgress = loaded
          this.research.statusMessage = 'Downloading on-device model…'
        },
      })

      if (!isCurrent())
        return null
      this.research.status = 'streaming'
      let completeResult = ''

      for await (const chunk of stream) {
        if (!isCurrent())
          return null
        completeResult += chunk
        this.research.renderedHtml = renderMarkdown(completeResult)
      }

      if (!isCurrent())
        return completeResult
      // Safety-blocked or empty responses would otherwise leave a blank panel
      if (completeResult.trim() === '')
        return this.showFailure('error', 'The model returned no research for this week. Try again or pick another week.')
      this.research.status = 'ready'
      this.research.statusMessage = 'Research ready.'
      return completeResult
    }
    catch (err: any) {
      if (err?.name === 'AbortError')
        return null

      const failure = LOCAL_MODEL_FAILURES[err?.message]
      if (!failure)
        console.error(err)
      const { status, message } = failure ?? { status: 'error', message: `Research failed: ${err?.message || err}` }
      return isCurrent() ? this.showFailure(status, message) : message
    }
  }

  private showFailure(status: FailureStatus, message: string): string {
    this.research.status = status
    this.research.errorMessage = message
    this.research.statusMessage = message
    return message
  }

  warmUp(): void {
    if (settingsState.provider === 'local')
      warmUpLocalModel()
  }
}

export const timelineState = new TimelineState()
