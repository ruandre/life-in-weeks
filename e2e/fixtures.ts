import type { Page } from '@playwright/test'
import { test as base, expect } from '@playwright/test'

export { expect }

/** Fixed clock so weeks lived and week tense are deterministic */
export const TODAY = new Date('2026-10-22T12:00:00')

export const RESEARCH_MARKDOWN = '## That week in history\n- **Mocked** event\n## Dad joke\nA mocked pun.'

interface LocalModelOptions {
  chunks: string[]
}

// Stands in for Chrome's Prompt API; records each prompt on window.__prompts
async function installLocalModel(page: Page, { chunks }: LocalModelOptions): Promise<void> {
  await page.addInitScript((streamed: string[]) => {
    const prompts: string[] = []
    Object.assign(window, { __prompts: prompts })
    const session = {
      clone: async () => session,
      destroy: () => {},
      async* promptStreaming(prompt: string) {
        prompts.push(prompt)
        yield* streamed
      },
    }
    Object.assign(globalThis, {
      LanguageModel: {
        availability: async () => 'available',
        create: async () => session,
      },
    })
  }, chunks)
}

export const test = base.extend<{ timelinePage: Page }>({
  timelinePage: async ({ page }, use) => {
    await page.clock.setFixedTime(TODAY)
    await installLocalModel(page, { chunks: [RESEARCH_MARKDOWN.slice(0, 30), RESEARCH_MARKDOWN.slice(30)] })
    await page.goto('./')
    await use(page)
  },
})

export async function generateTimeline(page: Page, { dob, lifespan = 70 }: { dob: string, lifespan?: number }): Promise<void> {
  await page.getByLabel(/date of birth/i).fill(dob)
  await page.getByLabel(/expected lifespan/i).fill(String(lifespan))
  await page.getByRole('button', { name: /generate timeline/i }).click()
}

export function recordedPrompts(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __prompts: string[] }).__prompts)
}
