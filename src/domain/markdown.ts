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

export function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?=\S)([^*]*\S)\*(?!\*)/g, '<em>$1</em>')
}

const MARKER_ONLY = /^\s*(?:#{1,6}|[-*]|\d+[.)])\s*$/
const HEADING = /^(#{1,6})\s+(.*)/
const BULLET_ITEM = /^[-*]\s+(.*)/
const NUMBERED_ITEM = /^\d+[.)]\s+(.*)/

type ListTag = 'ul' | 'ol'

// Escapes before markup; model output untrusted
export function renderMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let list: { tag: ListTag, items: string[] } | null = null

  const flushList = (): void => {
    if (list) {
      html.push(`<${list.tag}>${list.items.join('')}</${list.tag}>`)
      list = null
    }
  }

  const addListItem = (tag: ListTag, content: string): void => {
    if (list?.tag !== tag)
      flushList()
    list ??= { tag, items: [] }
    list.items.push(`<li>${renderInline(content)}</li>`)
  }

  for (const line of lines) {
    // Streamed text often ends mid-marker; the next chunk completes it
    if (MARKER_ONLY.test(line))
      continue

    const heading = line.match(HEADING)
    const bulletItem = line.match(BULLET_ITEM)
    const numberedItem = line.match(NUMBERED_ITEM)

    if (heading) {
      flushList()
      const level = heading[1].length >= 3 ? 4 : 3
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
    }
    else if (bulletItem) {
      addListItem('ul', bulletItem[1])
    }
    else if (numberedItem) {
      addListItem('ol', numberedItem[1])
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
