/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        ink: '#0A0A0F',
        paper: '#F5F0E8',
        accent: '#FF5C00',
        muted: '#8A8A8A',
        surface: '#141418',
      }
    }
  },
  plugins: []
}
