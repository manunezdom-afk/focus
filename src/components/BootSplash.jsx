import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import AuroraBackground from './AuroraBackground'

// Pantalla de arranque con el icono de marca, igual que apps mainstream
// (Instagram, Spotify, X): aparece ~1s al abrir la app, fade-out suave y
// luego el contenido. Se muestra SIEMPRE, no sólo en el primer uso —
// distinto de WelcomeScreen, que es la "Threshold Scene" elaborada con
// saludo personalizado y aparece sólo en la primera apertura.
//
// Por qué un BootSplash React además del splash inline en index.html:
//   1. El splash inline pinta al instante (antes de que cargue el bundle)
//      pero React lo reemplaza al montar — termina visible apenas
//      ~100-300ms en cold start rápido. Demasiado fugaz para registrarse
//      visualmente, no se siente como "splash" sino como un flash.
//   2. BootSplash se monta en App.jsx con duración mínima de 1s antes de
//      empezar a hacer fade-out. La transición inline → React es invisible
//      porque ambos splashes tienen el MISMO layout (icono centrado +
//      mismo fondo + mismos blobs azules).
//   3. Como vive en React, puede usar AnimatePresence para hacer el exit
//      con framer-motion, sin saltos.

// iOS nativo muestra su propio splash 800ms (capacitor.config.json) y
// fade-out 350ms; el splash HTML inline pinta al primer frame y luego
// React lo reemplaza con BootSplash. La cadena completa debe sentirse
// como un solo arco respirado, no como un parpadeo. 700ms de visible
// + 420ms de fade le dan presencia clara sin parecer lento. Antes con
// 350+320 (~670ms total) el usuario reportaba "no dura nada".
const MIN_VISIBLE_MS = 700
const FADE_OUT_MS = 420

export function useBootSplash() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setShow(false), MIN_VISIBLE_MS)
    return () => clearTimeout(id)
  }, [])
  return { show }
}

// Icono oficial de la app como PNG para fidelidad total al diseño.
function FocusIcon({ size = 96 }) {
  return (
    <img
      src="/icons/icon-192.png?v=4"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{
        filter: 'drop-shadow(0 16px 38px rgba(29,78,216,0.45))',
        borderRadius: size * 0.22,
      }}
    />
  )
}

export default function BootSplash() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: FADE_OUT_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-critical flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 50% 42%, #0a1226 0%, #06080f 70%)',
      }}
      aria-hidden="true"
    >
      <AuroraBackground variant="threshold" intensity={1} />
      <motion.div
        // Breath sutil del icono — vivo sin distraer. Misma curva que la
        // animación del orbe en WelcomeScreen para mantener consistencia.
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-[1]"
      >
        <FocusIcon size={96} />
      </motion.div>
      {/* Wordmark sutil arriba — mismo tamaño/posición que WelcomeScreen
          y el splash inline, para que no haya salto visual al hacer el
          handoff entre pantallas oscuras. */}
      <span
        className="pointer-events-none absolute select-none text-center"
        style={{
          left: 0,
          right: 0,
          top: 'calc(env(safe-area-inset-top, 0px) + clamp(28px, 6vh, 56px))',
          fontSize: 'clamp(11px, 1.2vw, 13px)',
          letterSpacing: '0.42em',
          fontWeight: 500,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.55)',
          zIndex: 1,
        }}
      >
        Focus
      </span>
    </motion.div>
  )
}
