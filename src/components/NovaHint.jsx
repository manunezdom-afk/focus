import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { subscribeModalStack } from '../utils/modalStack'

const HINT_KEY_PREFIX = 'focus_hint_'

function wasShown(id) {
  try { return localStorage.getItem(HINT_KEY_PREFIX + id) === '1' } catch { return false }
}

function markShown(id) {
  try { localStorage.setItem(HINT_KEY_PREFIX + id, '1') } catch {}
}

/**
 * NovaHint — tip contextual del asistente.
 *
 * Aparece una sola vez por navegador (persistido en localStorage). Diseño
 * sobrio: una tarjeta clara y discreta anclada arriba de la barra inferior
 * en cualquier dispositivo. No tapa títulos ni la composer; convive con el
 * planner sin robar foco. El usuario puede descartar con tap en la X o con
 * el botón secundario.
 */
export default function NovaHint({
  id,
  children,
  trigger = true,
  delayMs = 800,
  onDismiss,
  actionLabel,
  onAction,
  // Cuando InstallAppCard está visible (planner mobile, sesión 3+), ambos
  // viven en el mismo bottom y se solapan. Con `liftAboveInstallCard` el
  // hint se desplaza ~9rem arriba para dejar la card visible y leerse claro.
  liftAboveInstallCard = false,
}) {
  const [visible, setVisible] = useState(false)
  // En mobile, los hints viven en z-56 — entre el bottom nav y la Nova pill.
  // Si se abre cualquier modal (auth, notifs, paleta, sheets) el hint queda
  // flotando detrás del backdrop sin contexto. Suscribirse al modalStack y
  // ocultarlo cuando hay algo encima limpia ese ruido visual.
  const [modalCount, setModalCount] = useState(0)
  useEffect(() => subscribeModalStack(setModalCount), [])

  useEffect(() => {
    if (!trigger) return
    if (wasShown(id)) return
    const t = setTimeout(() => setVisible(true), delayMs)
    return () => clearTimeout(t)
  }, [id, trigger, delayMs])

  // Auto-dismiss a los 12s. Una vez descartado no vuelve — el copy es
  // orientativo, no crítico.
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => dismiss(), 12000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  function dismiss() {
    markShown(id)
    setVisible(false)
    onDismiss?.()
  }

  function handleAction() {
    onAction?.()
    dismiss()
  }

  const shouldRender = visible && modalCount === 0

  return (
    <AnimatePresence>
      {shouldRender && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 z-[56] flex justify-center pointer-events-none px-4"
          style={{
            // Anclado arriba de la barra inferior. ~6.5rem la deja visible sin
            // pisar el nav (que ronda los 5rem incluyendo safe-area). En
            // desktop la barra es la misma altura, así que la posición vale.
            // Si InstallAppCard está visible (~104px alto incluyendo offset
            // y márgenes), elevamos a ~15.5rem para no superponer.
            bottom: liftAboveInstallCard
              ? 'calc(env(safe-area-inset-bottom, 0px) + 15.5rem)'
              : 'calc(env(safe-area-inset-bottom, 0px) + 6.5rem)',
          }}
        >
          <div
            className="pointer-events-auto w-full max-w-[440px] rounded-2xl border bg-white/95 text-slate-800 shadow-[0_12px_32px_rgba(15,23,42,0.10)]"
            style={{
              borderColor: 'rgba(15, 23, 42, 0.08)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-start gap-3 px-4 py-3 pr-2">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
                style={{ background: 'var(--nova)' }}
              />
              <p
                className="flex-1 text-[13.5px] leading-snug text-slate-700"
                style={{ letterSpacing: '-0.005em' }}
              >
                {children}
              </p>
              <button
                onClick={dismiss}
                aria-label="Descartar"
                className="-mt-0.5 -mr-1 h-7 w-7 flex-shrink-0 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-90 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>

            <div className="flex items-center justify-end gap-1 px-3 pb-2">
              <button
                onClick={dismiss}
                className="rounded-full px-3 py-1 text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors min-h-[28px]"
              >
                Entendido
              </button>
              {actionLabel && (
                <button
                  onClick={handleAction}
                  className="rounded-full px-3 py-1 text-[12px] font-semibold text-white transition-transform active:scale-95 min-h-[28px]"
                  style={{ background: 'var(--nova)' }}
                >
                  {actionLabel}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function resetHint(id) {
  try { localStorage.removeItem(HINT_KEY_PREFIX + id) } catch {}
}
