import { useState, useEffect } from 'react'
import { canInstall, onInstallAvailable, promptInstall, isStandalone } from '../lib/pwa'

/**
 * Botón de instalar que aparece en la TopAppBar cuando la app
 * no está instalada y el browser soporta beforeinstallprompt.
 */
export default function InstallButton() {
  const [visible, setVisible] = useState(() => !isStandalone() && canInstall())

  useEffect(() => {
    if (isStandalone()) return
    const unsub = onInstallAvailable((available) => setVisible(available))
    window.addEventListener('appinstalled', () => setVisible(false))
    return unsub
  }, [])

  if (!visible) return null

  async function handleInstall() {
    const result = await promptInstall()
    if (result.outcome === 'accepted') setVisible(false)
  }

  return (
    <button
      onClick={handleInstall}
      className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-[13px] font-semibold hover:bg-primary/90 active:scale-95 transition-all"
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      <span className="material-symbols-outlined text-[16px]">download</span>
      Instalar app
    </button>
  )
}
