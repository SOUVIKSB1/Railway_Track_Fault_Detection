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
        railway: {
          darkest: '#050c1e',
          navy: '#0b1b3d',
          blue: '#132b61',
          accent: '#1e40af',
          lightBlue: '#3b82f6',
          saffron: '#f97316',
          gold: '#eab308',
          crimson: '#dc2626',
          emerald: '#10b981',
          slate: '#0f172a',
          surface: '#0f1f42',
          surfaceLight: '#192f60',
          border: 'rgba(59, 130, 246, 0.2)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        display: ['Rajdhani', 'Orbitron', 'Inter', 'sans-serif']
      },
      animation: {
        'scanline': 'scanline 2.5s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'radar': 'radar 3s linear infinite',
        'train-move': 'trainMove 20s linear infinite',
        'marquee': 'marquee 25s linear infinite'
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)', opacity: '0.8' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateY(1000%)', opacity: '0.2' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.05)' },
        },
        radar: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        trainMove: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      }
    },
  },
  plugins: [],
}
