export const MILLISECONDS_PER_DAY = 86_400_000
export const MILLISECONDS_PER_WEEK = MILLISECONDS_PER_DAY * 7
export const WEEKS_PER_YEAR = 52
export const LIFESPAN_MIN_YEARS = 1
export const LIFESPAN_MAX_YEARS = 120
export const LIFESPAN_DEFAULT_YEARS = 70

// Sync with CSS transitions
export const GRID_FADE_MS = 300
export const STATS_ANIMATION_MS = 1000
export const HEADING_REPLAY_MS = 1100

export const DATE_INPUT_MAX = (): string => new Date().toISOString().slice(0, 10)
