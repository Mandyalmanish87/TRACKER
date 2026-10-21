/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        jb: ['"Syne"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Syne"', '"Space Grotesk"', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Menlo', 'monospace'],
      },
      colors: {
        jb: {
          yellow: '#FFE600',
          yellowShade: '#E5CF00',
          blue: '#2B38FF',
          blueShade: '#1F2BBF',
          pink: '#FF3B81',
          cream: '#F8F6F0',
          creamShade: '#EDE9DF',
          black: '#111111',
          darkSurface: '#161618',
        },
        ivory: {
          50: '#FDFCF9',
          100: '#FAF7F2',
          200: '#F3EFE8',
          300: '#EAE4D9',
          400: '#DDD5C6',
          500: '#C8BCAC',
        },
        espresso: {
          950: '#0F0D0C',
          900: '#141210',
          850: '#1A1715',
          800: '#231F1D',
          700: '#322C28',
          600: '#4D453F',
          500: '#6E645C',
          400: '#948A80',
          300: '#B8AEA4',
        },
        terracotta: {
          50: '#FDF4F0',
          100: '#FBF0EA',
          200: '#F5DCD1',
          300: '#EDBFA8',
          400: '#DE8E6E',
          500: '#C45532',
          600: '#B24424',
          700: '#94351A',
        },
        sage: {
          50: '#F2F7F4',
          100: '#E4EFE8',
          200: '#C8DECF',
          500: '#436650',
          600: '#365341',
          700: '#2A4133',
        },
        ochre: {
          50: '#FDF9F2',
          100: '#FAF2E4',
          500: '#B8732E',
          600: '#9A5D20',
        }
      },
      boxShadow: {
        'subtle': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'editorial': '0 4px 20px -2px rgba(28, 25, 23, 0.05)',
        'editorial-dark': '0 4px 20px -2px rgba(0, 0, 0, 0.35)',
      }
    },
  },
  plugins: [],
}
