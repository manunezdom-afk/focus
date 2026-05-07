import { motion, LayoutGroup } from 'framer-motion'
import * as haptics from '../lib/haptics'

export default function BottomNavBar({ activeView, onNavigate }) {
  const navItems = [
    { id: 'planner',  icon: 'view_day',       label: 'Mi Día'     },
    { id: 'calendar', icon: 'calendar_month', label: 'Calendario' },
    { id: 'tasks',    icon: 'task_alt',        label: 'Tareas'     },
    { id: 'settings', icon: 'settings',        label: 'Ajustes'    },
  ]

  function handleTap(id) {
    if (id !== activeView) haptics.tap()
    onNavigate(id)
  }

  return (
    <nav
      aria-label="Navegación principal"
      className="w-full flex justify-around items-center px-2 pt-3 bg-slate-50/70 backdrop-blur-2xl border-t border-slate-200/50 gpu-layer"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
    >
      <LayoutGroup id="bottom-nav">
        {navItems.map(({ id, icon, label }) => {
          const isActive = activeView === id
          return (
            <button
              key={id}
              onClick={() => handleTap(id)}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] px-1 text-[10.5px] font-semibold leading-tight whitespace-nowrap transition-colors duration-100 active:opacity-60 ${
                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-blue-500'
              }`}
            >
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" } : {}}
              >
                {icon}
              </span>
              <span>{label}</span>
              {isActive && (
                <motion.span
                  layoutId="bottom-nav-dot"
                  className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-blue-600"
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </LayoutGroup>
    </nav>
  )
}
