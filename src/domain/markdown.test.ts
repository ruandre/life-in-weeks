import { describe, expect, it } from 'vitest'
import { escapeHtml, renderInline, renderMarkdown } from './markdown'

describe('escapeHtml', () => {
  it('escapes HTML special characters to prevent XSS', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    )
    expect(escapeHtml('Tom & Jerry\'s')).toBe('Tom &amp; Jerry&#39;s')
  })
})

describe('renderInline', () => {
  it('renders inline code, bold, and italic', () => {
    expect(renderInline('This is `code`')).toBe('This is <code>code</code>')
    expect(renderInline('This is **bold** text')).toBe('This is <strong>bold</strong> text')
    expect(renderInline('This is *italic* text')).toBe('This is <em>italic</em> text')
  })

  it('escapes html before applying markdown styles', () => {
    expect(renderInline('**<script>**')).toBe('<strong>&lt;script&gt;</strong>')
  })

  it('leaves spaced asterisks as literal text', () => {
    expect(renderInline('2 * 3 * 4')).toBe('2 * 3 * 4')
    expect(renderInline('2 ** 3')).toBe('2 ** 3')
  })

  it('keeps asterisks inside code spans verbatim', () => {
    expect(renderInline('`code *with* stars`')).toBe('<code>code *with* stars</code>')
    expect(renderInline('`**x**`')).toBe('<code>**x**</code>')
  })

  it('escapes html inside code spans', () => {
    expect(renderInline('`<b>`')).toBe('<code>&lt;b&gt;</code>')
  })

  it('renders italic nested inside bold', () => {
    expect(renderInline('**nested *italic* text**')).toBe('<strong>nested <em>italic</em> text</strong>')
  })

  it('renders bold nested inside italic', () => {
    expect(renderInline('*a **b** c*')).toBe('<em>a <strong>b</strong> c</em>')
  })

  it('renders combined bold and italic', () => {
    expect(renderInline('***both***')).toBe('<em><strong>both</strong></em>')
  })

  it('keeps separate bold spans apart', () => {
    expect(renderInline('**a** and **b**')).toBe('<strong>a</strong> and <strong>b</strong>')
  })
})

describe('renderMarkdown', () => {
  it('renders headings with correct level', () => {
    expect(renderMarkdown('# Main Heading')).toBe('<h3>Main Heading</h3>')
    expect(renderMarkdown('## Sub Heading')).toBe('<h3>Sub Heading</h3>')
    expect(renderMarkdown('### Small Heading')).toBe('<h4>Small Heading</h4>')
  })

  it('renders deeper headings as the smallest heading level', () => {
    expect(renderMarkdown('#### Deep Heading')).toBe('<h4>Deep Heading</h4>')
  })

  it('renders bullet lists and wraps consecutive items in a single ul', () => {
    const input = '- Item 1\n- Item 2\n- Item 3'
    expect(renderMarkdown(input)).toBe(
      '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>',
    )
  })

  it('hides a trailing marker-only line while streaming', () => {
    expect(renderMarkdown('## Title\n- one\n-')).toBe('<h3>Title</h3><ul><li>one</li></ul>')
  })

  it('hides an empty heading in progress', () => {
    expect(renderMarkdown('## ')).toBe('')
    expect(renderMarkdown('#')).toBe('')
  })

  it('keeps a list together across a marker-only line', () => {
    expect(renderMarkdown('- a\n- \n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
  })

  it('renders numbered lists', () => {
    expect(renderMarkdown('1. One\n2) Two')).toBe('<ol><li>One</li><li>Two</li></ol>')
  })

  it('starts a new list when the list type changes', () => {
    expect(renderMarkdown('- a\n1. b')).toBe('<ul><li>a</li></ul><ol><li>b</li></ol>')
  })

  it('hides a trailing number marker while streaming', () => {
    expect(renderMarkdown('1. One\n2.')).toBe('<ol><li>One</li></ol>')
  })

  it('escapes HTML inside numbered items', () => {
    expect(renderMarkdown('1. <b>x</b>')).toBe('<ol><li>&lt;b&gt;x&lt;/b&gt;</li></ol>')
  })

  it('renders paragraphs and separates lists from paragraphs', () => {
    const input = 'Intro text.\n\n- Item 1\n\nOutro text.'
    expect(renderMarkdown(input)).toBe(
      '<p>Intro text.</p><ul><li>Item 1</li></ul><p>Outro text.</p>',
    )
  })
})
