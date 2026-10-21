import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdown'

const ALLOWED_TAGS = ['h3', 'h4', 'p', 'ul', 'ol', 'li', 'strong', 'em', 'code'] as const
const ALLOWED_TAG = /<\/?(?:h3|h4|p|ul|ol|li|strong|em|code)>/g

// Mixes markdown markers with hostile HTML so both paths get exercised
const markdownish = fc.string({ unit: fc.constantFrom(
  'a',
  ' ',
  '\n',
  '*',
  '**',
  '`',
  '#',
  '-',
  '1.',
  '<',
  '>',
  '"',
  '\'',
  '&',
  '<script>',
  'onerror=',
) })

describe('markdown renderer properties', () => {
  it('emits no markup beyond the allowed tags for any input', () => {
    fc.assert(fc.property(fc.oneof(fc.string(), markdownish), (input) => {
      const html = renderMarkdown(input)
      expect(html.replace(ALLOWED_TAG, '')).not.toMatch(/[<>]/)
    }))
  })

  it('closes every tag it opens', () => {
    fc.assert(fc.property(fc.oneof(fc.string(), markdownish), (input) => {
      const html = renderMarkdown(input)
      for (const tag of ALLOWED_TAGS) {
        const opened = html.split(`<${tag}>`).length - 1
        const closed = html.split(`</${tag}>`).length - 1
        expect(opened, tag).toBe(closed)
      }
    }))
  })
})
