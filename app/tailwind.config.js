const theme = require('./src/theme.json');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        theme,
      },
      fontFamily: {
        sans: ['Merriweather_400Regular'],
      },
    },
  },
  plugins: [],
};
