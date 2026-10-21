<script lang='ts'>
  import { onMount } from 'svelte'
  import Header from './components/Header.svelte'
  import ResearchPanel from './components/ResearchPanel.svelte'
  import Stats from './components/Stats.svelte'
  import TimelineForm from './components/TimelineForm.svelte'
  import TimelineGrid from './components/TimelineGrid.svelte'
  import { initWebMCP } from './domain/webmcp'
  import { timelineState } from './state/timeline.svelte'

  onMount(() => {
    const { dob, country, lifespan } = timelineState
    if (dob && lifespan) {
      timelineState.restore({ dob, country, lifespan })
    }

    const cleanupWebMCP = initWebMCP({
      getDob: () => timelineState.displayedDob,
      getLifespan: () => timelineState.displayedLifespan,
      selectWeek: (w: number) => timelineState.selectWeek(w),
    })

    if (import.meta.env.DEV) {
      window.__LIFE_IN_WEEKS__ = {
        state: timelineState,
        selectWeek: (w: number) => timelineState.selectWeek(w),
      }
    }

    return () => {
      cleanupWebMCP()
    }
  })
</script>

<a href='#main-content' class='skip-link'>Skip to timeline</a>

<div class='layout'>
  <aside class='sidebar' aria-label='Timeline settings'>
    <Header />
    <TimelineForm
      bind:dob={timelineState.dob}
      bind:country={timelineState.country}
      bind:lifespan={timelineState.lifespan}
      isGenerating={timelineState.isGenerating}
      onGenerate={input => timelineState.generate(input)}
    />
    <Stats
      targetLived={timelineState.stats.targetLived}
      targetProgress={timelineState.stats.targetProgress}
    />
  </aside>

  <TimelineGrid
    timeline={timelineState.timeline}
    dob={timelineState.displayedDob}
    lifespan={timelineState.displayedLifespan}
    hasGenerated={timelineState.hasGenerated}
    isLoaded={timelineState.isGridLoaded}
    selectedWeek={timelineState.selectedWeek}
    onSelectWeek={w => timelineState.selectWeek(w)}
    onWarmUp={() => timelineState.warmUp()}
  />

  <ResearchPanel research={timelineState.research} />
</div>

<style>
  /* Stacking isolation contains child z-indices */
  .layout,
  .sidebar {
    isolation: isolate;
  }

  .layout {
    display: grid;
    grid-template-columns: minmax(260px, 300px) 1fr minmax(280px, 340px);
    height: 100dvh;
    overflow: hidden;
  }

  .sidebar {
    padding: var(--space-12) var(--space-8);
    border-right: 1px solid var(--border);
    height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    container-type: inline-size;
  }

  @media (max-height: 800px) and (min-width: 1025px) {
    .sidebar {
      padding: var(--space-6) var(--space-6);
    }
  }

  .skip-link {
    position: absolute;
    top: var(--space-4);
    left: var(--space-4);
    z-index: var(--z-toast);
    padding: var(--space-3) var(--space-4);
    background: var(--fg);
    color: var(--bg);
    font-weight: 700;
    text-decoration: none;
    transform: translateY(-200%);
    transition: transform 0.2s var(--ease-out-quint);
  }

  .skip-link:focus,
  .skip-link:focus-visible {
    transform: translateY(0);
  }

  @media (max-width: 1024px) {
    .layout {
      display: flex;
      flex-direction: column;
      height: auto;
      min-height: 100dvh;
      overflow: visible;
    }

    .sidebar {
      height: auto;
      max-height: none;
      border-right: none;
      border-bottom: 1px solid var(--border);
      padding: var(--space-6) var(--space-4);
      overflow: visible;
    }
  }
</style>
