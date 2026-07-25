/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/{App,main,ProtectedRoute,router,supabaseClient}.{js,jsx,ts,tsx}",
    "./src/assets/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/context/**/*.{js,jsx,ts,tsx}",
    "./src/hooks/**/*.{js,jsx,ts,tsx}",
    "./src/utils/**/*.{js,jsx,ts,tsx}",
    "!./src/scraper/**"
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
