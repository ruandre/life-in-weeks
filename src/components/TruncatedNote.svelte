<script lang='ts'>
  import type { Attachment } from 'svelte/attachments'

  interface Props {
    text: string
  }

  const { text }: Props = $props()

  const noteId = $props.id()
  let isExpanded = $state(false)
  let isOverflowing = $state(false)

  const isTruncated = $derived(isOverflowing && !isExpanded)

  // Overflow depends on viewport-driven clamp; parent keys this component by text
  const trackOverflow: Attachment<HTMLElement> = (element) => {
    const observer = new ResizeObserver(() => {
      isOverflowing = element.scrollWidth > element.clientWidth
    })
    observer.observe(element)
    return () => observer.disconnect()
  }
</script>

<div class='truncated-note'>
  <span
    {@attach trackOverflow}
    class={['note', { expanded: isExpanded }]}
    id={noteId}
    title={isTruncated ? text : undefined}
  >{text}</span>
  {#if isOverflowing || isExpanded}
    <button
      type='button'
      class='note-toggle'
      aria-controls={noteId}
      onclick={() => (isExpanded = !isExpanded)}
    >
      {isExpanded ? 'Less' : 'More'}
    </button>
  {/if}
</div>

<style>
  .truncated-note {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
  }

  .note {
    min-inline-size: 0;
  }

  .note-toggle {
    flex-shrink: 0;
    padding: 0;
    background: none;
    border: 0;
    color: var(--fg);
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
    transition: color 0.2s var(--ease-out-quint);
  }

  .note-toggle:hover,
  .note-toggle:focus-visible {
    color: var(--accent);
  }

  /* Sync with ResearchPanel: model settings stack under its header below 1400px */
  @media (width < 1400px) {
    .note:not(.expanded) {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  @media (width >= 1400px) {
    .note-toggle {
      display: none;
    }
  }
</style>
