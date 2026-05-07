# Spec 01 — Mi Día (PlannerView)

**Estado**: En spec — no implementado aún  
**Legacy**: `src/views/PlannerView.jsx` — 1820 LOC  
**Expo actual**: `mobile/app/(tabs)/index.tsx` — 221 LOC  
**Brecha estimada**: ~88 % de funcionalidad falta

---

## 1. Archivos legacy relevantes

### Pantalla principal
- `src/views/PlannerView.jsx` — componente raíz. 1820 LOC. Contiene toda la lógica de estado, timeline, bloques, insights, FocusBar integration, y renderizado condicional mobile/desktop.

### Componentes importados directamente por PlannerView
| Componente | Archivo | Rol |
|---|---|---|
| `FocusBar` | `src/components/FocusBar.jsx` | Input principal de Nova. Chat inline con voz, chips de acciones y reply cards. El corazón de toda interacción con datos. |
| `MorningBrief` | `src/components/MorningBrief.jsx` | Resumen matutino inline (solo desktop). |
| `QuickAddSheet` | `src/components/QuickAddSheet.jsx` | Sheet lazy de creación rápida de evento (form manual). |
| `RecurringMeetingSheet` | `src/components/RecurringMeetingSheet.jsx` | Sheet lazy para crear reuniones recurrentes. |
| `SwipeableCard` | Inlined en PlannerView | Swipe izquierda para eliminar con framer-motion. |
| `LongPressZone` | Inlined en PlannerView | Long-press 500ms para confirmar eliminación con `window.confirm`. |

### Hooks de datos
| Hook | Archivo | Qué provee |
|---|---|---|
| `useUserProfile` | `src/hooks/useUserProfile.js` | `{ profile: { role } }` — rol del usuario para personalizar insights. |
| `useEvents` (vía props) | `src/hooks/useEvents.js` | Eventos de Supabase. PlannerView recibe `events[]` como prop desde App.jsx. |
| `useTasks` (vía props) | `src/hooks/useTasks.js` | Tareas de Supabase. También recibe `tasks[]` como prop. |

### Utilidades críticas
| Util | Archivo | Función |
|---|---|---|
| `todayISO` | `src/utils/time.js` | Fecha de hoy en ISO (YYYY-MM-DD). |
| `parseTimeToDecimal` | `src/utils/time.js` | "14:30" → 14.5. |
| `resolveEventDate` | `src/utils/resolveEventDate.js` | Normaliza fecha de un evento (puede venir en varios formatos). |
| `parseTimeRange` | `src/utils/eventDuration.js` | "14:00 - 15:30" → `{ startH: 14, endH: 15.5 }`. |
| `normalizeTitleKey`, `extractReminderMeta`, etc. | `src/utils/reminders.js` | Lógica de deduplicación y detección de recordatorios. |
| `buildInsights` | Inlined en PlannerView | Genera 1-2 insights contextuales según eventos del día y rol. |

### Estado persistido
- `localStorage['focus_planner_blocks']` — bloques del timeline (sincronizan con eventos de Supabase).
- `localStorage['focus_onboarding_chips_dismissed']` — flag para no repetir chips de onboarding.
- `localStorage['focus_nova_tutorial_dismissed']` — flag para no repetir card tutorial de Nova.
- `localStorage['focus_empty_day_banner_dismissed']` — flag para banner "Día libre".
- `sessionStorage['focus_pending_nova_seed']` — seed cross-view para pre-llenar FocusBar desde otra pantalla.

---

## 2. Archivos Expo actuales

| Archivo | Rol |
|---|---|
| `mobile/app/(tabs)/index.tsx` | Pantalla principal Mi Día (221 LOC). ScrollView con ScreenHeader, secciones eventos/tareas. |
| `mobile/components/EventRow.tsx` | Fila de un evento con hora y título. |
| `mobile/components/TaskRow.tsx` | Fila de una tarea con checkbox toggle y swipe delete. |
| `mobile/components/ui/Card.tsx` | Container con border y background. |
| `mobile/components/ui/NovaPromptCard.tsx` | Card de empty state con título/descripción. |
| `mobile/components/ui/PrimaryButton.tsx` | Botón primario (usado en header "Añadir"). |
| `mobile/components/ui/QuickActionButton.tsx` | Botón de acción rápida con icono (grid 2x2 en empty state). |
| `mobile/components/ui/ScreenHeader.tsx` | Header con eyebrow/title/subtitle/rightAction. |
| `mobile/components/ui/SectionLabel.tsx` | Etiqueta de sección con contador. |
| `mobile/components/ErrorBanner.tsx` | Banner de error con retry. |
| `mobile/components/LoadingState.tsx` | Estado de carga. |
| `mobile/src/data/useEvents.ts` | Hook Supabase. Recibe `'today'` o `'all'`. |
| `mobile/src/data/useTasks.ts` | Hook Supabase. Devuelve `{ tasks, loading, toggleTask, removeTask }`. |
| `mobile/src/data/today.ts` | `todayLabelLong()` — "miércoles, 7 de mayo". |
| `mobile/constants/theme.ts` | Colors, Spacing, Radius, Typography. |
| `mobile/hooks/use-color-scheme.ts` | Light/dark. |

---

## 3. Estructura visual exacta de Mi Día legacy (mobile)

### Layout general (mobile, flujo vertical)
```
┌─────────────────────────────────────┐
│  Header                             │  ← pt-8
│    [date — primary, uppercase bold]  │  ← "Miércoles, 7 de mayo" 11px tracking-[0.14em]
│    Mi Día                           │  ← text-4xl font-extrabold
│                                     │
│  FocusBar                           │  ← input Nova + mic + send; sticky top en scroll
│                                     │
│  Timeline (space-y-3)               │
│  ┌─ 52px ─┬─ card ──────────────┐  │
│  │ [hora] │ [bloque evento]     │  │  ← SwipeableCard + LongPressZone
│  │        │   título            │  │
│  │        │   [HECHO ✓ btn]     │  │
│  │        │   [subtareas opt.]  │  │
│  │        │   [nota sticky]     │  │
│  └────────┴─────────────────────┘  │
│    • dot timeline conector          │  ← 2px dot absoluto, left: -21px
│                                     │
│  [Si día vacío: banner compacto]    │  ← "Día libre — ¿qué agendamos?" + X + btn Planificar
│    [chips: Agendar gym / 2h foco /  │
│     Reunión semanal fija]           │
│                                     │
│  [Si día vacío (desktop/dismissed): │
│   card grande con CTA principal]    │
│                                     │
│  [Adelanto de mañana si todo listo] │
│                                     │
│  Cards flotantes debajo timeline:   │
│  ┌─ Próximo Bloque / En Curso ───┐  │  ← solo si hay bloques
│  │  título + contador tiempo     │  │
│  │  progress bar (si tiene end)  │  │
│  └────────────────────────────── ┘  │
│  ┌─ Tu Día ───────────────────── ┐  │  ← solo mobile, solo si hay bloques
│  │  [Confirmados][Pendientes]    │  │
│  │  [Completados]  3-col grid    │  │
│  │  progress bar total           │  │
│  │  insight card                 │  │
│  └────────────────────────────── ┘  │
│                                     │
│  [Cerrar el día] — si hay actividad │
│                                     │
└─────────────────────────────────────┘
```

### Header
- Línea 1: fecha completa en primary, font-bold, uppercase, tracking-[0.14em], text-[11px] (mobile) / text-xs (desktop). Formato: "Miércoles, 7 de mayo".
- Línea 2: "Mi Día" — font-headline, tracking-tight, text-4xl font-extrabold (mobile) / text-5xl font-semibold (desktop).
- Sin botón "Añadir" en el header legacy. La FocusBar es el único punto de entrada.

### FocusBar (componente separado)
- Input de texto inline, multiline, con placeholder dinámico.
- Botón micrófono izquierda (MicButton).
- Botón enviar derecha (ícono send, primary cuando hay texto).
- Al recibir respuesta de Nova: reply card debajo del input con chips de acciones (evento creado, tarea creada, etc.).
- Seed: puede ser pre-llenado desde otra pantalla (sessionStorage) o desde chips del empty state.
- Voice: SpeechRecognition nativo del browser (webkitSpeechRecognition).

### Timeline de bloques
Cada bloque renderiza:
- **Columna hora** (52px, text-right): hora en formato "HH:MM" o "—", text-[13px] font-semibold text-outline.
- **Dot conector**: círculo 8px, absolute left: -21px, bg-primary (confirmado), bg-secondary (sugerencia), bg-amber-500 (recordatorio standalone), bg-primary scale-125 + glow (activo).
- **Tarjeta** (LongPressZone + SwipeableCard):
  - Tipos visuales: `confirmed` (border-l-4 border-primary), `done` (opacity-60 + line-through + border-emerald-400), `suggestion` (dashed border-secondary), recordatorio standalone (bg-amber-50 border-l-4 border-amber-400), tarea pendiente (bg-surface-container-low/60 border-l-4 color por prioridad).
  - Botón acción (top right): HECHO ✓ (primary→emerald on hover), ✓ HECHO (emerald, si done), ACEPTAR (secondary, si sugerencia).
  - Subtareas: chips anidados con label (Recordatorio / Subtarea / Tarea · prioridad alta) + texto, bg slate-50, border-l-2 slate-200.
  - Nota sticky: si hay description no-ISO, sticky note bg-amber-50 con ícono sticky_note_2.
- **Tareas pendientes de hoy** (type: 'task', `_isTask: true`): mismo layout pero con label "PENDIENTE DE HOY" en lugar de hora, ícono checkbox_outline, border-l-4 coloreado por prioridad (Alta: error, Media: secondary, Baja: outline-variant), botón "HECHO ✓".
- **Swipe izquierda**: revela fondo rojo con ícono delete. Si swipe > threshold, animación de salida y llama onDelete.
- **Long press (500ms)**: `window.confirm("¿Eliminar X?")` → deleteBlock + deleteEvent de Supabase si tiene eventId.

### Card "Próximo Bloque / En Curso"
Solo se renderiza cuando `blocks.length > 0`.
- Header dinámico: ícono + título cambia según estado (play_circle "En Curso", schedule "Próximo Bloque", notifications "Recordatorio", bolt "Próximo bloque sugerido").
- Badge: "ACTIVO" (primary), "RECORDATORIO" (tertiary), "FLEXIBLE" (secondary).
- Contenido:
  - **En curso**: hora + título + "X min transcurridos · de Y min" (solo si tiene endTime) + progress bar (h-1 bg-primary). Sin endTime: badge "Sin hora de fin definida".
  - **Próximo**: hora + título + "X min para empezar" (text-3xl font-extrabold text-primary tabular-nums).
  - **Recordatorio**: hora + título + countdown "En X min" (text-3xl text-tertiary).
  - **Flexible** (sin hora): badge "Sin hora definida" + título + "Cuando puedas durante el día."
  - **Sin bloques pendientes**: ícono check_circle/40 + "Sin bloques pendientes."
- Barra de progreso del día: completedCount / scheduledBlocks, text-[10px] bold.

### Card "Tu Día" (mobile only)
Solo se renderiza cuando `blocks.length > 0 && !isDesktop`.
- Grid 3-col: Confirmados (primary), Pendientes (secondary), Completados (on-surface-variant). text-2xl font-extrabold tabular-nums + label text-[10px].
- Progress bar: h-1.5 bg-secondary (diferencia visual de la progress bar del "Próximo Bloque").
- Insight: 1 insight contextual (bg tinted + ícono material + label uppercase + texto).

### Insight (buildInsights)
Reglas en orden de prioridad (primeros 2 se muestran):
1. ≥3 reuniones: "REUNIONES" amber.
2. 1-2 reuniones: "AGENDA" primary.
3. ≥2 eventos evening: "TARDE OCUPADA" secondary.
4. 0 eventos hoy: "ESPACIO LIBRE" primary.
5. 1-2 eventos hoy: "AGENDA LIGERA" primary.
6. Siempre: "TIME BLOCKING" primary (tip estático).

### Cerrar el día
Botón full-width al final de la columna derecha (o de la pantalla en mobile). Solo visible cuando `hasAnyDayActivity`. Llama `onEveningShutdown` (abre EveningShutdown sheet).

### Adelanto de mañana
- Se muestra cuando `dayIsEmpty || dayIsDone` y no hay tareas pendientes hoy y mañana tiene ≥1 evento.
- Máx. 3 eventos de mañana, ordenados por hora.
- Formato: misma columna 52px de hora + card inline simple (no SwipeableCard).
- Link "Ver calendario" → navega a calendar tab.

### Empty state (día vacío)
**Banner compacto** (mobile, no dismissado): fondo white/60 blur, ícono auto_awesome primary, texto "Día libre — ¿qué agendamos?", botón "Planificar" → seed Nova "Planifica mi día" autosubmit, botón X para dismiss (localStorage).

**Chips de onboarding** (mobile, siempre visible si día vacío):
- "Agendar gym mañana" → seed Nova.
- "Reservar 2h enfocadas" → seed Nova.
- "Reunión semanal fija" → abre RecurringMeetingSheet.

---

## 4. Comportamiento detallado

### Al tocar "Añadir" / crear evento
En legacy: **no hay botón "Añadir"**. Todo va por FocusBar (lenguaje natural). QuickAddSheet se puede abrir programáticamente. Nova recibe el texto, llama a la API, devuelve `add_event` action → `onAddEvent(formData)` → crea en Supabase → realtime push → useEffect sincroniza `blocks` desde eventos.

### Al hablar con Nova (FocusBar)
1. Usuario escribe (o dicta) en FocusBar.
2. `apiFetch('/api/nova', { message, events, tasks, memories })` → API de Nova.
3. Nova responde con `{ reply, actions: [...] }`.
4. Cada action se aplica: `add_event` → `onAddEvent`, `add_task` → `onAddTask`, etc.
5. Reply card aparece debajo del input con chips describiendo las acciones aplicadas.
6. Chips de undone: no implementados en la pantalla; el `onShowUndo` es un prop que App.jsx provee para mostrar el UndoToast global.
7. `sessionStorage['focus_pending_nova_seed']` se puede pre-llenar desde Tareas con "Nova organízame" para que al volver a Mi Día el FocusBar tenga el texto listo.

### Creación de tareas
- Nova emite `add_task` → `onAddTask(task)` → `useTasks.addTask` → Supabase INSERT.
- Las tareas con `category: 'hoy'` aparecen en el timeline de Mi Día como items especiales (`_isTask: true`).
- Las tareas con `linkedEventId` aparecen como subtareas del evento correspondiente.
- Las tareas con `parentTaskId` aparecen como subtareas de la tarea padre.

### Completar un bloque
- Botón "HECHO ✓" en la tarjeta → `completeBlock(id)` → `type: 'done'` en localStorage.
- Si es tarea (`taskId`): también llama `onToggleTask(taskId)`.
- El bloque queda en el timeline con opacity-60 + strikethrough, ya no cuenta como "próximo".

### Actualización de datos
- Events/tasks vienen de Supabase realtime + visibilitychange refetch.
- `useCoalescedRefetch` evita múltiples refetches simultáneos.
- Bloques se re-sincronizan con eventos en cada render de events (useEffect):
  - Eventos borrados de Supabase → blocks zombies eliminados.
  - Tiempo/título actualizados → blocks actualizados.
  - Nuevos eventos → nuevos blocks agregados.

### Loading
- Props `events` / `tasks` ya vienen cargados desde App.jsx (el padre). Mi Día no tiene loading state propio.
- Expo: `loading = (events.loading && events.events.length === 0) || (tasks.loading && tasks.tasks.length === 0)` → `<LoadingState />`.

### Error handling
- Legacy: delega completamente al padre (App.jsx maneja errores de hooks).
- Expo: `<ErrorBanner message="No pudimos cargar tus datos." onRetry={handleRefresh} />`.

### Sesión
- Ambos requieren sesión activa. Legacy via `useAuth` (Context). Expo via `AuthProvider` + `AuthGate` en `_layout.tsx`.

---

## 5. Datos reales

### Eventos
- **Tabla Supabase**: `events` (via `dataService.fetchEvents`).
- **Hook Expo**: `useEvents('today')` — filtra por fecha de hoy en el hook.
- **Hook legacy**: `useEvents` en `src/hooks/useEvents.js` — recibe `user.id`, usa realtime subscription. Devuelve `events[]` con campos: `id, title, time, date, description, section, recurrence`.
- **Filtro de hoy en legacy**: `events.filter(e => e.date === todayISO())` — explícito en PlannerView para bloques y insights. Eventos con `date: null` son legacy antiguo y no aparecen en Mi Día.
- **Secciones**: campo `section` en eventos: `'morning' | 'afternoon' | 'evening'` — no renderizado como header de sección en Mi Día, pero usado en `buildInsights` (`eveningCount`).

### Tareas
- **Tabla Supabase**: `tasks`.
- **Hook Expo**: `useTasks()` — devuelve todas las tareas del usuario.
- **Filtro en Mi Día**: `category === 'hoy'` (aparecen en timeline), `category === 'semana'` y `category === 'algún día'` (cuentan en `semanaCount`/`algoDiaCount` para copy del empty state).
- **Relaciones**: `linkedEventId` y `parentTaskId` viven solo en `localStorage` (no en Supabase schema actual). Se hidratan en `useTasks` via `getTaskLinks / getTaskParents`.

### Qué NO inventar
- No usar eventos hardcoded ("Meeting standup", "Gym", etc.).
- No usar tareas hardcoded.
- No usar nombres de usuario ficticios.
- No mostrar fechas/horas que no vengan de datos reales.
- El saludo ("Buenos días", etc.) sí puede ser generado desde hora local.

---

## 6. Diferencias legacy vs Expo

### Lo que falta en Expo (gaps críticos)
| Feature | Legacy | Expo | Impacto |
|---|---|---|---|
| **FocusBar / Nova input** | Input inline en Mi Día con voz + chips | Solo navega a /nova tab | CRÍTICO — el usuario no puede interactuar con datos desde Mi Día |
| **Timeline de bloques** | Columna hora + dot + card con border-l-4 | Lista plana de EventRow | ALTO — pérdida de jerarquía visual |
| **Estado de bloques** | confirmed / suggestion / done con botón HECHO ✓ | No existe | ALTO — no hay forma de marcar eventos completados |
| **SwipeableCard** | Swipe izquierda para eliminar | TaskRow tiene swipe pero EventRow no | MEDIO |
| **Próximo Bloque** | Card dinámica En Curso / Próximo / Recordatorio | No existe | ALTO — orientación en el día |
| **Tu Día dashboard** | Grid 3 métricas + progress bar | No existe | MEDIO |
| **Insight contextual** | Adaptado a reuniones, carga, rol | No existe | BAJO |
| **Cerrar el día** | Botón → EveningShutdown | No existe | BAJO |
| **Adelanto de mañana** | Sección auto cuando hoy está vacío/listo | No existe | BAJO |
| **Chips de onboarding** | Agendar gym / Reservar 2h / Reunión fija | Grid de acciones similares ✓ | BAJO (Expo ya lo tiene parcialmente) |
| **RecurringMeetingSheet** | Sí | No | MEDIO |
| **Subtareas anidadas** | Recordatorios / tareas linked bajo evento | No | ALTO — Nova crea subtareas y no se ven |

### Lo que está peor en Expo vs legacy
- **Header fecha**: legacy es más compacto y el formato es más rico (día de la semana + número).
- **"Añadir" en header de Expo**: navega a Calendario, pero en legacy no existe ese botón porque la FocusBar es todo.
- **Tareas en Mi Día**: Expo muestra tareas en sección separada ("Tareas pendientes"), legacy las integra en el timeline como bloques visuales cuando son `category: 'hoy'`.
- **Empty state**: Expo tiene QuickActionButton grid con 2 botones deshabilitados ("Dictar", "Foto de agenda") que aparecen como ruido hasta que se implementen.

### Lo que está mejor en Expo
- **Pull-to-refresh**: Legacy no tiene RefreshControl nativo (recarga entera de página web).
- **SafeAreaView**: Correcto manejo de notch/isla dinámica.
- **Design tokens**: Consistencia visual garantizada (Colors, Spacing, Typography).
- **ErrorBanner**: Fallback de error explícito (legacy delega al padre).
- **totalDoneToday**: Contador de tareas completadas hoy (no existe en legacy).
- **TaskRow con toggle y swipe**: Bien implementado.
- **Sin localStorage**: No hay estado persistido frágil. Expo usa solo Supabase.

### Lo que conviene mantener de Expo
- Toda la estructura `useEvents('today')` / `useTasks()` — no cambiar hooks.
- `ScreenHeader` con eyebrow + title + subtitle — solo ajustar el formato del header visual.
- `ErrorBanner` y `LoadingState`.
- `RefreshControl` con pull-to-refresh.
- Design tokens en todos los estilos.
- `TaskRow` con toggle nativo.
- La ausencia de localStorage (no migrar el sistema de blocks a AsyncStorage).

---

## 7. Plan quirúrgico de implementación

> **Regla**: cada paso es un commit independiente. Si falla, se revierte solo sin romper el resto.

### Paso 1 — Saludo + header corregido
**Qué**: el header de Expo ya funciona pero el formato de fecha ("Miércoles, 7 de mayo" con día y mes en español) y el saludo ya están bien. Solo ajustar que la fecha aparezca como en legacy: `formatToday()` → "Miércoles, 7 de mayo de 2025" → recortar solo si necesario.
**Archivos**: `mobile/src/data/today.ts` (verificar formato), `mobile/app/(tabs)/index.tsx` (mínimo).
**Riesgo**: Bajo.

### Paso 2 — Timeline layout (estructura visual sin lógica)
**Qué**: reemplazar la `Card` flat de eventos por un layout de timeline: columna hora (52px) + dot connector (8px circle absolute) + card con `border-l-4`. Sin cambiar cómo se obtienen los datos.
**Archivos**: nuevo componente `mobile/components/planner/TimelineEventBlock.tsx`, editar sección de eventos en `index.tsx`.
**Riesgo**: Bajo si se hace como componente nuevo.

### Paso 3 — Estado de bloque: botón HECHO ✓ en eventos
**Qué**: cada EventRow/TimelineEventBlock muestra botón "HECHO ✓" que marca el evento como `done` localmente (estado de UI en el componente con `useState`). No afecta Supabase. El dot cambia a verde, opacity baja a 0.6, título con strikethrough.
**Archivos**: `TimelineEventBlock.tsx`.
**Riesgo**: Bajo. Estado local, no persiste.

### Paso 4 — Integrar tareas de hoy en el timeline
**Qué**: las tareas con `category === 'hoy'` aparecen al final del timeline (después de eventos con hora), con layout especial: ícono checkbox en lugar de hora, badge "Pendiente de hoy", botón "HECHO ✓" que llama `toggleTask`. Las tareas sin categoría específica van a la sección "Tareas pendientes" de abajo.
**Archivos**: `mobile/components/planner/TimelineTaskBlock.tsx`, editar `index.tsx`.
**Riesgo**: Medio. Cambiar el filtro de tareas existente.

### Paso 5 — Próximo Bloque / En Curso (card)
**Qué**: nueva card debajo del timeline que muestra el próximo evento con hora y cuántos minutos faltan (o "En curso" con tiempo transcurrido). Solo muestra el evento más cercano futuro (o activo) del día.
**Archivos**: nuevo componente `mobile/components/planner/NextBlockCard.tsx`, editar `index.tsx`.
**Riesgo**: Medio. Requiere `parseTimeToDecimal` en mobile.

### Paso 6 — FocusBar en Mi Día (el más complejo)
**Qué**: Reemplazar (o complementar) la navegación "/nova" por un input inline de Nova directamente en Mi Día. Input de texto + botón enviar → llama a la API de Nova → aplica acciones. SIN voz en este paso.
**Archivos**: nuevo componente `mobile/components/planner/PlannerNovaInput.tsx`, editar `index.tsx`.
**Riesgo**: ALTO. Es el paso más complejo. Hacerlo en su propio spec antes de implementar.

### Paso 7 — Voz en FocusBar (si aplica)
**Qué**: `expo-speech` o `@react-native-voice/voice` para dictado.
**Riesgo**: ALTO. Dependencia nueva, requiere permisos. Dejar para último.

### Pasos siguientes (baja prioridad, no bloquean UX básico)
- Paso 8: "Tu Día" dashboard (metrics grid).
- Paso 9: Insight contextual.
- Paso 10: Adelanto de mañana.
- Paso 11: Cerrar el día (EveningShutdown).
- Paso 12: RecurringMeetingSheet nativo.

---

## 8. Criterios de aceptación

### Checklist visual (verificar en iPhone con Mirror al lado)

- [ ] Header muestra fecha completa en español: "Miércoles, 7 de mayo" (no "7/5/2025").
- [ ] Saludo dinámico: "Buenos días" / "Buenas tardes" / "Buenas noches" según hora.
- [ ] Título "Mi día" en tipografía grande y bold (≥32px).
- [ ] Eventos del día muestran hora en columna izquierda (52px) + línea vertical dot.
- [ ] Cada evento tiene border-left de color (primary para activo/futuro, verde para hecho).
- [ ] Tareas `category === 'hoy'` aparecen integradas en el timeline (no solo en sección separada).
- [ ] Card "Próximo Bloque" o "En Curso" visible cuando hay eventos con hora.
- [ ] Empty state: cuando no hay eventos ni tareas, muestra opciones para crear o hablar con Nova.
- [ ] No hay botones deshabilitados visibles ("Dictar", "Foto de agenda" deben ocultarse hasta implementarse).
- [ ] Pull-to-refresh funciona y refresca datos.
- [ ] No hay datos ficticios.

### Checklist funcional

- [ ] Eventos reales de Supabase se muestran en el timeline.
- [ ] Tareas reales de Supabase con `category === 'hoy'` aparecen en timeline.
- [ ] Toggle de tarea desde Mi Día llama `tasks.toggleTask` y actualiza Supabase.
- [ ] Botón "HECHO ✓" en evento cambia estado visual (done) sin crashear.
- [ ] Eliminar evento desde Mi Día llama `events.removeEvent` y desaparece del timeline.
- [ ] "Añadir" o la interacción con Nova crea un evento real en Supabase y aparece sin reload.
- [ ] Cambiar de tab y volver no pierde datos (sin estado local frágil).
- [ ] Error de Supabase muestra ErrorBanner, no pantalla blanca.

### Checklist iPhone real

- [ ] Timeline no tiene overflow horizontal en pantalla de 390px (iPhone 14).
- [ ] Dots del timeline no quedan cortados por el scroll.
- [ ] Cards tienen tamaño de toque mínimo 44px de alto.
- [ ] Pull-to-refresh no choca con la barra de estado.
- [ ] Font legible en modo oscuro (Colors[scheme] aplicado en todos los textos).
- [ ] SafeAreaView respeta la isla dinámica del iPhone.
- [ ] No hay flash de contenido vacío al cargar (loading state correcto).
- [ ] Mirror side-by-side muestra que la jerarquía visual es equivalente al legacy.

---

## Notas de observación (Migration Mirror)

> Completar al observar la app legacy en el Mirror. Aquí van cosas que se notan
> al usar la app real que no están documentadas en el código.

- [ ] _(Pendiente de observación en Mirror)_

---

**Fecha de spec**: 2026-05-07  
**Último revisor**: Claude Sonnet 4.6  
**Próxima acción**: decidir cuál Paso implementar primero.
