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
