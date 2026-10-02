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
  year: number | null
  streamText: string
  renderedHtml: string
  /** On-device model download fraction, 0 to 1 */
  downloadProgress: number | null
  errorMessage: string | null
  statusMessage: string
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

  selectedWeek = $state<number | null>(null)

  stats = $state({
    targetLived: 0,
    targetProgress: 0,
  })

  research = $state<ResearchState>({
    status: 'idle',
    weekIndex: null,
    age: null,
    weekInYear: null,
    year: null,
    streamText: '',
    renderedHtml: '',
    downloadProgress: null,
    errorMessage: null,
    statusMessage: '',
  })

  private activeController: AbortController | null = null

  generate(dobStr: string, lifespanYears: number, immediate = false): boolean {
    const dob = parseLocalDate(dobStr)
    if (!dob || dob.getTime() > Date.now())
      return false
    if (!Number.isInteger(lifespanYears) || lifespanYears < LIFESPAN_MIN_YEARS || lifespanYears > LIFESPAN_MAX_YEARS)
      return false

    const newTimeline = calculateTimeline(dob, lifespanYears)

    this.dob = dobStr
    this.lifespan = lifespanYears
    this.isGenerating = true
    this.isGridLoaded = false

    this.stats.targetLived = newTimeline.passedWeeks
    this.stats.targetProgress = newTimeline.progressPercent

    const apply = () => {
      this.timeline = newTimeline
      this.displayedDob = dobStr
      this.displayedLifespan = lifespanYears
      this.hasGenerated = true
      this.isGenerating = false

      // Double rAF ensures paint before transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.isGridLoaded = true
        })
      })
    }

    if (immediate) {
      apply()
    }
    else {
      window.setTimeout(apply, GRID_FADE_MS)
    }

    return true
  }

  async selectWeek(weekIndex: number): Promise<string | null> {
    const w = Number.parseInt(String(weekIndex), 10) || 0
    if (!w) {
      this.research.status = 'error'
      this.research.errorMessage = 'Pick a week on the grid.'
      this.research.statusMessage = 'Pick a week on the grid.'
      return 'Pick a week on the grid.'
    }

    if (this.timeline && (w < 1 || w > this.timeline.totalWeeks)) {
      return null
    }

    this.activeController?.abort()
    const controller = new AbortController()
    this.activeController = controller
    const { signal } = controller
    const isCurrent = () => this.activeController === controller

    this.selectedWeek = w
    const { age, weekInYear } = getWeekAge(w)

    let headerYear: number | null = null
    if (this.displayedDob) {
      const dobDate = parseLocalDate(this.displayedDob)
      if (dobDate) {
        headerYear = getWeekStartDate(dobDate, w).getFullYear()
      }
    }

    this.research = {
      status: 'loading',
      weekIndex: w,
      age,
      weekInYear,
      year: headerYear,
      streamText: '',
      renderedHtml: '',
      downloadProgress: null,
      errorMessage: null,
      statusMessage: 'Researching that week…',
    }

    const { provider } = settingsState

    if (provider === 'local' && !isLocalModelSupported()) {
      const message = 'This browser has no built-in AI model.'
      if (isCurrent()) {
        this.research.status = 'unsupported'
        this.research.errorMessage = message
        this.research.statusMessage = message
      }
      return message
    }

    if (provider === 'gemini' && !settingsState.hasCredentials) {
      const message = 'Add a Gemini API key and pick a model to research this week.'
      if (isCurrent()) {
        this.research.status = 'error'
        this.research.errorMessage = message
        this.research.statusMessage = message
      }
      return message
    }

    try {
      const validDob = this.displayedDob ? parseLocalDate(this.displayedDob) : null

      const { stream, meta } = await createResearchStream({
        weekIndex: w,
        dobDate: validDob,
        country: this.country,
        provider,
        gemini: { apiKey: settingsState.apiKey, model: settingsState.model },
        signal,
        onDownloadProgress: (loaded) => {
          if (!isCurrent())
            return
          this.research.status = 'downloading'
          this.research.downloadProgress = loaded
          this.research.statusMessage = 'Downloading on-device model…'
        },
      })

      if (meta.year && meta.year !== headerYear) {
        this.research.year = meta.year
      }

      this.research.status = 'streaming'
      let completeResult = ''

      for await (const chunk of stream) {
        if (!isCurrent())
          return null
        completeResult += chunk
        this.research.streamText = completeResult
        this.research.renderedHtml = renderMarkdown(completeResult)
      }

      if (isCurrent()) {
        this.research.status = 'ready'
        this.research.statusMessage = 'Research ready.'
      }
      return completeResult
    }
    catch (err: any) {
      if (err?.name === 'AbortError')
        return null

      if (err?.message === LOCAL_MODEL_NEEDS_USER_ACTIVATION) {
        const message = 'Click a week to download the on-device model.'
        if (isCurrent()) {
          this.research.status = 'error'
          this.research.errorMessage = message
          this.research.statusMessage = message
        }
        return message
      }

      if (err?.message === LOCAL_MODEL_UNAVAILABLE) {
        const message = 'The model is not ready on this device.'
        if (isCurrent()) {
          this.research.status = 'unavailable'
          this.research.errorMessage = message
          this.research.statusMessage = message
        }
        return message
      }

      console.error(err)
      const message = `Research failed: ${err?.message || err}`
      if (isCurrent()) {
        this.research.status = 'error'
        this.research.errorMessage = message
        this.research.statusMessage = message
      }
      return message
    }
  }

  warmUp(): void {
    if (settingsState.provider === 'local')
      warmUpLocalModel()
  }
}

export const timelineState = new TimelineState()
