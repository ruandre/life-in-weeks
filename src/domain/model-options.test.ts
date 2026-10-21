import { describe, expect, it } from 'vitest'
import { mergeRecommendedModels } from './model-options'

const recommended = [
  { id: 'a', name: 'A' },
  { id: 'b', name: 'B' },
]

describe('mergeRecommendedModels', () => {
  it('returns the recommended models when nothing was fetched', () => {
    expect(mergeRecommendedModels(recommended, [])).toEqual(recommended)
  })

  it('keeps recommended order and replaces entries with fetched ones of the same id', () => {
    const fetched = [
      { id: 'c', name: 'C' },
      { id: 'b', name: 'Fetched B' },
    ]

    expect(mergeRecommendedModels(recommended, fetched)).toEqual([
      { id: 'a', name: 'A' },
      { id: 'b', name: 'Fetched B' },
      { id: 'c', name: 'C' },
    ])
  })

  it('does not mutate its inputs', () => {
    const fetched = [{ id: 'a', name: 'Fetched A' }]
    const recommendedCopy = structuredClone(recommended)

    mergeRecommendedModels(recommended, fetched)

    expect(recommended).toEqual(recommendedCopy)
    expect(fetched).toEqual([{ id: 'a', name: 'Fetched A' }])
  })
})
