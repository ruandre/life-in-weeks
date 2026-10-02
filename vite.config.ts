/// <reference types="vitest/config" />
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [svelte()],
  base: './',
  test: {
    // DST zone exposes fixed-millisecond date arithmetic
    env: { TZ: 'Europe/London' },
  },
})
