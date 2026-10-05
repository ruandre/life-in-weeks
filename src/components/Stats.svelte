<script lang='ts'>
  import { prefersReducedMotion, Tween } from 'svelte/motion'
  import { STATS_ANIMATION_MS } from '../config/constants'
  import { easeOutExpo } from '../ui/animation'

  interface Props {
    targetLived: number
    targetProgress: number
  }

  const { targetLived, targetProgress }: Props = $props()

  const tweenOptions = {
    duration: () => prefersReducedMotion.current ? 0 : STATS_ANIMATION_MS,
    easing: easeOutExpo,
  }
  const livedTween = Tween.of(() => targetLived, tweenOptions)
  const progressTween = Tween.of(() => targetProgress, tweenOptions)

  let replaying = false

  const displayedLivedText = $derived(
    Math.floor(livedTween.current).toLocaleString(),
  )
  const displayedProgressText = $derived(
    `${progressTween.current.toFixed(1)}%`,
  )

  const accessibleSummary = $derived(
    `${targetLived.toLocaleString()} weeks lived, ${targetProgress.toFixed(1)}% of expected lifespan.`,
  )

  function handlePointerEnter(): void {
    if (replaying || prefersReducedMotion.current)
      return

    replaying = true
    livedTween.set(0, { duration: 0 })
    progressTween.set(0, { duration: 0 })
    livedTween.target = targetLived
    progressTween.target = targetProgress

    window.setTimeout(() => {
      replaying = false
    }, STATS_ANIMATION_MS)
  }
</script>

<dl
  class='stats'
  onpointerenter={handlePointerEnter}
>
  <div class='stat-group'>
    <dt class='stat-label'>WEEKS LIVED</dt>
    <dd class='stat-value accent' id='lived'>
      <span aria-hidden='true'>{displayedLivedText}</span>
      <span class='visually-hidden'>{targetLived.toLocaleString()}</span>
    </dd>
  </div>
  <div class='stat-group'>
    <dt class='stat-label'>PROGRESS</dt>
    <dd class='stat-value' id='progress'>
      <span aria-hidden='true'>{displayedProgressText}</span>
      <span class='visually-hidden'>{targetProgress.toFixed(1)}%</span>
    </dd>
  </div>
</dl>

<div class='visually-hidden' aria-live='polite' aria-atomic='true'>
  {accessibleSummary}
</div>

<style>
  .stats {
    margin-top: auto;
  }

  .stats:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }

  .stat-group {
    display: flex;
    flex-direction: column-reverse;
    margin-bottom: var(--space-6);
  }

  .stat-group:last-child {
    margin-bottom: 0;
  }

  .stat-value {
    font-size: 2.4rem;
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .stat-value.accent {
    color: var(--accent);
  }

  .stat-label {
    font-size: 0.8rem;
    color: var(--grey);
    margin-top: var(--space-1);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  @media (max-height: 800px) and (min-width: 1025px) {
    .stat-group {
      margin-bottom: var(--space-3);
    }

    .stat-value {
      font-size: 1.85rem;
    }

    .stat-label {
      font-size: 0.75rem;
      margin-top: 2px;
    }
  }

  @media (max-width: 1024px) {
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-6);
      margin-top: var(--space-4);
      margin-bottom: var(--space-2);
    }

    .stat-group {
      margin-bottom: 0;
      flex: 1 1 130px;
    }

    .stat-value {
      font-size: clamp(2rem, 6cqi, 2.5rem);
    }
  }
</style>
