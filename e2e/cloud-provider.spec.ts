import { expect, generateTimeline, test } from './fixtures'

const GEMINI_API = 'https://generativelanguage.googleapis.com/**'

test('researches through Gemini with a pasted key and discloses what is sent', async ({ timelinePage: page }) => {
  const requestBodies: string[] = []
  await page.route(GEMINI_API, async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({
        json: { models: [{ name: 'models/gemini-3.6-flash', displayName: 'Gemini 3.6 Flash', supportedActions: ['generateContent'] }] },
      })
      return
    }
    requestBodies.push(request.postData() ?? '')
    const chunk = { candidates: [{ content: { role: 'model', parts: [{ text: '## That week in history\n- From Gemini' }] } }] }
    await route.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify(chunk)}\n\n` })
  })
  await generateTimeline(page, { dob: '1990-05-15' })

  await page.getByText('Model', { exact: true }).click()
  await page.getByLabel(/gemini api key/i).fill('test-key')
  await expect(page.getByRole('status')).toHaveText('3 models available')
  await expect(page.getByText(/reveal your date of birth/i)).toBeVisible()
  await page.getByRole('gridcell', { name: /^Age 10, week 1\b/ }).click()

  await expect(page.getByRole('region', { name: /research results/i })).toContainText('From Gemini')
  expect(requestBodies[0]).toContain('May 15, 2000')
})

const CLAUDE_API = 'https://api.anthropic.com/**'

function claudeEventStream(text: string): string {
  const message = { id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } }
  const events = [
    ['message_start', { type: 'message_start', message }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } }],
    ['message_stop', { type: 'message_stop' }],
  ] as const
  return events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('')
}

test('researches through Claude at low effort unless the user raises it', async ({ timelinePage: page }) => {
  const efforts: unknown[] = []
  const supported = { supported: true }
  await page.route(CLAUDE_API, async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      await route.fulfill({
        json: {
          data: [{
            type: 'model',
            id: 'claude-sonnet-5-5',
            display_name: 'Claude Sonnet 5.5',
            created_at: '2026-09-01T00:00:00Z',
            capabilities: { effort: { supported: true, low: supported, medium: supported, high: supported, max: supported, xhigh: supported } },
          }],
          has_more: false,
          first_id: 'claude-sonnet-5-5',
          last_id: 'claude-sonnet-5-5',
        },
      })
      return
    }
    efforts.push(request.postDataJSON().output_config?.effort)
    await route.fulfill({ contentType: 'text/event-stream', body: claudeEventStream('## That week in history\n- From Claude') })
  })
  await generateTimeline(page, { dob: '1990-05-15' })
  await page.getByText('Model', { exact: true }).click()
  await page.getByRole('radio', { name: 'Claude' }).check()
  await page.getByLabel(/claude api key/i).fill('test-key')
  await expect(page.getByRole('status')).toHaveText('3 models available')
  const results = page.getByRole('region', { name: /research results/i })

  await expect(page.getByRole('radio', { name: 'Low' })).toBeChecked()
  await page.getByRole('gridcell', { name: /^Age 10, week 1\b/ }).click()
  await expect(results).toContainText('From Claude')

  await page.getByRole('radio', { name: 'High' }).check()
  await page.getByRole('gridcell', { name: /^Age 10, week 2\b/ }).click()
  await expect(results).toContainText('Age 10 · Week 2')
  await expect(results).toContainText('From Claude')

  expect(efforts).toEqual(['low', 'high'])
})
