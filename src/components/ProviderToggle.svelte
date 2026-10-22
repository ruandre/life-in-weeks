<script lang='ts'>
  import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal'
  import { settingsState } from '../state/settings.svelte'

  interface Props {
    controls: string
  }

  const { controls }: Props = $props()

  const badge = $derived(settingsState.provider === 'local' ? 'On device' : `${settingsState.cloudProvider.name} API`)

  function toggle(): void {
    settingsState.setPanelOpen(!settingsState.isPanelOpen)
  }
</script>

<button
  type='button'
  class='provider-toggle'
  aria-expanded={settingsState.isPanelOpen}
  aria-controls={controls}
  onclick={toggle}
>
  <span class='toggle-label'>
    <SlidersHorizontal size={13} aria-hidden='true' />
    <span>Model</span>
  </span>
  <span class='provider-badge'>{badge}</span>
</button>

<style>
  .provider-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    inline-size: 100%;
    margin-top: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 0;
    cursor: pointer;
    color: var(--grey);
    font-family: var(--font);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    transition:
      color 0.2s var(--ease-out-quint),
      border-color 0.2s var(--ease-out-quint);
  }

  .provider-toggle:hover,
  .provider-toggle:focus-visible,
  .provider-toggle[aria-expanded='true'] {
    color: var(--fg);
  }

  .provider-toggle[aria-expanded='true'] {
    border-color: var(--grey);
  }

  .provider-toggle:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }

  .toggle-label :global(svg) {
    flex-shrink: 0;
  }

  .provider-badge {
    color: var(--accent);
    font-weight: 500;
  }
</style>
