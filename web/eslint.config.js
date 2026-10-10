import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {ignores: ['dist', 'src/generated']},
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  reactRefresh.configs.vite,
  {
    rules: {
      'react-refresh/only-export-components': [
        'error',
        {
          allowExportNames: [
            'useConfig',
            'useDialog',
            'useMessages',
            'useLocale',
          ],
        },
      ],
    },
  },
  prettierRecommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
    },
  },
);
