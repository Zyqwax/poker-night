/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        poker: {
          dark: '#110D12',
          card: '#1A141D',
          border: '#2A1F2F',
          table: '#36151E',
          tableBorder: '#4F212C',
          gold: '#D6A653',
          goldHover: '#E5BA6A',
          goldMuted: '#9B7735',
          wine: '#441B24',
          wineHover: '#57222E',
          teal: '#1E4745',
          tealHover: '#285D5A',
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
