<script lang='ts'>
  interface Props {
    visible: boolean
    text: string
    x: number
    y: number
  }

  const { visible, text, x, y }: Props = $props()

  // Re-runs whenever visible changes
  function syncPopover(element: HTMLElement): void {
    element.togglePopover?.(visible)
  }
</script>

<div
  {@attach syncPopover}
  id='tooltip'
  popover='manual'
  class={['tooltip', visible && 'visible']}
  role='tooltip'
  aria-hidden={!visible ? 'true' : 'false'}
  style:translate='{x}px {y}px'
>
  {text}
</div>

<style>
  /* Translate keeps mousemove tracking off layout path */
  .tooltip {
    position: fixed;
    top: 0;
    left: 0;
    will-change: translate;
    pointer-events: none;
    background: var(--grey-dark);
    color: var(--fg);
    padding: var(--space-2) var(--space-4);
    border: 1px solid var(--border);
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    z-index: var(--z-overlay);
    opacity: 0;
    transition: opacity 0.1s var(--ease-out-quint);
    box-shadow: var(--tooltip-shadow);
    max-width: 260px;
    text-wrap: balance;
  }

  .tooltip:popover-open,
  .tooltip.visible {
    opacity: 1;
  }

  /* Pin to origin; popover default inset breaks translate positioning */
  .tooltip[popover] {
    inset: 0 auto auto 0;
    margin: 0;
    border: 1px solid var(--border);
  }
</style>
