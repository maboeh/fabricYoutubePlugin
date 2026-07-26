import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'safari-app/**',
      'node_modules/**',
      'generate-icons.cjs',
      '.worktrees/**'
    ]
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        chrome: 'readonly',
        browser: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  },
  {
    files: ['tests/unit/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest
      }
    }
  },
  {
    files: ['tests/e2e/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser
      }
    }
  }
];
