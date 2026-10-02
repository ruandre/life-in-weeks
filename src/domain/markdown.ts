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

const MARKER_ONLY = /^\s*(?:#{1,6}|[-*])\s*$/

// Escapes before markup; model output untrusted
export function renderMarkdown(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let listItems: string[] | null = null

  const flushList = (): void => {
    if (listItems) {
      html.push(`<ul>${listItems.join('')}</ul>`)
      listItems = null
    }
  }

  for (const line of lines) {
    // Streamed text often ends mid-marker; the next chunk completes it
    if (MARKER_ONLY.test(line))
      continue

    const heading = line.match(/^(#{1,6})\s+(.*)/)
    const listItem = line.match(/^[-*]\s+(.*)/)

    if (heading) {
      flushList()
      const level = heading[1].length >= 3 ? 4 : 3
      html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
    }
    else if (listItem) {
      listItems ??= []
      listItems.push(`<li>${renderInline(listItem[1])}</li>`)
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
