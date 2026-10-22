/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { svelteTesting } from '@testing-library/svelte/vite'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  // svelteTesting only acts under Vitest: browser build of Svelte, auto cleanup
  plugins: [svelte(), svelteTesting()],
  base: './',
  test: {
    // DST zone exposes fixed-millisecond date arithmetic
    env: { TZ: 'Europe/London' },
    exclude: [...configDefaults.exclude, '.claude/**', 'e2e/**'],
  },
})
