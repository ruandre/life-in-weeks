<script lang='ts'>
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import { CLOUD_PROVIDERS, isCloudProviderId } from '../services/cloud-provider-registry'
  import { settingsState } from '../state/settings.svelte'

  const cloudProviders = Object.values(CLOUD_PROVIDERS)

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

  function handleToggle(event: Event & { currentTarget: HTMLDetailsElement }): void {
    settingsState.setPanelOpen(event.currentTarget.open)
  }

  function handleKeyInput(event: Event & { currentTarget: HTMLInputElement }): void {
    settingsState.setApiKey(event.currentTarget.value)
  }

  function handleModelChange(event: Event & { currentTarget: HTMLSelectElement }): void {
    settingsState.setModel(event.currentTarget.value)
  }

  function handleProviderChange(event: Event & { currentTarget: HTMLInputElement }): void {
    const { value } = event.currentTarget
    if (isCloudProviderId(value))
      settingsState.setCloudProvider(value)
  }
</script>

<details class='provider' ontoggle={handleToggle}>
  <summary>
    <span class='summary-label'>
      <SlidersHorizontal size={13} aria-hidden='true' />
      <span>Model</span>
    </span>
    <span class='provider-badge'>
      {settingsState.provider === 'local' ? 'On device' : `${cloud.name} API`}
    </span>
  </summary>

  <div class='provider-body'>
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
      <p class='hint' id='cloud-key-hint'>
        Get an API key at <a href={cloud.keyConsoleUrl} target='_blank' rel='noopener noreferrer' class='inline-link'>{cloud.keyConsoleName} <ExternalLink size={11} aria-hidden='true' /></a>. {cloud.billingNote} Paste it to run research through {cloud.name} instead of the on-device model. Held in memory only and never saved: closing this panel or reloading clears it and returns to the on-device model.
      </p>
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
  </div>
</details>

<style>
  .provider {
    margin-top: var(--space-3);
    border: 1px solid var(--border);
  }

  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    cursor: pointer;
    color: var(--grey);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    transition: color 0.2s var(--ease-out-quint);
  }

  summary:hover,
  summary:focus-visible {
    color: var(--fg);
  }

  .provider-badge {
    color: var(--accent);
    font-weight: 500;
  }

  .provider-body {
    padding: 0 var(--space-3) var(--space-3);
  }

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

  .summary-label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .summary-label :global(svg) {
    flex-shrink: 0;
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
