/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // ── Focus Nova royal blue — reemplaza el indigo previo.
        // Tailwind blue scale estándar. Anchor: blue.600 = #2563eb (royal).
        blue: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',  // anchor: Focus Nova royal blue
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },

        // ── Semantic / brand tokens ──────────────────────────────────────
        'primary':           '#2563eb',  // Nova royal blue
        'primary-container': '#dbeafe',
        'on-primary':        '#ffffff',
        'on-primary-fixed':  '#0c1c4d',

        'secondary':           '#3b82f6',
        'secondary-container': '#dbeafe',
        'on-secondary':        '#ffffff',

        'nova':      '#3b82f6',
        'nova-soft': '#dbeafe',
        'nova-mid':  '#93c5fd',

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

        // ── Brand gradient stops (cyan → cobalt) ────────────────────────
        'grad-1': '#2563eb',  // royal blue
        'grad-2': '#3b82f6',  // blue 500
        'grad-3': '#60a5fa',  // blue 400
        'grad-4': '#22d3ee',  // cyan 400
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
        // Stack del sistema (SF Pro en iOS/Mac, Segoe UI en Windows). Antes
        // forzábamos Plus Jakarta Sans desde Google Fonts, lo que bloqueaba
        // el primer paint en iOS WebView durante el cold start.
        headline: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        body:     ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        label:    ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        nova:     ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'Helvetica', 'Arial', 'sans-serif'],
        mono:     ['ui-monospace', '"SF Mono"', '"JetBrains Mono"', 'Menlo', 'Consolas', 'monospace'],
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
