import { Platform } from 'react-native';

// Paleta Focus — alineada con la app web (tailwind.config.js).
// Primary indigo `#5b5ef5` es el azul Nova oficial.
// Todo cambio acá debería reflejar también la web.

const primary = '#5b5ef5';            // Nova indigo (acción principal)
const primaryDark = '#4548d4';        // Nova indigo presionado
const primaryContainer = '#e0e7ff';   // Surface tinted indigo (bubbles)
const primarySoft = '#eef0ff';        // Surface light tinted

export const Colors = {
  light: {
    // Texto
    text: '#0f172a',
    textMuted: '#64748b',
    textSubtle: '#94a3b8',

    // Surfaces
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    surfaceTint: primarySoft,

    // Bordes / dividers
    border: '#e2e8f0',
    borderStrong: '#cbd5e1',

    // Acción
    primary,
    primaryPressed: primaryDark,
    primaryContainer,
    onPrimary: '#ffffff',

    // Semánticos
    success: '#16a34a',
    warning: '#f59e0b',
    danger: '#dc2626',

    // Tab bar
    tint: '#0f172a',
    icon: '#64748b',
    tabIconDefault: '#94a3b8',
    tabIconSelected: primary,

    // Compat (algunos componentes viejos lo usaban)
    accent: primary,
  },
  dark: {
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    textSubtle: '#64748b',

    background: '#06080f',
    surface: '#0f172a',
    surfaceMuted: '#1e293b',
    surfaceTint: '#1e1b4b', // indigo deep

    border: '#1e293b',
    borderStrong: '#334155',

    primary: '#7c83ff',          // versión más luminosa para dark
    primaryPressed: '#5b5ef5',
    primaryContainer: '#312e81',
    onPrimary: '#ffffff',

    success: '#22c55e',
    warning: '#fbbf24',
    danger: '#ef4444',

    tint: '#f8fafc',
    icon: '#94a3b8',
    tabIconDefault: '#475569',
    tabIconSelected: '#7c83ff',

    accent: '#7c83ff',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// Spacing tokens — usar en lieu de números mágicos
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
};

// Tipografía: tamaños iOS-friendly
export const Typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '700' as const, letterSpacing: -0.5 },
  title1:  { fontSize: 24, lineHeight: 30, fontWeight: '700' as const, letterSpacing: -0.3 },
  title2:  { fontSize: 20, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.2 },
  title3:  { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body:    { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  micro:   { fontSize: 11, lineHeight: 14, fontWeight: '500' as const, letterSpacing: 0.3 },
};

// Radii
export const Radius = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  '2xl': 22,
  full: 999,
};
