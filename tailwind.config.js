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
        pos: {
          bg: '#0f172a',        // Slate 900
          card: '#1e293b',      // Slate 800
          border: '#334155',    // Slate 700
          muted: '#94a3b8',     // Slate 400
          accent: '#3b82f6',    // Blue 500
          success: '#10b981',   // Emerald 500
          warning: '#f59e0b',   // Amber 500
          danger: '#ef4444',    // Rose 500
          brand: '#6366f1',     // Indigo 500
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
