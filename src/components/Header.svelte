<script lang='ts'>
  import { HEADING_REPLAY_MS } from '../config/constants'

  let replaying = false

  function handlePointerEnter(e: PointerEvent): void {
    if (replaying)
      return

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return

    replaying = true

    const currentTarget = e.currentTarget as HTMLElement
    const words = currentTarget.querySelectorAll<HTMLElement>('.word-inner')

    // Reflow restarts CSS animation; batched to avoid layout thrashing
    for (const word of words) {
      word.style.animation = 'none'
    }
    void currentTarget.offsetWidth
    for (const word of words) {
      word.style.animation = ''
    }

    window.setTimeout(() => {
      replaying = false
    }, HEADING_REPLAY_MS)
  }
</script>

<header class='sidebar-header'>
  <h1 onpointerenter={handlePointerEnter} aria-label='Life in Weeks'>
    <span class='word'><span class='word-inner'>LIFE</span></span>
    <span class='word'><span class='word-inner'>IN</span></span>
    <span class='word'
    ><span class='word-inner'>WEEKS<span class='accent-dot'>.</span></span
    ></span
    >
  </h1>
</header>

<style>
  h1 {
    font-size: clamp(2.5rem, 14cqi, 5rem);
    line-height: 0.85;
    margin-bottom: var(--space-8);
    letter-spacing: -0.02em;
    font-weight: 700;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 1024px), (max-height: 800px) {
    h1 {
      margin-bottom: var(--space-4);
      font-size: clamp(2rem, 11cqi, 3.5rem);
    }
  }

  .word {
    overflow: hidden;
    display: inline-block;
  }

  .word-inner {
    display: inline-block;
    transform: translateY(110%);
    animation: reveal-text 0.8s var(--ease-out-expo) forwards;
    will-change: transform;
  }

  .word:nth-child(1) .word-inner {
    animation-delay: 0.1s;
  }

  .word:nth-child(2) .word-inner {
    animation-delay: 0.2s;
  }

  .word:nth-child(3) .word-inner {
    animation-delay: 0.3s;
  }

  .accent-dot {
    color: var(--accent);
    display: inline-block;
  }
</style>
