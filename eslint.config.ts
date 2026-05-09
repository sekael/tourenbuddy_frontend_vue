import antfu from '@antfu/eslint-config'

export default antfu({
  vue: true,
  typescript: true,
  formatters: true,
  ignores: [
    '.claude/**',
    'openspec/**',
    'public/**',
    'dist/**',
    'node_modules/**',
    'supabase/config.toml',
  ],
  rules: {
    'no-console': 'error',
  },
})
