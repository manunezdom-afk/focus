/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Focus Nova violet — reemplaza el blue de Material Design.
        // Todos los text-blue-xxx / bg-blue-xxx pasan a violeta sin tocar componentes.
        blue: {
          50:  '#f0eeff',
          100: '#e1dcff',
          200: '#c5baff',
          300: '#a996ff',
          400: '#9077ff',
          500: '#8268ff',
          600: '#7c6bff',  // anchor: Focus Nova
          700: '#6351e6',
          800: '#4a3bcc',
          900: '#352b99',
          950: '#1f1860',
        },

        // ── Semantic / brand tokens ──────────────────────────────────────
        'primary':           '#7c6bff',  // Nova violet (era #0058bc Material blue)
        'primary-container': '#e1dcff',
        'on-primary':        '#ffffff',
        'on-primary-fixed':  '#1a0060',

        'secondary':           '#6b64e8',
        'secondary-container': '#e2dfff',
        'on-secondary':        '#ffffff',

        'nova':      '#7c6bff',
        'nova-soft': '#e1dcff',
        'nova-mid':  '#a899ff',

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
        'grad-1': '#7c6bff',
        'grad-2': '#9b59ff',
        'grad-3': '#c46fff',
        'grad-4': '#ff8fb1',
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
