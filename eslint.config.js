import antfu from '@antfu/eslint-config'
import pluginSecurity from 'eslint-plugin-security'

export default antfu(
  {
    formatters: true,
    // aube (not pnpm) owns pnpm-workspace.yaml; its settings differ from pnpm's
    pnpm: false,
    svelte: true,
  },
  pluginSecurity.configs.recommended,
)
