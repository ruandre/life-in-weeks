/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [svelte()],
  base: './',
  test: {
    // DST zone exposes fixed-millisecond date arithmetic
    env: { TZ: 'Europe/London' },
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
