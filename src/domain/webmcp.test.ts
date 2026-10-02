import type { Mock } from 'vitest'
import type { ModelContextTool } from '../types'
import type { WebMCPOptions } from './webmcp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LIFESPAN_MAX_YEARS, LIFESPAN_MIN_YEARS } from '../config/constants'
import { initWebMCP } from './webmcp'

type RegisterTool = Mock<(tool: ModelContextTool, options?: { signal?: AbortSignal }) => Promise<void>>

let registerTool: RegisterTool

function stubModelContext(impl: () => Promise<void> = async () => {}) {
  registerTool = vi.fn(impl)
  vi.stubGlobal('navigator', { modelContext: { registerTool } })
}

function init(overrides: Partial<WebMCPOptions> = {}) {
  return initWebMCP({
    getDob: () => '2000-01-01',
    getLifespan: () => 80,
    selectWeek: vi.fn(async () => 'research'),
    ...overrides,
  })
}

function registration(name: string) {
  const call = registerTool.mock.calls.find(([tool]) => tool.name === name)
  if (!call)
    throw new Error(`Tool ${name} not registered`)
  return { tool: call[0], signal: call[1]?.signal }
}

function toolNamed(name: string) {
  return registration(name).tool
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('initWebMCP without modelContext', () => {
  it('returns a cleanup that does not throw', () => {
    vi.stubGlobal('navigator', {})
    const cleanup = init()
    expect(() => cleanup()).not.toThrow()
  })
})

describe('initWebMCP registration', () => {
  beforeEach(() => stubModelContext())

  it('registers both tools with an abort signal', () => {
    init()
    const names = registerTool.mock.calls.map(([tool]) => tool.name)
    expect(names).toEqual(['select_and_research_week', 'get_timeline_stats'])
    for (const name of names)
      expect(registration(name).signal).toBeInstanceOf(AbortSignal)
  })

  it('aborts registrations on cleanup', () => {
    const cleanup = init()
    const signals = registerTool.mock.calls.map(([, options]) => options?.signal)
    expect(signals.every(signal => signal?.aborted === false)).toBe(true)
    cleanup()
    expect(signals.every(signal => signal?.aborted === true)).toBe(true)
  })

  it('logs registration failures without throwing', async () => {
    const error = new Error('denied')
    stubModelContext(async () => {
      throw error
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => init()).not.toThrow()
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledTimes(2))
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('select_and_research_week'), error)
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('get_timeline_stats'), error)
  })
})

describe('select_and_research_week', () => {
  beforeEach(() => stubModelContext())

  it.each([1.5, 0, -3, Number.NaN])('rejects week_index %s without selecting', async (weekIndex) => {
    const selectWeek = vi.fn(async () => 'research')
    init({ selectWeek })
    const result = await toolNamed('select_and_research_week').execute({ week_index: weekIndex })
    expect(result).toMatch(/^Invalid week_index/)
    expect(selectWeek).not.toHaveBeenCalled()
  })

  it('reports weeks outside the timeline', async () => {
    const selectWeek = vi.fn(async () => null)
    init({ selectWeek })
    const result = await toolNamed('select_and_research_week').execute({ week_index: 9999 })
    expect(selectWeek).toHaveBeenCalledWith(9999)
    expect(result).toContain('outside the timeline')
  })

  it('returns the research for a valid week', async () => {
    const selectWeek = vi.fn(async () => 'Week 53 research')
    init({ selectWeek })
    const result = await toolNamed('select_and_research_week').execute({ week_index: 53 })
    expect(selectWeek).toHaveBeenCalledWith(53)
    expect(result).toBe('Week 53 research')
  })
})

describe('get_timeline_stats', () => {
  beforeEach(() => stubModelContext())

  it.each([
    ['empty dob', '', 80],
    ['unparseable dob', 'not-a-date', 80],
    ['lifespan below min', '2000-01-01', LIFESPAN_MIN_YEARS - 1],
    ['lifespan above max', '2000-01-01', LIFESPAN_MAX_YEARS + 1],
    ['fractional lifespan', '2000-01-01', 80.5],
  ])('reports not generated for %s', (_, dob, lifespan) => {
    init({ getDob: () => dob, getLifespan: () => lifespan })
    expect(toolNamed('get_timeline_stats').execute({})).toMatch(/has not been generated/)
  })

  it('returns timeline stats as JSON', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2, 12))
    init({ getDob: () => '2000-01-01', getLifespan: () => 80 })

    const stats = JSON.parse(toolNamed('get_timeline_stats').execute({}) as string)

    expect(stats).toEqual({
      dob: '2000-01-01',
      expectedLifespanYears: 80,
      weeksLived: 1391,
      currentWeek: 1392,
      totalWeeks: 4160,
      progressPercentage: 33.4,
    })
  })
})
