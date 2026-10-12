import js from '@eslint/js';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const PLATFORM = 'Core never imports platform code; the clients pass it in.';

export default tseslint.config(
  {ignores: ['src/generated']},
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat['recommended-latest'],
  prettierRecommended,
  {
    rules: {
      // Core runs in plain Node and in both clients, so it never reaches
      // into a platform or a client.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {name: 'react-native', message: PLATFORM},
            {name: 'react-dom', message: PLATFORM},
            {name: 'expo', message: PLATFORM},
          ],
          patterns: [
            {
              group: [
                'react-native/*',
                'react-native-*',
                'react-dom/*',
                'expo/*',
                'expo-*',
                '@expo/*',
              ],
              message: PLATFORM,
            },
            {
              group: ['@/*', '**/app/**', '**/web/**'],
              message: 'Core never imports from a client.',
            },
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {argsIgnorePattern: '^_', varsIgnorePattern: '^_'},
      ],
    },
  },
);
