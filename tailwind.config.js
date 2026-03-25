/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── PrecificaTur Brand Colors ──
        // From MIV (Manual de Identidade Visual)
        brand: {
          // Azul escuro principal - confiança, profissionalismo
          navy: {
            DEFAULT: '#203478',
            50: '#E8EAF2',
            100: '#C5C9E0',
            200: '#9EA5CB',
            300: '#7780B6',
            400: '#5A63A6',
            500: '#3D4796',
            600: '#203478',
            700: '#1A2A62',
            800: '#14204B',
            900: '#0E1635',
          },
          // Azul médio - elementos secundários
          blue: {
            DEFAULT: '#557ABC',
            50: '#EDF2F9',
            100: '#D2DFEF',
            200: '#AABFDE',
            300: '#83A0CE',
            400: '#557ABC',
            500: '#3D64A8',
            600: '#2F4D83',
            700: '#233B65',
            800: '#182947',
            900: '#0E1829',
          },
          // Laranja principal - energia, destaque, CTAs
          orange: {
            DEFAULT: '#EC6907',
            50: '#FEF3E8',
            100: '#FDDFC5',
            200: '#F9C08A',
            300: '#F5A04F',
            400: '#EC6907',
            500: '#D05D06',
            600: '#A94C05',
            700: '#823A04',
            800: '#5B2903',
            900: '#351801',
          },
          // Laranja claro - apoio
          tangerine: {
            DEFAULT: '#F28B32',
            50: '#FEF5EC',
            100: '#FDE6D0',
            200: '#FAC998',
            300: '#F28B32',
            400: '#E07520',
            500: '#C46518',
            600: '#9D5013',
            700: '#763C0E',
            800: '#4F2809',
            900: '#281404',
          },
          // Amarelo - acentos e alertas
          gold: {
            DEFAULT: '#FEC82F',
            50: '#FFFAEA',
            100: '#FFF0C5',
            200: '#FEE08A',
            300: '#FEC82F',
            400: '#E5B329',
            500: '#CC9F24',
            600: '#9F7C1C',
            700: '#725914',
            800: '#46370C',
            900: '#231C06',
          },
        },
        // ── Semantic aliases ──
        primary: {
          DEFAULT: '#203478',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#557ABC',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#EC6907',
          foreground: '#FFFFFF',
        },
        // ── Neutral grays ──
        surface: {
          DEFAULT: '#F8F9FC',
          50: '#FFFFFF',
          100: '#F8F9FC',
          200: '#F0F2F7',
          300: '#E4E7EF',
          400: '#C8CDD9',
          500: '#9BA3B5',
          600: '#6B7489',
          700: '#4A5168',
          800: '#2D3348',
          900: '#1A1E2E',
        },
      },
      fontFamily: {
        // New Atten Round (brand font) with Nunito as web fallback
        display: ['"Nunito"', 'system-ui', 'sans-serif'],
        body: ['"Nunito"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'card': '0 1px 3px rgba(32, 52, 120, 0.06), 0 4px 12px rgba(32, 52, 120, 0.04)',
        'card-hover': '0 2px 6px rgba(32, 52, 120, 0.08), 0 8px 24px rgba(32, 52, 120, 0.06)',
        'elevated': '0 4px 12px rgba(32, 52, 120, 0.08), 0 16px 48px rgba(32, 52, 120, 0.06)',
        'button': '0 1px 2px rgba(236, 105, 7, 0.2), 0 4px 8px rgba(236, 105, 7, 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
