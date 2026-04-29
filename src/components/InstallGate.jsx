import { useEffect, useState } from 'react'
import { canInstall, onInstallAvailable, promptInstall, isStandalone } from '../lib/pwa'

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream
}

/**
 * InstallGate — bloquea el acceso a la app si no está instalada como PWA.
 * Muestra una pantalla de descarga con instrucciones para cada plataforma.
 */
export default function InstallGate({ children }) {
  const [installed, setInstalled] = useState(isStandalone())
  const [installable, setInstallable] = useState(canInstall())
  const [installing, setInstalling] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    if (installed) return
    // Escuchar si el usuario instala la app mientras está en la pantalla
    const unsub = onInstallAvailable(setInstallable)
    const onInstalled = () => setInstalled(true)
    window.addEventListener('appinstalled', onInstalled)

    // También detectar si cambia el display-mode (el browser puede actualizar esto)
    const mq = window.matchMedia?.('(display-mode: standalone)')
    const mqWco = window.matchMedia?.('(display-mode: window-controls-overlay)')
    const check = () => { if (isStandalone()) setInstalled(true) }
    mq?.addEventListener('change', check)
    mqWco?.addEventListener('change', check)

    return () => {
      unsub()
      window.removeEventListener('appinstalled', onInstalled)
      mq?.removeEventListener('change', check)
      mqWco?.removeEventListener('change', check)
    }
  }, [installed])

  if (installed) return children

  const ios = isIOS()

  async function handleInstall() {
    if (ios) { setShowIosHint(true); return }
    setInstalling(true)
    const result = await promptInstall()
    if (result.outcome === 'accepted') setInstalled(true)
    setInstalling(false)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">

        {/* Ícono */}
        <img
          src="/icons/icon-512.png?v=4"
          alt="Focus"
          width={88}
          height={88}
          className="rounded-[22px] shadow-2xl shadow-blue-900/50"
        />

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-headline">Focus</h1>
          <p className="mt-2 text-slate-400 text-[15px] leading-snug">
            Tu calendario con IA. Instala la app para acceder a todas las funciones.
          </p>
        </div>

        {/* Beneficios */}
        <div className="w-full grid grid-cols-3 gap-3">
          {[
            { icon: 'bolt', label: 'Más rápida' },
            { icon: 'cloud_done', label: 'Sin internet' },
            { icon: 'notifications', label: 'Notificaciones' },
          ].map(({ icon, label }) => (
            <div key={icon} className="flex flex-col items-center gap-2 bg-slate-900 rounded-2xl py-4 px-2">
              <span className="material-symbols-outlined text-blue-400 text-[22px]">{icon}</span>
              <span className="text-[11px] text-slate-400 leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {/* Botón de instalar */}
        {!ios && (
          <button
            onClick={handleInstall}
            disabled={!installable || installing}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold text-[15px] shadow-lg shadow-blue-900/40"
          >
            {installing ? 'Instalando…' : installable ? 'Instalar Focus' : 'Abre este enlace en Chrome o Edge para instalar'}
          </button>
        )}

        {ios && (
          <button
            onClick={handleInstall}
            className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all font-bold text-[15px] shadow-lg shadow-blue-900/40"
          >
            Cómo instalar en iPhone
          </button>
        )}

        {/* Instrucciones iOS */}
        {showIosHint && ios && (
          <div className="w-full bg-slate-900 rounded-2xl p-4 text-left text-sm text-slate-300 space-y-2">
            <p className="font-semibold text-white">Para instalar en iPhone / iPad:</p>
            <p>1. Toca el ícono <span className="inline-block align-middle">⬆️</span> <strong>Compartir</strong> en la barra de Safari</p>
            <p>2. Desplázate y toca <strong>"Añadir a pantalla de inicio"</strong></p>
            <p>3. Toca <strong>Agregar</strong> — ¡listo!</p>
          </div>
        )}

        {/* Instrucciones para otros browsers */}
        {!ios && !installable && (
          <p className="text-xs text-slate-500 leading-relaxed">
            Para instalar: abre esta página en <strong className="text-slate-400">Chrome</strong> o <strong className="text-slate-400">Edge</strong> y busca el ícono de instalar en la barra de dirección.
          </p>
        )}
      </div>
    </div>
  )
}
