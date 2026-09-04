import { mount } from 'svelte'
import App from './App.svelte'
import '@fontsource/open-sans/latin-400.css'
import '@fontsource/open-sans/latin-500.css'

import '@fontsource/open-sans/latin-700.css'
import './styles/styles.css'

window.addEventListener('error', (event) => {
  if (typeof event.message === 'string' && event.message.includes('ResizeObserver loop'))
    return
  console.error('[global error]', event.error ?? event.message)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandled rejection]', event.reason)
})

const target = document.getElementById('app')
if (!target) {
  throw new Error('Target container #app not found')
}

const app = mount(App, { target })

export default app
