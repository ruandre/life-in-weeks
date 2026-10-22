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

<div class='radio-row'>
  {#each options as option (option.value)}
    <label class='radio'>
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

  .radio:has(input:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
