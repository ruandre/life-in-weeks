import { expect, generateTimeline, recordedPrompts, test } from './fixtures'

test('starts blank until a date of birth is entered', async ({ timelinePage: page }) => {
  await expect(page.getByText(/add your date of birth, then generate/i)).toBeVisible()
  await expect(page.getByLabel(/date of birth/i)).toHaveValue('')
  await expect(page.getByRole('gridcell')).toHaveCount(0)
})

test('draws the lifespan and counts the weeks lived', async ({ timelinePage: page }) => {
  await generateTimeline(page, { dob: '1990-05-15', lifespan: 70 })

  await expect(page.getByRole('gridcell')).toHaveCount(70 * 52)
  await expect(page.getByRole('row')).toHaveCount(70)
  await expect(page.getByText('1,894 weeks lived, 52.0% of expected lifespan.')).toBeAttached()
  await expect(page.getByRole('gridcell', { name: /^Age 36, week 23\b/ })).toHaveAttribute('aria-current', 'date')
})

test('researches a clicked week on the device', async ({ timelinePage: page }) => {
  await generateTimeline(page, { dob: '1990-05-15' })

  await page.getByRole('gridcell', { name: /^Age 10, week 1\b/ }).click()

  const results = page.getByRole('region', { name: /research results/i })
  await expect(results.getByRole('heading', { name: /that week in history/i })).toBeVisible()
  await expect(results.locator('strong', { hasText: 'Mocked' })).toBeVisible()
  await expect(results).toContainText('Age 10 · Week 1 · May 2000')
  expect((await recordedPrompts(page))[0]).toContain('week of May 15, 2000 to May 21, 2000')
})

test('researches the new date of birth for a week picked while the grid fades', async ({ timelinePage: page }) => {
  await generateTimeline(page, { dob: '1990-05-15' })
  await expect(page.getByRole('gridcell')).toHaveCount(70 * 52)

  await generateTimeline(page, { dob: '1980-01-01' })
  // Skips actionability waits so the click lands inside the fade, as an agent's would
  await page.getByRole('gridcell').first().dispatchEvent('click')

  await expect(page.getByRole('region', { name: /research results/i })).toContainText('Jan 1980')
  expect((await recordedPrompts(page)).at(-1)).toContain('week of January 1, 1980')
})

test('moves through the grid with the keyboard and selects with Enter', async ({ timelinePage: page }) => {
  await generateTimeline(page, { dob: '1990-05-15' })
  const firstWeek = page.getByRole('gridcell', { name: /^Age 0, week 1\b/ })
  await firstWeek.focus()

  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')

  const target = page.getByRole('gridcell', { name: /^Age 1, week 2\b/ })
  await expect(target).toBeFocused()
  await expect(target).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('region', { name: /research results/i })).toContainText('Age 1 · Week 2')
})

test('rejects a future date of birth and focuses the field', async ({ timelinePage: page }) => {
  await generateTimeline(page, { dob: '2030-01-01' })

  const dob = page.getByLabel(/date of birth/i)
  await expect(dob).toBeFocused()
  await expect(dob).toHaveAttribute('aria-invalid', 'true')
  await expect(dob).toHaveAccessibleDescription(/not a future one/i)
  await expect(page.getByRole('gridcell')).toHaveCount(0)
})
