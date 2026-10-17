const {radius, theme} = require('./src/theme.ts');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        theme,
      },
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([name, px]) => [name, `${px}px`]),
      ),
      fontFamily: {
        sans: ['Merriweather_400Regular'],
      },
    },
  },
  plugins: [],
};
