<script lang='ts'>
  import type { ResearchEffort } from '../types'
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import { isResearchEffort, RESEARCH_EFFORTS } from '../domain/research-effort'
  import { CLOUD_PROVIDERS, isCloudProviderId } from '../services/cloud-provider-registry'
  import { settingsState } from '../state/settings.svelte'
  import TruncatedNote from './TruncatedNote.svelte'

  const cloudProviders = Object.values(CLOUD_PROVIDERS)

  const EFFORT_LABELS: Record<ResearchEffort, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  }

  const statusText = $derived.by(() => {
    switch (settingsState.keyStatus) {
      case 'checking': return 'Checking that key\u2026'
      case 'invalid': return settingsState.keyError
      case 'valid': return `${settingsState.models.length} models available`
      default: return null
    }
  })

  // Placeholder option value is ''; an unmatched value blanks the select
  const selectedModel = $derived(settingsState.canPickModel ? settingsState.model : '')

  const cloud = $derived(settingsState.cloudProvider)

  const keyNote = $derived(`${cloud.billingNote} Paste it to run research through ${cloud.name} instead of the on-device model. Held in memory only and never saved: closing this panel or reloading clears it and returns to the on-device model.`)

  function handleKeyInput(event: Event & { currentTarget: HTMLInputElement }): void {
    settingsState.setApiKey(event.currentTarget.value)
  }

  function handleModelChange(event: Event & { currentTarget: HTMLSelectElement }): void {
    settingsState.setModel(event.currentTarget.value)
  }

  function handleEffortChange(event: Event & { currentTarget: HTMLInputElement }): void {
    const { value } = event.currentTarget
    if (isResearchEffort(value))
      settingsState.setEffort(value)
  }

  function handleProviderChange(event: Event & { currentTarget: HTMLInputElement }): void {
    const { value } = event.currentTarget
    if (isCloudProviderId(value))
      settingsState.setCloudProvider(value)
  }
</script>

<div>
  <fieldset class='field'>
    <legend>Provider</legend>
    <div class='radio-row'>
      {#each cloudProviders as option (option.id)}
        <label class='radio'>
          <input
            type='radio'
            name='cloud-provider'
            value={option.id}
            checked={settingsState.cloudProviderId === option.id}
            onchange={handleProviderChange}
          />
          {option.name}
        </label>
      {/each}
    </div>
  </fieldset>

  <div class='field'>
    <label for='cloud-key'>{cloud.name} API key</label>
    <input
      type='password'
      id='cloud-key'
      name='cloud-key'
      value={settingsState.apiKey}
      placeholder={cloud.keyPlaceholder}
      autocomplete='off'
      spellcheck='false'
      aria-describedby='cloud-key-hint'
      aria-invalid={settingsState.keyStatus === 'invalid' ? 'true' : undefined}
      oninput={handleKeyInput}
    />
    {#if statusText}
      <p
        class={['hint', settingsState.keyStatus === 'invalid' && 'hint-error']}
        role='status'
        aria-live='polite'
      >
        {statusText}
      </p>
    {/if}
    <div class='hint' id='cloud-key-hint'>
      <p>Get an API key at <a href={cloud.keyConsoleUrl} target='_blank' rel='noopener noreferrer' class='inline-link'>{cloud.keyConsoleName} <ExternalLink size={11} aria-hidden='true' /></a>.</p>
      {#key cloud.id}
        <TruncatedNote text={keyNote} />
      {/key}
    </div>
  </div>

  <div class='field'>
    <label for='cloud-model'>{cloud.name} model</label>
    <div class='select-shell'>
      <select
        id='cloud-model'
        name='cloud-model'
        value={selectedModel}
        disabled={!settingsState.canPickModel}
        onchange={handleModelChange}
      >
        {#if settingsState.canPickModel}
          {#each settingsState.models as model (model.id)}
            <option value={model.id}>{model.name}</option>
          {/each}
        {:else}
          <option value=''>Paste a key to load models</option>
        {/if}
      </select>
    </div>
  </div>

  {#if cloud.offersEffort}
    <fieldset class='field' disabled={!settingsState.canChooseEffort} aria-describedby='effort-hint'>
      <legend>Effort</legend>
      <div class='radio-row'>
        {#each RESEARCH_EFFORTS as level (level)}
          <label class='radio'>
            <input
              type='radio'
              name='effort'
              value={level}
              checked={settingsState.effort === level}
              onchange={handleEffortChange}
            />
            <!-- eslint-disable-next-line security/detect-object-injection -- level comes from the ResearchEffort list -->
            {EFFORT_LABELS[level]}
          </label>
        {/each}
      </div>
      <p class='hint' id='effort-hint'>
        {#if settingsState.canChooseEffort}
          Low answers fastest and costs least. Medium and High think longer.
        {:else}
          This model does not take an effort level.
        {/if}
      </p>
    </fieldset>
  {/if}
</div>

<style>
  .field + .field {
    margin-top: var(--space-4);
  }

  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  legend,
  .field > label {
    display: block;
    margin-bottom: var(--space-2);
    padding: 0;
    color: var(--grey);
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .radio-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2) var(--space-4);
  }

  .radio {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--fg);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
  }

  .radio input {
    margin: 0;
    accent-color: var(--accent);
  }

  fieldset:disabled .radio {
    opacity: 0.5;
    cursor: not-allowed;
  }

  input[type='password'],
  select {
    background: transparent;
    border: 1px solid var(--control-border);
    color: var(--fg);
    font-family: var(--font);
    font-size: 0.85rem;
    font-weight: 500;
    padding: 8px var(--space-3);
    width: 100%;
    outline: none;
    border-radius: 0;
    transition: border-color 0.2s var(--ease-out-quint);
  }

  .select-shell {
    position: relative;
  }

  /* Mask black SVG to inherit theme color */
  .select-shell::after {
    content: '';
    position: absolute;
    right: var(--space-3);
    top: 50%;
    width: 12px;
    height: 8px;
    transform: translateY(-50%);
    pointer-events: none;
    background-color: var(--grey);
    mask: var(--chevron-icon) center / contain no-repeat;
    -webkit-mask: var(--chevron-icon) center / contain no-repeat;
    transition: background-color 0.2s var(--ease-out-quint);
  }

  .select-shell:hover::after {
    background-color: var(--fg);
  }

  .select-shell:has(select:disabled)::after {
    opacity: 0.5;
  }

  select {
    appearance: none;
    padding-right: var(--space-8);
  }

  option {
    background: var(--bg);
    color: var(--fg);
  }

  input[type='password']:hover,
  select:hover {
    border-color: var(--grey);
  }

  input[type='password']:focus-visible,
  select:focus-visible {
    border-color: var(--fg);
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hint {
    margin-top: var(--space-2);
    color: var(--grey);
    font-size: 0.7rem;
    line-height: 1.5;
    text-transform: none;
    text-wrap: pretty;
  }

  .hint a {
    color: var(--fg);
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s var(--ease-out-quint);
  }

  .hint a:hover,
  .hint a:focus-visible {
    color: var(--accent);
  }

  .inline-link {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .inline-link :global(svg) {
    flex-shrink: 0;
  }

  .hint-error {
    color: var(--accent);
  }
</style>
