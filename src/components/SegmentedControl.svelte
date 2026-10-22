<script lang='ts' generics='Value extends string'>
  interface Option {
    value: Value
    label: string
  }

  interface Props {
    name: string
    options: readonly Option[]
    value: Value
    onchange: (value: Value) => void
  }

  const { name, options, value, onchange }: Props = $props()
</script>

<div class='segmented-control'>
  {#each options as option (option.value)}
    <label class='segment'>
      <input
        type='radio'
        {name}
        value={option.value}
        checked={value === option.value}
        onchange={() => onchange(option.value)}
      />
      {option.label}
    </label>
  {/each}
</div>

<style>
  .segmented-control {
    display: grid;
    grid-auto-columns: 1fr;
    grid-auto-flow: column;
    isolation: isolate;
  }

  .segment {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px var(--space-3);
    border: 1px solid var(--control-border);
    color: var(--grey);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
    transition:
      color 0.2s var(--ease-out-quint),
      background-color 0.2s var(--ease-out-quint),
      border-color 0.2s var(--ease-out-quint);
  }

  /* Overlap shared borders; z-index lifts the active segment's full border */
  .segment + .segment {
    margin-inline-start: -1px;
  }

  /* Invisible but full-size: keeps native click, keyboard and screen reader behaviour */
  .segment input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: inherit;
  }

  .segment:has(input:enabled:not(:checked)):hover {
    z-index: 1;
    border-color: var(--grey);
    color: var(--fg);
  }

  .segment:has(input:checked) {
    z-index: 2;
    background: var(--fg);
    border-color: var(--fg);
    color: var(--bg);
  }

  .segment:has(input:focus-visible) {
    z-index: 3;
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .segment:has(input:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (forced-colors: active) {
    .segment:has(input:checked) {
      forced-color-adjust: none;
      background: Highlight;
      border-color: Highlight;
      color: HighlightText;
    }
  }
</style>
