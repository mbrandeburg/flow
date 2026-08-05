/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{tsx,ts}', './node_modules/@literal-ui/core/**/*.js'],
  theme: {
    extend: {},
  },
  plugins: [require('@flow/tailwind')],
}
