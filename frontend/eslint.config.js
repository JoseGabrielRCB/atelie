import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Regra de dev (fast refresh): nossos contextos exportam o provider junto
      // do hook (useAuth/useCarrinho). Mantemos como aviso, não erro.
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    // Arquivos de configuração rodam em Node (process, etc.).
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
])
