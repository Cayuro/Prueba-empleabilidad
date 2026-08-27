/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // High-contrast Orange & Black custom palette
        dark: {
          bg: '#0B0B0B',
          card: '#161616',
          accent: '#FF7A20',
          accentHover: '#E65F00',
          text: '#F5F5F5',
          muted: '#A0A0A0',
          border: '#2C2C2C',
        },
        light: {
          bg: '#F9F9F9',
          card: '#FFFFFF',
          accent: '#E65F00',
          accentHover: '#CC5400',
          text: '#0B0B0B',
          muted: '#555555',
          border: '#E5E5E5',
        }
      }
    },
  },
  plugins: [],
}
