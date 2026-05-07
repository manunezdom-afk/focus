# Migration Specs — Índice

Specs técnico-visuales para migrar cada pantalla de la app legacy (Vite/React/Tailwind)
a la app Expo (React Native / StyleSheet / design tokens).

## Proceso

1. Leer el spec de la pantalla.
2. Observar la pantalla legacy en el Migration Mirror (botón "Mirror" arriba a la izquierda).
3. Comparar con la pantalla Expo en el iPhone.
4. Implementar en micro-pasos según el Plan Quirúrgico del spec.
5. Verificar contra los Criterios de Aceptación.

## Pantallas

| # | Pantalla | Archivo legacy | Archivo Expo | LOC legacy | LOC Expo | Brecha | Estado |
|---|---|---|---|---|---|---|---|
| 01 | Mi Día (Planner) | `src/views/PlannerView.jsx` | `mobile/app/(tabs)/index.tsx` | 1820 | 221 | ~88% falta | En spec |
| 02 | Calendario | `src/views/CalendarView.jsx` | `mobile/app/(tabs)/calendar.tsx` | — | — | — | Pendiente |
| 03 | Tareas | `src/views/TasksView.jsx` | `mobile/app/(tabs)/tasks.tsx` | — | — | — | Pendiente |
| 04 | Nova | `src/views/NovaView.jsx` | `mobile/app/(tabs)/nova.tsx` | — | — | — | Pendiente |
| 05 | Ajustes | `src/views/SettingsView.jsx` | `mobile/app/(tabs)/settings.tsx` | — | — | — | Pendiente |

## Convenciones

- **Spec** = documento de análisis + plan. No contiene implementación.
- **Micro-paso** = una implementación atómica (≤ 1 archivo nuevo, ≤ 200 LOC), reversible, sin romper pantallas adyacentes.
- **Token first**: siempre `Colors[scheme].X`, `Spacing.X`, `Typography.X` — nunca valores hardcodeados.
- **Sin mocks**: datos solo de `useEvents`, `useTasks`, `useUserProfile` u otros hooks reales.
- **Sin NativeWind**: StyleSheet puro + design tokens.

## Arquitectura de referencia

```
mobile/
  app/(tabs)/       ← pantallas principales (una por tab)
  components/       ← componentes reutilizables
    ui/             ← primitivos (Card, Button, SectionLabel, etc.)
    calendar/       ← específicos de Calendario
    dev/            ← solo __DEV__ (LegacyMirror)
  src/
    auth/           ← AuthProvider, useAuth
    data/           ← useEvents, useTasks, today.ts
  constants/
    theme.ts        ← Colors, Spacing, Radius, Typography
  hooks/
    use-color-scheme.ts
```

## Regla de oro

> Portar lo que funciona bien en legacy. Conservar lo que ya es bueno en Expo.
> No implementar nada que no esté en el spec.
