import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// Build stamp: SHA del commit + timestamp ISO. Se inyecta como constantes a
// través de `define` y se muestra en SettingsView para que QA pueda confirmar
// visualmente en Xcode/iPhone que está corriendo la build nueva (no una vieja
// cacheada por el WebView). En CI/Vercel usamos VERCEL_GIT_COMMIT_SHA.
function resolveBuildStamp() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
    || (() => {
      try {
        return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString().trim()
      } catch { return 'unknown' }
    })()
  return { commit: String(sha).slice(0, 7), time: new Date().toISOString() }
}
const { commit: BUILD_COMMIT, time: BUILD_TIME } = resolveBuildStamp()

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  build: {
    // Separar dependencies estables del código de la app. Ganancia clave en
    // cold start de PWA instalada / Safari: el vendor chunk se cachea para
    // siempre (mismo hash entre deploys mientras no cambien las versiones),
    // así que sólo se baja una vez. Antes todo vivía en index-*.js, y un
    // cambio de una línea en App.jsx invalidaba los 175 KB de vendors → 2 s
    // extra de red en cada deploy.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react') || id.includes('scheduler')) return 'vendor-react'
          if (id.includes('framer-motion')) return 'vendor-motion'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
})
