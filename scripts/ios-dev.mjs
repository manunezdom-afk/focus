#!/usr/bin/env node
/**
 * ios-dev.mjs — Live reload para desarrollo iOS con Capacitor.
 *
 * Lo que hace:
 *  1. Detecta la IP local del Mac (para dispositivo físico) o usa localhost (simulador).
 *  2. Inyecta server.url en capacitor.config.json apuntando al servidor Vite.
 *  3. Corre `npx cap sync ios` para que Xcode cargue desde el dev server.
 *  4. Arranca `vite --host` (HMR activo).
 *  5. Al terminar (Ctrl+C), restaura capacitor.config.json.
 *
 * Uso:
 *   npm run ios:dev          → simulador (localhost)
 *   npm run ios:dev:device   → dispositivo físico (IP local de tu Mac)
 */

import { execSync, spawn } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { networkInterfaces } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CONFIG_PATH = resolve(ROOT, 'capacitor.config.json')

const useDevice = process.argv.includes('--device')

// Detectar IP local para dispositivo físico
function getLocalIP() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return 'localhost'
}

const host = useDevice ? getLocalIP() : 'localhost'
const port = 5173
const serverUrl = `http://${host}:${port}`

// Leer config original
const originalConfig = readFileSync(CONFIG_PATH, 'utf8')
const config = JSON.parse(originalConfig)

// Inyectar server.url
config.server = { ...config.server, url: serverUrl, cleartext: true }

function restore() {
  try {
    writeFileSync(CONFIG_PATH, originalConfig)
    console.log('\n✓ capacitor.config.json restaurado.')
  } catch {}
}

process.on('SIGINT', () => { restore(); process.exit(0) })
process.on('SIGTERM', () => { restore(); process.exit(0) })
process.on('exit', restore)

try {
  // Escribir config con server.url
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  console.log(`\n→ Live reload activado: ${serverUrl}`)

  // Sincronizar con iOS
  console.log('→ Sincronizando con Xcode...')
  execSync('npx cap sync ios', { cwd: ROOT, stdio: 'inherit' })

  console.log('\n✓ Listo. Presiona ▶ en Xcode para correr la app.')
  console.log('  Los cambios en el código aparecerán automáticamente.\n')

  // Arrancar Vite dev server con HMR
  const vite = spawn('npx', ['vite', '--host', '--port', String(port)], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
  })

  vite.on('close', () => { restore(); process.exit(0) })
} catch (err) {
  console.error('Error:', err.message)
  restore()
  process.exit(1)
}
