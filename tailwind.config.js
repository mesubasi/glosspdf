/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./mobile/index.html",
    "./mobile/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        acrobat: {
          red: '#ed2224',
          darkRed: '#d31b1c',
          toolbar: '#f4f4f4',
          darkToolbar: '#2b2b2b',
          bg: '#525659',
          darkBg: '#1e1e1e',
          panel: '#ffffff',
          darkPanel: '#252526',
          border: '#e0e0e0',
          darkBorder: '#3e3e42'
        }
      }
    },
  },
  plugins: [],
}
