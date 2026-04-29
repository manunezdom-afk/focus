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

const MIN_VISIBLE_MS = 1000
const FADE_OUT_MS = 420

export function useBootSplash() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => setShow(false), MIN_VISIBLE_MS)
    return () => clearTimeout(id)
  }, [])
  return { show }
}

// Reproduce el icono de la app (public/icons/icon.svg) inline, para que el
// rendering sea instantáneo y no dependa de cargar un PNG.
// Engranaje: cuerpo central + 8 protuberancias + anillo interior + punto central.
function FocusIcon({ size = 96 }) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      aria-hidden="true"
      style={{
        filter: 'drop-shadow(0 16px 38px rgba(29,78,216,0.45))',
      }}
    >
      <defs>
        <linearGradient id="bootsplash-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3b6ef5" />
          <stop offset="55%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#1a3db5" />
        </linearGradient>
      </defs>
      {/* Fondo */}
      <rect width="512" height="512" rx="112" fill="url(#bootsplash-bg)" />
      {/* Cuerpo central del engranaje */}
      <circle cx="256" cy="256" r="138" fill="#ffffff" />
      {/* 8 protuberancias exteriores (cada 45°) */}
      <circle cx="256" cy="78"  r="55" fill="#ffffff" />
      <circle cx="382" cy="130" r="55" fill="#ffffff" />
      <circle cx="434" cy="256" r="55" fill="#ffffff" />
      <circle cx="382" cy="382" r="55" fill="#ffffff" />
      <circle cx="256" cy="434" r="55" fill="#ffffff" />
      <circle cx="130" cy="382" r="55" fill="#ffffff" />
      <circle cx="78"  cy="256" r="55" fill="#ffffff" />
      <circle cx="130" cy="130" r="55" fill="#ffffff" />
      {/* Hueco central */}
      <circle cx="256" cy="256" r="107" fill="url(#bootsplash-bg)" />
      {/* Anillo interior blanco */}
      <circle cx="256" cy="256" r="87"  fill="#ffffff" />
      {/* Punto central azul */}
      <circle cx="256" cy="256" r="54"  fill="url(#bootsplash-bg)" />
    </svg>
  )
}

export default function BootSplash() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: FADE_OUT_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[200] flex items-center justify-center"
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
