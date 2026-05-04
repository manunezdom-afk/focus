import { useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import NovaOrb from './NovaOrb'

const ONBOARDING_KEY = 'focus_onboarding_completed_v1'
const WELCOME_KEY = 'focus_welcome_last'

export function hasCompletedOnboarding() {
  try { return localStorage.getItem(ONBOARDING_KEY) === '1' } catch { return false }
}

export function markOnboardingCompleted() {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1')
    // Marcar también el welcome del día para no encadenar dos pantallas oscuras.
    localStorage.setItem(WELCOME_KEY, new Date().toISOString().slice(0, 10))
    // Evitar que el hint genérico "soy Nova…" aparezca justo después — ya lo
    // explicamos en el tutorial. El hint accionable de día vacío sí aparece.
    localStorage.setItem('focus_hint_welcome-intro-v1', '1')
  } catch {}
}

export function resetOnboarding() {
  try {
    localStorage.removeItem(ONBOARDING_KEY)
    localStorage.removeItem(WELCOME_KEY)
    localStorage.removeItem('focus_hint_welcome-intro-v1')
  } catch {}
}

/**
 * Hook-gate para el onboarding.
 * Muestra si todavía no se completó. Una vez completado, no vuelve a aparecer.
 */
export function useOnboardingGate() {
  const [show, setShow] = useState(() => !hasCompletedOnboarding())

  const complete = useCallback(() => {
    markOnboardingCompleted()
    setShow(false)
  }, [])

  useEffect(() => {
    if (show) return
    try { document.documentElement.classList.remove('focus-dark-boot') } catch {}
  }, [show])

  return { show, complete }
}

// ── Ilustraciones — limpias, sin blur ni glow ────────────────────────────────

function SlideIllustrationHero() {
  return (
    <div className="flex h-[200px] w-full items-center justify-center">
      <NovaOrb size={104} ambient />
    </div>
  )
}

function EventRow({ time, title, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center gap-3 rounded-xl border px-3.5 py-2.5"
      style={{ background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}
    >
      <div style={{ width: 3, height: 26, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div className="flex-1 min-w-0">
        <div className="text-[10.5px] font-medium text-white/40">{time}</div>
        <div className="truncate text-[13px] font-semibold text-white/88">{title}</div>
      </div>
    </motion.div>
  )
}

function SlideIllustrationPlanner() {
  return (
    <div className="flex h-[200px] w-full items-center justify-center px-4">
      <div className="w-full max-w-[300px] space-y-2">
        <EventRow time="09:00" title="Revisar informe Q2"    color="#7c6bff" delay={0.05} />
        <EventRow time="11:30" title="Reunión con Ana"       color="#3b82f6" delay={0.15} />
        <EventRow time="14:00" title="Enviar propuesta"      color="#ec4899" delay={0.25} />
      </div>
    </div>
  )
}

function SlideIllustrationNova() {
  return (
    <div className="flex h-[200px] w-full items-center justify-center gap-4 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="flex-shrink-0"
      >
        <NovaOrb size={72} pulse ambient />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-[190px] rounded-2xl rounded-tl-sm border px-3.5 py-3"
        style={{ background: 'rgba(255,255,255,0.07)', borderColor: 'rgba(124,107,255,0.25)' }}
      >
        <p className="text-[12.5px] leading-snug text-white/85">
          "Reunión con Ana" pisa el evento de las 11:30. ¿La muevo a las 15?
        </p>
        <div className="mt-2.5 flex gap-2">
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
            style={{ background: 'var(--nova)' }}
          >
            Mover
          </span>
          <span
            className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-white/50"
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          >
            Descartar
          </span>
        </div>
      </motion.div>
    </div>
  )
}

// ── Slides — 3 en total ──────────────────────────────────────────────────────

const SLIDES = [
  {
    id: 'hero',
    illustration: <SlideIllustrationHero />,
    eyebrow: 'Bienvenido a Focus',
    title: 'Tu día. Con IA a tu lado.',
    body: 'Organiza eventos y tareas en un solo lugar. Nova te ayuda a armarlo en segundos.',
  },
  {
    id: 'planner',
    illustration: <SlideIllustrationPlanner />,
    eyebrow: 'Tu agenda',
    title: 'Todo en una vista limpia.',
    body: 'Eventos y tareas juntos en la misma línea de tiempo. Sin apps aparte.',
  },
  {
    id: 'nova',
    illustration: <SlideIllustrationNova />,
    eyebrow: 'Nova',
    title: 'Actúa rápido. Tú mandas.',
    body: 'Nova crea, mueve y organiza. Cada cambio tiene un "Deshacer" y tú siempre confirmas.',
    cta: 'Empezar',
  },
]

// ── Componente principal ────────────────────────────────────────────────────

export default function FirstLaunchOnboarding({ onDone }) {
  const [index, setIndex] = useState(0)
  const [leaving, setLeaving] = useState(false)
  // `firstMount` se pone false tras el primer render. Lo usamos para que
  // el slide inicial aparezca ya visible (sin el fade de 420 ms), que en
  // iPhone hacía ver una pantalla negra intermedia entre el splash y el
  // tutorial como si hubiera dos cargas seguidas.
  const [firstMount, setFirstMount] = useState(true)
  useEffect(() => { setFirstMount(false) }, [])
  const total = SLIDES.length
  const slide = SLIDES[index]
  const isLast = index === total - 1

  const finish = useCallback(() => {
    if (leaving) return
    // Liberamos el dark-boot al arrancar el fade: mientras el overlay se
    // vuelve transparente, el body de abajo ya pintó el color claro de la
    // app. El resultado es una transición oscuro→claro continua, sin corte.
    try { document.documentElement.classList.remove('focus-dark-boot') } catch {}
    setLeaving(true)
    setTimeout(() => {
      onDone?.()
    }, 360)
  }, [leaving, onDone])

  const next = useCallback(() => {
    if (leaving) return
    if (isLast) { finish(); return }
    setIndex((i) => Math.min(i + 1, total - 1))
  }, [isLast, leaving, finish, total])

  const prev = useCallback(() => {
    if (leaving) return
    setIndex((i) => Math.max(i - 1, 0))
  }, [leaving])

  // Teclado: Enter / Space / flechas avanzan; Esc salta.
  useEffect(() => {
    function onKey(e) {
      if (e.defaultPrevented) return
      if (e.key === 'Escape') { finish(); return }
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, finish])

  // Swipe en móvil.
  const dragHandlers = useMemo(() => ({
    drag: 'x',
    dragConstraints: { left: 0, right: 0 },
    dragElastic: 0.18,
    onDragEnd: (_, info) => {
      const dx = info.offset.x
      if (dx < -60) next()
      else if (dx > 60) prev()
    },
  }), [next, prev])

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[120] flex flex-col"
      style={{
        background: 'radial-gradient(ellipse at 50% 38%, #0e1a36 0%, #06080f 70%)',
        color: 'rgba(255,255,255,0.92)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a Focus"
    >

      {/* Top bar: progress + skip */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {SLIDES.map((s, i) => (
            <div
              key={s.id}
              className="h-[3px] rounded-full transition-all duration-500"
              style={{
                width: i === index ? 28 : 14,
                background: i <= index ? 'rgba(124,107,255,0.95)' : 'rgba(255,255,255,0.16)',
              }}
            />
          ))}
        </div>
        {!isLast && (
          <button
            onClick={finish}
            className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[12px] font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            Saltar
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        )}
      </div>

      {/* Contenido */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={firstMount ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md"
            {...dragHandlers}
          >
            <div className="mb-6">{slide.illustration}</div>

            <div className="text-center">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[rgba(124,107,255,0.85)]">
                {slide.eyebrow}
              </div>
              <h1
                className="font-headline"
                style={{
                  fontSize: 'clamp(24px, 5vw, 30px)',
                  lineHeight: 1.18,
                  letterSpacing: '-0.02em',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.96)',
                }}
              >
                {slide.title}
              </h1>
              <p
                className="mx-auto mt-3 max-w-[34ch]"
                style={{
                  fontSize: '14.5px',
                  lineHeight: 1.55,
                  color: 'rgba(255,255,255,0.64)',
                }}
              >
                {slide.body}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom bar: prev + next/cta */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-5 pb-5 pt-3">
        <button
          onClick={prev}
          disabled={index === 0}
          aria-label="Anterior"
          className="flex h-11 w-11 items-center justify-center rounded-full border text-white/70 transition-all disabled:opacity-0"
          style={{
            borderColor: 'rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>

        <button
          onClick={next}
          className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full px-5 font-semibold text-white transition-transform active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #7c6bff 0%, #5b4bd6 100%)',
            boxShadow: '0 10px 30px -10px rgba(124,107,255,0.55)',
            fontSize: '14.5px',
            maxWidth: 320,
          }}
        >
          {isLast ? (slide.cta || 'Empezar') : 'Siguiente'}
          {!isLast && (
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          )}
        </button>

        <div className="h-11 w-11" aria-hidden="true" />
      </div>
    </motion.div>
  )
}
