<script lang='ts'>
  import LoaderCircle from '@lucide/svelte/icons/loader-circle'
  import { flushSync } from 'svelte'
  import { LIFESPAN_MAX_YEARS, LIFESPAN_MIN_YEARS } from '../config/constants'
  import { COUNTRIES } from '../config/countries'
  import { isValidLifespan, parseBirthDate } from '../domain/timeline-input'
  import { formatLocalIsoDate } from '../lib/date'

  interface Props {
    dob: string
    country: string
    lifespan: number
    isGenerating: boolean
    onGenerate: (data: { dob: string, country: string, lifespan: number }) => void
  }

  let {
    dob = $bindable(),
    country = $bindable(),
    lifespan = $bindable(),
    isGenerating,
    onGenerate,
  }: Props = $props()

  let dobInputEl: HTMLInputElement | null = null
  let countryInputEl: HTMLInputElement | null = null
  let lifespanInputEl: HTMLInputElement | null = null

  let dobError = $state(false)
  let countryError = $state(false)
  let lifespanError = $state(false)
  let dobErrorMessage = $state('')
  let countryErrorMessage = $state('')
  let lifespanErrorMessage = $state('')

  // Refreshed on focus; a tab left open past midnight keeps a stale max otherwise
  let maxDate = $state(formatLocalIsoDate(new Date()))

  function refreshMaxDate(): void {
    maxDate = formatLocalIsoDate(new Date())
  }

  /** Case-insensitive; '' if empty, null if no match */
  function canonicalCountry(value: string): string | null {
    const trimmed = value.trim()
    if (trimmed === '')
      return ''
    return COUNTRIES.find(c => c.toLowerCase() === trimmed.toLowerCase()) ?? null
  }

  function validate(): boolean {
    const isDobValid = parseBirthDate(dob) !== null
    const isLifespanValid = isValidLifespan(lifespan)
    const matchedCountry = canonicalCountry(country)
    const isCountryValid = matchedCountry !== null

    if (isCountryValid)
      country = matchedCountry

    dobError = !isDobValid
    countryError = !isCountryValid
    lifespanError = !isLifespanValid

    dobErrorMessage = isDobValid ? '' : 'Enter a real date of birth, not a future one.'
    countryErrorMessage = isCountryValid ? '' : 'Pick a country from the list, or leave it blank.'
    lifespanErrorMessage = isLifespanValid
      ? ''
      : `Enter a whole number of years between ${LIFESPAN_MIN_YEARS} and ${LIFESPAN_MAX_YEARS}.`

    if (isDobValid && isCountryValid && isLifespanValid) {
      return true
    }

    // Screen readers announce on focus; aria-invalid must be in the DOM first
    flushSync()
    if (!isDobValid)
      dobInputEl?.focus()
    else if (!isCountryValid)
      countryInputEl?.focus()
    else if (!isLifespanValid)
      lifespanInputEl?.focus()

    return false
  }

  function handleSubmit(e: SubmitEvent): void {
    e.preventDefault()
    const isValid = validate()

    if (isValid) {
      onGenerate({ dob, country, lifespan })
      // WebMCP agent form invocation
      if (e.agentInvoked && typeof e.respondWith === 'function') {
        e.respondWith(Promise.resolve(JSON.stringify({
          status: 'success',
          dob,
          country: country || null,
          lifespan,
          message: `Generated life timeline for DOB ${dob}, expected lifespan ${lifespan} years.`,
        })))
      }
    }
    else {
      if (e.agentInvoked && typeof e.respondWith === 'function') {
        const errors = [dobErrorMessage, countryErrorMessage, lifespanErrorMessage].filter(Boolean).join(' ')
        e.respondWith(Promise.resolve(`Validation failed: ${errors}`))
      }
    }
  }

  function handleDobChange(): void {
    if (dobErrorMessage)
      validate()
  }

  function handleCountryInput(): void {
    if (countryErrorMessage)
      validate()
  }

  function handleCountryChange(): void {
    const matched = canonicalCountry(country)
    if (matched !== null)
      country = matched
  }

  function handleLifespanInput(): void {
    if (lifespanErrorMessage)
      validate()
  }
</script>

<form
  novalidate
  toolname='generate_life_timeline'
  tooldescription='Generate or update the life timeline grid from date of birth, country, and expected lifespan'
  toolautosubmit
  onsubmit={handleSubmit}
>
  <div class='form-group'>
    <label for='dob'>DATE OF BIRTH</label>
    <input
      bind:this={dobInputEl}
      type='date'
      id='dob'
      name='dob'
      bind:value={dob}
      max={maxDate}
      toolparamdescription='YYYY-MM-DD date of birth, not in the future'
      required
      class={[dobError && 'error']}
      aria-invalid={dobError ? 'true' : undefined}
      aria-errormessage={dobError ? 'dob-error' : undefined}
      aria-describedby={dobError ? 'dob-error' : undefined}
      onfocus={refreshMaxDate}
      onchange={handleDobChange}
    />
    <div
      class={['error-message', dobErrorMessage && 'visible']}
      id='dob-error'
      role='alert'
      aria-live='assertive'
    >
      {dobErrorMessage}
    </div>
  </div>

  <div class='form-group'>
    <label for='country'>COUNTRY <span class='label-optional'>(OPTIONAL)</span></label>
    <input
      bind:this={countryInputEl}
      type='text'
      id='country'
      name='country'
      list='country-list'
      bind:value={country}
      autocomplete='country-name'
      autocapitalize='words'
      spellcheck='false'
      placeholder='Type to search…'
      toolparamdescription='Country name for localized historical context (optional)'
      class={[countryError && 'error']}
      aria-invalid={countryError ? 'true' : undefined}
      aria-errormessage={countryError ? 'country-error' : undefined}
      aria-describedby={countryError ? 'country-error' : undefined}
      oninput={handleCountryInput}
      onchange={handleCountryChange}
    />
    <datalist id='country-list'>
      {#each COUNTRIES as c (c)}
        <option value={c}></option>
      {/each}
    </datalist>
    <div
      class={['error-message', countryErrorMessage && 'visible']}
      id='country-error'
      role='alert'
      aria-live='assertive'
    >
      {countryErrorMessage}
    </div>
  </div>

  <div class='form-group'>
    <label for='lifespan'>EXPECTED LIFESPAN (YEARS)</label>
    <input
      bind:this={lifespanInputEl}
      type='number'
      id='lifespan'
      name='lifespan'
      bind:value={lifespan}
      min={LIFESPAN_MIN_YEARS}
      max={LIFESPAN_MAX_YEARS}
      step='1'
      inputmode='numeric'
      toolparamdescription='Expected total lifespan in whole years, between 1 and 120'
      required
      class={[lifespanError && 'error']}
      aria-invalid={lifespanError ? 'true' : undefined}
      aria-errormessage={lifespanError ? 'lifespan-error' : undefined}
      aria-describedby={lifespanError ? 'lifespan-error' : undefined}
      oninput={handleLifespanInput}
    />
    <div
      class={['error-message', lifespanErrorMessage && 'visible']}
      id='lifespan-error'
      role='alert'
      aria-live='assertive'
    >
      {lifespanErrorMessage}
    </div>
  </div>

  <button
    class='btn'
    type='submit'
    disabled={isGenerating}
    aria-busy={isGenerating}
  >
    {#if isGenerating}
      <LoaderCircle size={15} class='btn-spinner' aria-hidden='true' />
      <span>Generating…</span>
    {:else}
      <span>Generate Timeline</span>
    {/if}
  </button>
</form>

<style>
  .form-group {
    margin-bottom: var(--space-6);
  }

  label {
    display: block;
    margin-bottom: var(--space-2);
    color: var(--grey);
    font-size: 0.8rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .label-optional {
    color: var(--grey);
    font-weight: 400;
  }

  input {
    background: transparent;
    border: 1px solid var(--control-border);
    color: var(--fg);
    font-family: var(--font);
    font-size: 1rem;
    font-weight: 500;
    padding: 10px var(--space-3);
    width: 100%;
    outline: none;
    border-radius: 0;
    transition: border-color 0.2s var(--ease-out-quint);
  }

  input:hover {
    border-color: var(--grey);
  }

  input:focus-visible {
    border-color: var(--fg);
  }

  input:user-invalid,
  input.error {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* Chromium datalist indicator ignores display:none; mask instead */
  input[list]::-webkit-calendar-picker-indicator {
    width: 12px;
    height: 8px;
    padding: 0;
    margin-inline-start: var(--space-2);
    opacity: 1; /* Chromium hides indicator until focus */
    background-color: var(--grey);
    mask: var(--chevron-icon) center / contain no-repeat;
    -webkit-mask: var(--chevron-icon) center / contain no-repeat;
    cursor: pointer;
    transition: background-color 0.2s var(--ease-out-quint);
  }

  input[list]:hover::-webkit-calendar-picker-indicator,
  input[list]:focus::-webkit-calendar-picker-indicator {
    background-color: var(--fg);
  }

  input[type='date']::-webkit-calendar-picker-indicator {
    width: 16px;
    height: 16px;
    padding: 0;
    margin-inline-start: var(--space-2);
    background-color: var(--grey);
    mask: var(--calendar-icon) center / contain no-repeat;
    -webkit-mask: var(--calendar-icon) center / contain no-repeat;
    cursor: pointer;
    transition: background-color 0.2s var(--ease-out-quint);
  }

  input[type='date']:hover::-webkit-calendar-picker-indicator,
  input[type='date']:focus-visible::-webkit-calendar-picker-indicator {
    background-color: var(--fg);
  }

  input[type='number'] {
    appearance: textfield;
    -moz-appearance: textfield;
  }

  input[type='number']::-webkit-outer-spin-button,
  input[type='number']::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .btn {
    background: var(--fg);
    color: var(--bg);
    border: none;
    font-family: var(--font);
    font-size: 0.95rem;
    font-weight: 700;
    padding: var(--space-3) var(--space-4);
    cursor: pointer;
    width: 100%;
    margin-top: var(--space-1);
    margin-bottom: var(--space-6);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    border-radius: 0;
    transition: all 0.2s var(--ease-out-quint);
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }

  .btn :global(.btn-spinner) {
    animation: 1s linear infinite spin;
    flex-shrink: 0;
  }

  .btn::after {
    content: '';
    position: absolute;
    inset: 0;
    background: oklch(0 0 0 / 0.1);
    opacity: 0;
    transition: opacity 0.2s var(--ease-out-quint);
  }

  .btn:hover::after {
    opacity: 1;
  }

  .btn:active {
    transform: scale(0.98);
  }

  .btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .error-message {
    color: var(--accent);
    font-size: 0.85rem;
    margin-top: var(--space-2);
    display: none;
    opacity: 0;
    transform: translateY(-4px);
    transition: all 0.3s var(--ease-out-quint);
  }

  .error-message.visible {
    display: block;
    opacity: 1;
    transform: translateY(0);
  }

  @media (max-width: 1024px), (max-height: 800px) {
    .form-group {
      margin-bottom: var(--space-3);
    }

    label {
      font-size: 0.75rem;
      margin-bottom: 4px;
    }

    input {
      font-size: 0.95rem;
      padding: var(--space-2) var(--space-3);
    }

    .btn {
      margin-top: 0;
      margin-bottom: var(--space-4);
      padding: var(--space-2) var(--space-3);
      font-size: 0.85rem;
    }
  }

  @media (max-height: 680px) {
    .form-group {
      margin-bottom: 8px;
    }

    label {
      font-size: 0.7rem;
      margin-bottom: 2px;
    }

    input {
      font-size: 0.875rem;
      padding: 5px var(--space-2);
    }

    .btn {
      padding: 7px var(--space-2);
      font-size: 0.8rem;
      margin-bottom: var(--space-2);
    }
  }
</style>
