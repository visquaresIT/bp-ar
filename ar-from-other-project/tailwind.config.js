/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#00b6e7',
        accent: '#a5d756',
      },
    },
  },
  plugins: [],
}
