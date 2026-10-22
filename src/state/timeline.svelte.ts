import type { Timeline } from '../domain/timeline'
import type { LocalModelFailure } from '../services/research-service'
import { GRID_FADE_MS, LIFESPAN_DEFAULT_YEARS } from '../config/constants'
import { renderMarkdown } from '../domain/markdown'
import { calculateTimeline, getWeekAge, getWeekStartDate } from '../domain/timeline'
import { isValidLifespan, parseBirthDate } from '../domain/timeline-input'
import { getErrorMessage, isAbortError } from '../lib/errors'
import {
  createResearchStream,
  isLocalModelSupported,
  LocalModelError,
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

interface Failure {
  status: FailureStatus
  message: string
}

const LOCAL_MODEL_FAILURES: Record<LocalModelFailure, Failure> = {
  'needs-user-activation': { status: 'error', message: 'Click a week to download the on-device model.' },
  'unavailable': { status: 'unavailable', message: 'The model is not ready on this device.' },
}

function describeFailure(err: unknown): Failure {
  if (err instanceof LocalModelError)
    return LOCAL_MODEL_FAILURES[err.code]
  console.error(err)
  return { status: 'error', message: `Research failed: ${getErrorMessage(err)}` }
}

export interface TimelineInput {
  dob: string
  country: string
  lifespan: number
}

/** Submitted inputs with the timeline computed from them */
export interface GeneratedTimeline extends TimelineInput {
  dobDate: Date
  timeline: Timeline
}

export class TimelineState {
  dob = $state('')
  country = $state('')
  lifespan = $state(LIFESPAN_DEFAULT_YEARS)

  isGenerating = $state(false)
  isGridLoaded = $state(false)

  // Research and agents read committed at once; the grid shows rendered, which lags by the fade
  committed = $state.raw<GeneratedTimeline | null>(null)
  rendered = $state.raw<GeneratedTimeline | null>(null)

  selectedWeek = $state<number | null>(null)

  stats = $state({
    targetLived: 0,
    targetProgress: 0,
  })

  research = $state<ResearchState>(createIdleResearch())

  private activeController: AbortController | null = null
  private fadeTimer: ReturnType<typeof setTimeout> | null = null

  get hasGenerated(): boolean {
    return this.rendered !== null
  }

  /** Fades the grid out before the new timeline appears */
  generate({ dob, country, lifespan }: TimelineInput): boolean {
    const dobDate = parseBirthDate(dob)
    if (!dobDate || !isValidLifespan(lifespan))
      return false

    if (this.fadeTimer !== null)
      clearTimeout(this.fadeTimer)

    const previous = this.committed
    const isSameInput = previous !== null
      && previous.dob === dob
      && previous.country === country
      && previous.lifespan === lifespan
    if (!isSameInput)
      this.clearResearch()

    const generated: GeneratedTimeline = {
      dob,
      dobDate,
      country,
      lifespan,
      timeline: calculateTimeline(dobDate, lifespan),
    }
    this.committed = generated
    this.dob = dob
    this.country = country
    this.lifespan = lifespan
    this.isGenerating = true
    this.isGridLoaded = false

    this.stats.targetLived = generated.timeline.passedWeeks
    this.stats.targetProgress = generated.timeline.progressPercent

    const apply = () => {
      this.fadeTimer = null
      this.rendered = generated
      this.isGenerating = false

      // Double rAF ensures paint before transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.isGridLoaded = true
        })
      })
    }

    this.fadeTimer = setTimeout(apply, GRID_FADE_MS)

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

    const generated = this.committed
    if (!generated)
      return this.showFailure('error', 'Set a valid date of birth first.')
    if (weekIndex > generated.timeline.totalWeeks)
      return `Week ${weekIndex} is outside the timeline. Check the expected lifespan.`

    const { dobDate, country } = generated

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
    if (provider !== 'local' && !settingsState.hasCredentials)
      return this.showFailure('error', `Add a ${settingsState.cloudProvider.name} API key and pick a model to research this week.`)

    try {
      const stream = await createResearchStream({
        weekIndex,
        dobDate,
        country,
        provider,
        credentials: { apiKey: settingsState.apiKey, model: settingsState.model },
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
    catch (err: unknown) {
      if (isAbortError(err))
        return null

      const { status, message } = describeFailure(err)
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
