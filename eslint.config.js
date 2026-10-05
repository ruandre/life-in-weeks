import antfu from '@antfu/eslint-config'
import pluginSecurity from 'eslint-plugin-security'

export default antfu(
  {
    formatters: true,
    svelte: true,
  },
  pluginSecurity.configs.recommended,
)
