/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Deep, rich navy — the app's dark-mode canvas
        midnight: {
          50: '#eef2fb',
          100: '#dbe3f6',
          200: '#b0c0e8',
          300: '#7e94d3',
          400: '#4c66b3',
          500: '#2b4491',
          600: '#1c2f6e',
          700: '#152352',
          800: '#0f1a3d',
          900: '#0a1128',
          950: '#020617'
        },
        // Elegant gold/amber accent — buttons, focus rings, highlights
        gold: {
          50: '#fdf8ec',
          100: '#faedc7',
          200: '#f5db8f',
          300: '#f0c356',
          400: '#e8ab2e',
          500: '#d4972a', // primary accent
          600: '#b3791f',
          700: '#8f5c1b',
          800: '#754a1c',
          900: '#633e1c'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif']
      },
      boxShadow: {
        gold: '0 8px 30px -8px rgba(212, 151, 42, 0.35)',
        premium: '0 20px 50px -12px rgba(2, 6, 23, 0.35)'
      },
      keyframes: {
        'loader-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        'fade-in': {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' }
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: 0.6 },
          '80%, 100%': { transform: 'scale(1.6)', opacity: 0 }
        }
      },
      animation: {
        shimmer: 'loader-shimmer 2.2s ease-in-out infinite',
        'fade-in': 'fade-in 0.4s ease-out both',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite'
      }
    }
  },
  plugins: []
};
