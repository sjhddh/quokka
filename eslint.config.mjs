import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  // Global ignores
  {
    ignores: ['**/dist/', '**/node_modules/', '**/.wxt/', '**/.output/', '**/coverage/', '**/*.d.ts'],
  },

  // Base JS recommended rules
  js.configs.recommended,

  // TypeScript strict rules (as warnings where they'd cause mass errors)
  ...tseslint.configs.strict,

  // Prettier compat — disables formatting rules that conflict
  eslintConfigPrettier,

  // Global rule overrides for all TS files
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    rules: {
      // Warn instead of error for things that would require mass refactoring
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-extraneous-class': 'off',
      '@typescript-eslint/no-invalid-void-type': 'warn',
      '@typescript-eslint/no-dynamic-delete': 'warn',
    },
  },

  // React hooks rules — only for the extension app
  {
    files: ['apps/extension/**/*.ts', 'apps/extension/**/*.tsx'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
)
