import { Platform } from 'react-native';

// Paleta Focus — espejada de tailwind.config.js de la app web para que la app
// mobile se sienta de la misma familia visual sin acoplarse al CSS web.
// Si cambia la paleta de la web, actualizar también acá.
const tintColorLight = '#0f172a';
const tintColorDark = '#f8fafc';

export const Colors = {
  light: {
    text: '#0f172a',
    textMuted: '#475569',
    background: '#f8fafc',
    surface: '#ffffff',
    border: '#e2e8f0',
    tint: tintColorLight,
    icon: '#64748b',
    tabIconDefault: '#94a3b8',
    tabIconSelected: tintColorLight,
    accent: '#6366f1',
    danger: '#dc2626',
  },
  dark: {
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    background: '#06080f',
    surface: '#0f172a',
    border: '#1e293b',
    tint: tintColorDark,
    icon: '#94a3b8',
    tabIconDefault: '#475569',
    tabIconSelected: tintColorDark,
    accent: '#818cf8',
    danger: '#ef4444',
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
