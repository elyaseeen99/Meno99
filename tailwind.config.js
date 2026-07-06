/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "Blueprint-grid" industrial palette used across all Meno screens
        graphite: '#111827',
        steel: '#1e293b',
        'safety-amber': '#f59e0b',
        'safety-red': '#ef4444',
      },
    },
  },
  plugins: [],
};
