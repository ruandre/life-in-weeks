<script lang='ts'>
  import type { ResearchState } from '../state/timeline.svelte'
  import ArrowUp from '@lucide/svelte/icons/arrow-up'
  import ExternalLink from '@lucide/svelte/icons/external-link'
  import LoaderCircle from '@lucide/svelte/icons/loader-circle'
  import { MONTH_YEAR_FORMAT } from '../lib/date'
  import { CLOUD_PROVIDERS } from '../services/cloud-provider-registry'
  import { settingsState } from '../state/settings.svelte'
  import Footer from './Footer.svelte'
  import ProviderSettings from './ProviderSettings.svelte'
  import ProviderToggle from './ProviderToggle.svelte'

  const cloudProviders = Object.values(CLOUD_PROVIDERS)

  interface Props {
    research: ResearchState
  }

  const { research }: Props = $props()

  const metaText = $derived.by(() => {
    if (research.age === null || research.weekInYear === null)
      return null
    if (research.weekStart) {
      return `Age ${research.age} · Week ${research.weekInYear} · ${MONTH_YEAR_FORMAT.format(research.weekStart)}`
    }
    return `Age ${research.age} · Week ${research.weekInYear}`
  })

  const BUSY_STATUSES = new Set<ResearchState['status']>(['loading', 'downloading', 'streaming'])
  const isBusy = $derived(BUSY_STATUSES.has(research.status))
  const showsLoader = $derived(research.status === 'loading' || research.status === 'downloading')

  const downloadPercent = $derived(Math.round((research.downloadProgress ?? 0) * 100))
</script>

{#snippet cloudKeyHint()}
  <p>
    Or get an API key at
    {#each cloudProviders as provider, index (provider.id)}
      {#if index > 0}or{/if}
      <a href={provider.keyConsoleUrl} target='_blank' rel='noopener noreferrer' class='inline-link'>{provider.keyConsoleName} <ExternalLink size={11} aria-hidden='true' /></a>
    {/each}
    and paste it under <strong>Model</strong> above.
  </p>
{/snippet}

<aside
  class={['research-panel', { 'has-settings': settingsState.isPanelOpen }]}
  id='research-panel'
  aria-labelledby='research-heading'
>
  <div class='research-header'>
    <a href='#main-content' class='back-to-timeline'>
      <ArrowUp size={13} aria-hidden='true' />
      <span>Back to timeline</span>
    </a>
    <h2 id='research-heading'>Time Capsule</h2>
    <p class='research-subhead'>
      {#if settingsState.provider !== 'local' && settingsState.hasCredentials}
        Runs through {settingsState.cloudProvider.name} API. The model you chose
        gets the week's dates and your age, which reveal your date of birth,
        plus your country.
      {:else if settingsState.provider !== 'local'}
        Nothing runs until you paste a {settingsState.cloudProvider.name} API
        key in Model settings. Close them to go back to the on-device model.
      {:else}
        Runs on your device. Nothing leaves the browser, and it gets things
        wrong (tiny model).
      {/if}
    </p>
    <ProviderToggle controls='provider-settings' />
  </div>

  <section
    class='settings-panel'
    id='provider-settings'
    aria-labelledby='provider-settings-heading'
    hidden={!settingsState.isPanelOpen}
  >
    <h3 id='provider-settings-heading'>Model settings</h3>
    <ProviderSettings />
  </section>

  <!-- Scrolls on desktop with no focusable children; tabindex lets keyboards scroll it -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class={['research-content', { 'has-loader': showsLoader }]}
    id='research-content'
    role='region'
    aria-label='Research results'
    tabindex='0'
    aria-busy={isBusy ? 'true' : undefined}
  >
    {#if metaText && research.status !== 'idle'}
      <div class='research-week-meta'>{metaText}</div>
    {/if}

    {#if research.status === 'idle'}
      <div class='research-empty'>
        Pick a week to see what the world was up to, what people were watching
        and listening to, and what was typical at&nbsp;that&nbsp;age.
      </div>
    {:else if research.status === 'loading'}
      <div class='loading-container'>
        <LoaderCircle size={22} class='loading-spinner' aria-hidden='true' />
        <div>Digging through that week&hellip;</div>
      </div>
    {:else if research.status === 'downloading'}
      <div class='loading-container'>
        <LoaderCircle size={22} class='loading-spinner' aria-hidden='true' />
        <label for='model-download-progress'>
          Downloading on-device model&hellip; {downloadPercent}%
        </label>
        <progress
          id='model-download-progress'
          class='download-progress'
          max='1'
          value={research.downloadProgress ?? 0}
        ></progress>
        <p class='download-note'>One-time download, stays on this device.</p>
      </div>
    {:else if research.status === 'unsupported'}
      <div class='research-empty research-instructions'>
        <strong>This browser has no built-in AI model.</strong>
        <ol>
          <li>Open Chrome 148 or later on desktop.</li>
          <li>
            Enable <strong>#prompt-api-for-gemini-nano</strong> at
            <code>chrome://flags</code>.
          </li>
          <li>Relaunch Chrome.</li>
        </ol>
        {@render cloudKeyHint()}
      </div>
    {:else if research.status === 'unavailable'}
      <div class='research-empty research-instructions'>
        <strong>The model is not ready on this device.</strong>
        <ol>
          <li>Check for 16GB RAM and 22GB free storage.</li>
          <li>
            Watch the "Optimization Guide On Device Model" download finish at <code
            >chrome://components</code
            >.
          </li>
        </ol>
        {@render cloudKeyHint()}
      </div>
    {:else if research.status === 'error'}
      <div class='research-empty'>
        {research.errorMessage}
      </div>
    {:else if research.status === 'streaming' || research.status === 'ready'}
      <div class='research-stream'>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html research.renderedHtml}
      </div>
    {/if}
  </div>

  <div class='visually-hidden' aria-live='polite'>
    {research.statusMessage}
  </div>

  <Footer />
</aside>

<style>
  .back-to-timeline {
    display: none;
  }

  .research-panel {
    --pad-block-start: var(--space-8);
    --pad-inline: var(--space-8);
    --pad-block-end: var(--space-3);
    --results-width: 340px;
    --settings-width: 300px;

    isolation: isolate;
    inline-size: var(--results-width);
    padding: var(--pad-block-start) var(--pad-inline) var(--pad-block-end);
    border-left: 1px solid var(--border);
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    background: var(--bg);
  }

  @media (max-height: 800px) and (min-width: 1025px) {
    .research-panel {
      --pad-block-start: var(--space-6);
      --pad-inline: var(--space-6);
    }
  }

  .settings-panel {
    padding-block: var(--space-4);
    border-bottom: 1px solid var(--border);
  }

  /* Own column only where the timeline keeps room; narrower screens stack it under the header */
  @media (min-width: 1400px) {
    .research-panel.has-settings {
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--settings-width);
      grid-template-rows: auto minmax(0, 1fr) auto;
      column-gap: var(--pad-inline);
      inline-size: calc(var(--results-width) + var(--pad-inline) + var(--settings-width));
    }

    /* Header, results, footer auto-flow into column 1; negative margins bleed divider to panel edges */
    .has-settings .settings-panel {
      grid-column: 2;
      grid-row: 1 / -1;
      margin: calc(-1 * var(--pad-block-start)) calc(-1 * var(--pad-inline)) calc(-1 * var(--pad-block-end)) 0;
      padding: var(--pad-block-start) var(--pad-inline) var(--pad-block-end);
      border-bottom: 0;
      border-left: 1px solid var(--border);
      overflow-y: auto;
    }
  }

  @media (max-width: 1024px) {
    .back-to-timeline {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-block-size: 24px;
      margin-bottom: var(--space-3);
      color: var(--grey);
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      text-decoration: none;
      text-transform: uppercase;
      font-weight: 700;
      transition: color 0.2s var(--ease-out-quint);
    }

    .back-to-timeline:hover,
    .back-to-timeline:focus-visible {
      color: var(--fg);
    }

    .research-panel {
      inline-size: auto;
      height: auto;
      min-height: 380px;
      max-height: none;
      border-left: none;
      border-top: 1px solid var(--border);
      padding: var(--space-6) var(--space-4);
      overflow-y: visible;
    }
  }

  .research-header {
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--border);
  }

  .research-header h2,
  .settings-panel h3 {
    font-size: 1.15rem;
    letter-spacing: 0.05em;
    color: var(--fg);
    font-weight: 700;
    text-transform: uppercase;
    text-wrap: balance;
  }

  .settings-panel h3 {
    margin-bottom: var(--space-4);
  }

  .research-subhead {
    margin-top: var(--space-2);
    font-size: 0.75rem;
    letter-spacing: 0.03em;
    color: var(--grey);
    text-transform: none;
  }

  @media (max-width: 1024px), (max-height: 800px) {
    .research-header {
      padding-bottom: var(--space-3);
    }

    .research-header h2,
    .settings-panel h3 {
      font-size: 0.95rem;
    }

    .research-subhead {
      margin-top: 4px;
      font-size: 0.7rem;
    }
  }

  @media (max-height: 680px) {
    .research-header h2,
    .settings-panel h3 {
      font-size: 0.85rem;
    }

    .research-header {
      padding-bottom: var(--space-2);
    }
  }

  .research-week-meta {
    color: var(--grey);
    font-size: 0.75rem;
    letter-spacing: 0.03em;
    margin-bottom: var(--space-4);
  }

  .research-content {
    flex: 1;
    padding: var(--space-4) 0;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--fg);
    text-transform: none;
    overflow-y: auto;
  }

  .research-content:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* Loader fills space below week meta without overflowing */
  .research-content.has-loader {
    display: flex;
    flex-direction: column;
  }

  .research-content :global(h3) {
    color: var(--accent);
    margin-top: var(--space-6);
    margin-bottom: var(--space-3);
    text-transform: uppercase;
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    border-bottom: 1px solid var(--border);
    padding-bottom: var(--space-2);
    text-wrap: balance;
  }

  .research-content :global(h3:first-child) {
    margin-top: 0;
  }

  .research-content :global(h4) {
    color: var(--fg);
    margin-top: var(--space-4);
    margin-bottom: var(--space-2);
    font-size: 0.9rem;
    font-weight: 700;
    text-wrap: balance;
  }

  .research-content :global(p) {
    margin-bottom: var(--space-4);
    color: var(--grey);
    text-wrap: pretty;
    max-inline-size: 70ch;
  }

  .research-content :global(ul) {
    margin-bottom: var(--space-4);
    padding-left: 0;
    list-style: none;
  }

  /* Numbers sit in the gutter so item text aligns with bullet items */
  .research-content :global(ol) {
    margin-bottom: var(--space-4);
    padding-left: var(--space-4);
  }

  .research-content :global(ol > li) {
    padding-left: 0;
  }

  .research-content :global(li > :is(ul, ol)) {
    margin-top: var(--space-2);
    margin-bottom: 0;
  }

  .research-content :global(li) {
    margin-bottom: var(--space-2);
    padding-left: var(--space-4);
    position: relative;
    color: var(--grey);
  }

  .research-stream :global(ul > li::before) {
    content: "";
    position: absolute;
    left: 0;
    top: 0.6em;
    width: 5px;
    height: 5px;
    background: var(--accent);
  }

  .research-stream :global(> :last-child) {
    margin-bottom: 0;
  }

  .research-content :global(strong) {
    color: var(--fg);
    font-weight: 700;
  }

  .research-content[aria-busy="true"] .research-stream::after {
    content: "";
    display: inline-block;
    width: 0.5em;
    height: 1em;
    margin-left: 2px;
    background: var(--accent);
    vertical-align: text-bottom;
    animation: 1s step-end infinite blink;
  }

  .research-empty {
    color: var(--grey);
    text-align: center;
    margin-top: var(--space-12);
    font-style: normal;
    text-wrap: balance;
  }

  .research-instructions {
    text-align: left;
  }

  .research-instructions > strong {
    display: block;
    color: var(--fg);
    margin-bottom: var(--space-4);
    text-align: center;
  }

  .research-instructions ol {
    padding-left: var(--space-6);
  }

  .research-instructions li {
    margin-bottom: var(--space-2);
    color: var(--grey);
  }

  .research-instructions p {
    margin-top: var(--space-4);
    color: var(--grey);
    text-wrap: pretty;
  }

  .research-instructions a {
    color: var(--fg);
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s var(--ease-out-quint);
  }

  .research-instructions a:hover,
  .research-instructions a:focus-visible {
    color: var(--accent);
  }

  .research-content :global(code),
  .research-instructions code {
    font-family: monospace;
    background: var(--grey-dark);
    color: var(--fg);
    padding: 0.1em 0.4em;
    font-size: 0.85em;
  }

  .inline-link {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .loading-container :global(.loading-spinner) {
    animation: 1s linear infinite spin;
    margin-bottom: var(--space-4);
    color: var(--fg);
  }

  .download-progress {
    inline-size: min(100%, 16rem);
    margin-top: var(--space-4);
    accent-color: var(--accent);
  }

  .download-note {
    margin-top: var(--space-4);
    font-size: 0.875em;
  }

  .loading-container {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--grey);
    text-align: center;
  }
</style>
