const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  '\'': '&#39;',
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => ESCAPE_MAP[char] || char)
}

function hasBalancedStrong(html: string): boolean {
  let depth = 0
  for (const [tag] of html.matchAll(/<\/?strong>/g)) {
    depth += tag === '<strong>' ? 1 : -1
    if (depth < 0)
      return false
  }
  return depth === 0
}

function renderEmphasis(html: string): string {
  return html
    .replace(/\*\*(?=[^\s*])(.*?[^\s*])\*\*/g, '<strong>$1</strong>')
    .replace(
      /(?<!\*)\*(?=\S)([^*]*\S)\*(?!\*)/g,
      (match, inner: string) => hasBalancedStrong(inner) ? `<em>${inner}</em>` : match,
    )
}

export function renderInline(text: string): string {
  return text
    .split(/(`[^`]+`)/)
    .map((segment, index) => index % 2 === 1
      ? `<code>${escapeHtml(segment.slice(1, -1))}</code>`
      : renderEmphasis(escapeHtml(segment)))
    .join('')
}

const MARKER_ONLY = /^\s*(?:#{1,6}|[-*]|\d+[.)])\s*$/
const HEADING = /^(#{1,6})\s+(.*)/
const LIST_ITEM = /^(\s*)(?:([-*])|\d+[.)])\s+(.*)/

type ListTag = 'ul' | 'ol'

interface List {
  tag: ListTag
  indent: number
  items: string[]
}

function renderList({ tag, items }: List): string {
  return `<${tag}>${items.map(item => `<li>${item}</li>`).join('')}</${tag}>`
}

// Escapes before markup; model output untrusted
export function renderMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let list: List | null = null
  // One nesting level; deeper indentation flattens into it
  let nested: List | null = null

  const flushNested = (): void => {
    if (list && nested)
      list.items[list.items.length - 1] += renderList(nested)
    nested = null
  }

  const flushList = (): void => {
    flushNested()
    if (list)
      html.push(renderList(list))
    list = null
  }

  const addTopLevelItem = (tag: ListTag, indent: number, item: string): void => {
    flushNested()
    if (list?.tag !== tag)
      flushList()
    list ??= { tag, indent, items: [] }
    list.items.push(item)
  }

  const addNestedItem = (tag: ListTag, indent: number, item: string): void => {
    if (nested?.tag !== tag)
      flushNested()
    nested ??= { tag, indent, items: [] }
    nested.items.push(item)
  }

  const addListItem = (tag: ListTag, indent: number, item: string): void => {
    const isNested = list !== null && indent > list.indent
    const addItem = isNested ? addNestedItem : addTopLevelItem
    addItem(tag, indent, item)
  }

  for (const line of lines) {
    // Streamed text often ends mid-marker; the next chunk completes it
    if (MARKER_ONLY.test(line))
      continue

    const heading = line.match(HEADING)
    const listItem = line.match(LIST_ITEM)

    if (heading) {
      flushList()
      const level = heading[1].length >= 3 ? 4 : 3
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
    }
    else if (listItem) {
      const [, indent, bullet, content] = listItem
      addListItem(bullet ? 'ul' : 'ol', indent.length, renderInline(content))
    }
    else if (line.trim() === '') {
      flushList()
    }
    else {
      flushList()
      html.push(`<p>${renderInline(line)}</p>`)
    }
  }
  flushList()

  return html.join('')
}
