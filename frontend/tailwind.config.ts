import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        mantle: {
          green: '#00DC82',
          dark: '#1A1A1A',
          darker: '#0B0B0B',
          light: '#2A2A2A',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mantle': 'linear-gradient(to right, #00DC82, rgba(0, 220, 130, 0.4))',
        'glass': 'linear-gradient(180deg, rgba(26, 26, 26, 0.4) 0%, rgba(11, 11, 11, 0.8) 100%)',
      },
      animation: {
        'glow': 'glow 3s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 10px rgba(0, 220, 130, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 220, 130, 0.6)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
