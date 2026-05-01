/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Focus Nova indigo-azul — reemplaza el blue de Material Design.
        // Palette más azul que el violeta anterior (#7c6bff → #6366f1).
        // Todos los text-blue-xxx / bg-blue-xxx pasan a índigo sin tocar componentes.
        blue: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#5b5ef5',  // anchor: Focus Nova azul-índigo
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },

        // ── Semantic / brand tokens ──────────────────────────────────────
        'primary':           '#5b5ef5',  // Nova azul-índigo
        'primary-container': '#e0e7ff',
        'on-primary':        '#ffffff',
        'on-primary-fixed':  '#1a006b',

        'secondary':           '#6366f1',
        'secondary-container': '#e0e7ff',
        'on-secondary':        '#ffffff',

        'nova':      '#6366f1',
        'nova-soft': '#e0e7ff',
        'nova-mid':  '#a5b4fc',

        // ── Surfaces (ecosystem: papel violeta-frío) ─────────────────────
        'background': '#fafafd',
        'surface':    '#ffffff',
        'surface-bright':    '#fafafd',
        'surface-container': '#f2f0fa',
        'surface-container-low':    '#f7f5fc',
        'surface-container-high':   '#ebe8f5',
        'surface-container-highest':'#e4e1f0',
        'surface-variant': '#e8e5f2',
        'surface-dim':     '#dcdaeb',
        'surface-tint':    '#7c6bff',

        // ── Text / on-surface ────────────────────────────────────────────
        'on-surface':         '#100525',
        'on-surface-variant': '#38255c',
        'on-background':      '#100525',
        'outline':            '#7a6fa8',
        'outline-variant':    '#c9c4dd',
        'inverse-surface':    '#252030',
        'inverse-on-surface': '#f2efff',
        'inverse-primary':    '#c5baff',

        // ── States ───────────────────────────────────────────────────────
        'error':              '#ba1a1a',
        'error-container':    '#ffdad6',
        'on-error':           '#ffffff',
        'on-error-container': '#93000a',

        // ── Brand gradient stops ─────────────────────────────────────────
        'grad-1': '#5b5ef5',
        'grad-2': '#6366f1',
        'grad-3': '#a78bfa',
        'grad-4': '#c084fc',
      },

      transitionTimingFunction: {
        focus:  'cubic-bezier(0.22, 1, 0.36, 1)',
        spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
      },

      borderRadius: {
        DEFAULT: '0.25rem',
        lg:  '1rem',
        xl:  '1.5rem',
        '2xl': '1.5rem',
        '3xl': '1.5rem',
        full: '9999px',
      },

      fontFamily: {
        // Plus Jakarta Sans — misma tipografía que Kairos y Spark.
        // Fallbacks system para que la app funcione mientras carga la fuente.
        headline: ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        body:     ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        label:    ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        nova:     ['"Plus Jakarta Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        mono:     ['"JetBrains Mono"', 'ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
      },

      spacing: {
        'safe-top':    'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left':   'env(safe-area-inset-left, 0px)',
        'safe-right':  'env(safe-area-inset-right, 0px)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.pt-safe':       { paddingTop:    'env(safe-area-inset-top, 0px)' },
        '.pb-safe':       { paddingBottom: 'env(safe-area-inset-bottom, 0px)' },
        '.pl-safe':       { paddingLeft:   'env(safe-area-inset-left, 0px)' },
        '.pr-safe':       { paddingRight:  'env(safe-area-inset-right, 0px)' },
        '.mt-safe':       { marginTop:     'env(safe-area-inset-top, 0px)' },
        '.mb-safe':       { marginBottom:  'env(safe-area-inset-bottom, 0px)' },
        '.top-safe':      { top:           'env(safe-area-inset-top, 0px)' },
        '.bottom-safe':   { bottom:        'env(safe-area-inset-bottom, 0px)' },
        '.h-safe-bottom': { height:        'env(safe-area-inset-bottom, 0px)' },
      })
    },
  ],
}
