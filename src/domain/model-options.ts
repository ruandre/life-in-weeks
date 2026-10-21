import type { ModelOption } from '../types'

// Recommended models lead in their given order; a fetched entry with the same id replaces the placeholder
export function mergeRecommendedModels(recommended: ModelOption[], fetched: ModelOption[]): ModelOption[] {
  const leading = recommended.map(option => fetched.find(model => model.id === option.id) ?? option)
  const trailing = fetched.filter(model => !recommended.some(option => option.id === model.id))
  return [...leading, ...trailing]
}
