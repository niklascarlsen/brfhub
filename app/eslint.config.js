const {defineConfig, globalIgnores} = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  globalIgnores(['dist/*']),
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    settings: {
      // expo-notifications' build writes each `export` after a comment on
      // the same line, which eslint-plugin-import takes for a script and
      // skips, so its namespace rule found no AndroidImportance. Expo's own
      // entry is kept.
      'import/ignore': [
        'node_modules[\\\\/]+@?react-native',
        'node_modules[\\\\/]+expo-notifications',
      ],
    },
  },
]);
