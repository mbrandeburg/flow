import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier'

const eslintConfig = [
  {
    ignores: [
      '**/.next/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/.turbo/**',
      'packages/epubjs/**',
      'apps/reader/public/**',
      'apps/reader/service-worker/**',
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'import/no-anonymous-default-export': 'off',
      'no-empty': 'off',
      // The new React Compiler rules (eslint-plugin-react-hooks v6) assume an
      // immutable model that conflicts with this app's valtio mutable proxies;
      // the classic react-hooks/rules-of-hooks + exhaustive-deps stay on.
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'import/order': [
        'error',
        {
          alphabetize: { order: 'asc' },
          'newlines-between': 'always',
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          pathGroups: [{ pattern: '@flow/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
      // Kept from the previous per-app overrides:
      '@next/next/no-html-link-for-pages': 'off',
      '@next/next/no-img-element': 'off',
      'react/jsx-key': 'off',
      'react/no-children-prop': 'off',
    },
  },
]

export default eslintConfig
