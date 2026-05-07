# Mobile native feel — auditoría

Estado del trabajo del punto 6 del plan: hacer que Focus se sienta como una
app mobile real en iPhone. Owner: Martín. Última revisión: 2026-05-07.

Enfoque: cambios quirúrgicos sobre una base que ya estaba bien preparada
(safe areas, haptics, splash, blur off en Capacitor). No fue rediseño
visual; fue cerrar agujeros de comportamiento.

---

## 1. Auditoría inicial — qué encontré

| # | Área | Estado previo | Hallazgo |
| --- | --- | --- | --- |
| 1 | Safe areas | ✅ Bien | TopAppBar, BottomNavBar, FocusBar, NovaWidget ya usan `env(safe-area-inset-*)`. |
| 2 | Viewport (100dvh/100svh) | ✅ Bien | html/body/#root configurados con dvh+svh y overflow-x: clip. |
| 3 | Boot splash | ✅ Bien | Punto 5 corrigió: espera a `authLoading=false` con cap 4s. |
| 4 | Tap highlight + touch-action | ✅ Bien | `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation` ya aplicados a botones. |
| 5 | Backdrop-blur en Capacitor | ✅ Bien | Deshabilitado vía `html.is-capacitor` (era la causa #1 de jank de scroll). |
| 6 | Aurora animations en Capacitor | ✅ Bien | Estáticas en `html.is-capacitor` (libera GPU). |
| 7 | Haptics | ✅ Bien | `src/lib/haptics.js` con tap/confirm/warn/error, ya usado en BottomNavBar. |
| 8 | Tipografía | ✅ Bien | System stack (SF Pro) sin Google Fonts → ahorra 200-400ms en cold start iOS. |
| 9 | iosKeyboard listener | ⚠️ Incompleto | Se activaba sólo en Capacitor. En PWA Safari iOS no había detección de teclado → BottomNavBar tapaba inputs. |
| 10 | `body.keyboard-open` | ⚠️ Sin uso | La clase se añadía pero ninguna regla CSS la consumía → no hacía nada. |
| 11 | `var(--keyboard-height)` en NovaWidget | 🐛 Código muerto | Siempre 0 (decisión de no setear en Capacitor). El cálculo `safe-area + var(--keyboard-height)` era redundante y confundía. |
| 12 | Swipe horizontal entre tabs | ❌ No existía | El prompt lo pidió. Cero implementación previa. |
| 13 | Active state + tap delay en Capacitor | ✅ Bien | Transition de 60ms para `:active` en `html.is-capacitor`. |
| 14 | `prefers-reduced-motion` | ✅ Bien | Globalmente capado en index.css. |

---

## 2. Cambios aplicados

### A. Hook nuevo `src/lib/useSwipeNavigation.js`

Detección de swipe horizontal en mobile sin librería extra. Reglas:

- Mínimo 60px horizontal y < 0.66× movimiento vertical (ratio 1.5).
- Tiempo máximo 500ms (más allá de eso es drag deliberado, no swipe).
- Decisión de eje temprana (a partir de 8px): si decide vertical, todo el resto del gesto es scroll y se ignora.
- Si decide horizontal y supera 16px, llama `preventDefault()` para que el navegador no rebote.
- **Gates**: ignora si el touch arrancó en input/textarea/button/anchor/`role="button"`/`data-no-swipe`, si el body tiene `keyboard-open`, o si hay `[role="dialog"][aria-modal="true"]` visible.
- Listener `passive: false` solo en `touchmove` para poder cancelar el overscroll.

### B. App.jsx — wire del hook

```js
const SWIPE_VIEW_ORDER = ['planner', 'calendar', 'tasks', 'settings']
const swipeEnabled = !isDesktop && SWIPE_VIEW_ORDER.includes(activeView)
useSwipeNavigation({
  enabled: swipeEnabled,
  onSwipeLeft:  () => navigate(SWIPE_VIEW_ORDER[idx + 1], { intent: 'forward' }),
  onSwipeRight: () => navigate(SWIPE_VIEW_ORDER[idx - 1], { intent: 'back' }),
})
```

- Solo activo en mobile (`!isDesktop`) y en las 4 root views.
- `day`, `task-detail`, `memory`, `nova-knows` no entran en el orden — pueden tener scroll horizontal interno o estado complejo.
- Los handlers están en `useCallback([])` y leen `activeViewRef.current` para no recrearse en cada render.

### C. iosKeyboard.js — soporte PWA Safari

Antes solo escuchaba `@capacitor/keyboard` (iOS nativo). Ahora también:

- En **PWA Safari iOS / browser** usa `window.visualViewport.resize` para detectar la diferencia entre `innerHeight` y `visualViewport.height`. Si delta > 150px → teclado abierto.
- En **Capacitor iOS** sigue usando el plugin oficial (más preciso, respeta animación nativa).
- En ambos casos solo flippea `body.classList.toggle('keyboard-open')` — sin variables de altura, no doble-cuento de espacio.

### D. CSS — reglas nuevas para `body.keyboard-open`

```css
body.keyboard-open nav[aria-label="Navegación principal"] {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease-out;
}
```

- Al abrir teclado se desvanece la BottomNavBar para liberar espacio (~80px).
- Sin `display: none` para no romper layout flow.
- Vuelve sola al hacer blur del input.

### E. NovaWidget — limpieza de código muerto

Eliminado el cálculo `calc(env(safe-area-inset-bottom, 0px) + var(--keyboard-height, 0px))` del padding de la sheet. Ahora solo `env(safe-area-inset-bottom, 0px)` — iOS reduce ese valor a 0 cuando el teclado está visible (porque el indicator queda tapado), así que no hay duplicación de espacio ni "agujero blanco enorme bajo el input".

---

## 3. Archivos modificados

| Archivo | Cambio |
| --- | --- |
| **`src/lib/useSwipeNavigation.js`** (nuevo) | Hook de swipe horizontal entre tabs. |
| **`src/lib/iosKeyboard.js`** | Branch nuevo para PWA Safari vía visualViewport. |
| **`src/App.jsx`** | Import + wire del hook + constante `SWIPE_VIEW_ORDER`. |
| **`src/index.css`** | Regla nueva: oculta BottomNavBar con `body.keyboard-open`. |
| **`src/components/NovaWidget.jsx`** | Removido `var(--keyboard-height, 0px)` del paddingBottom. |
| **`tests/swipe-navigation.test.js`** (nuevo) | 11 tests del hook (gates de input/modal/teclado, constantes razonables). |

Sin cambios en: backend, auth, IA, límites, costos, privacidad, branding, paleta.

---

## 4. Decisiones explícitas

### Safe areas
- Sin cambios. Las que existían ya estaban bien (`env(safe-area-inset-*)` en TopAppBar, BottomNavBar, FocusBar, NovaWidget).
- BottomNavBar usa `paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)'` — ese `max` evita que se pegue al borde en dispositivos sin notch.

### Teclado
- Mantenemos `Keyboard.resize: "native"` en `capacitor.config.json` (decisión previa documentada). El WKWebView se reduce automáticamente, así que CSS no debe sumar altura del teclado.
- En PWA Safari iOS donde el plugin no aplica, `visualViewport` detecta el teclado y flippea la clase. No exponemos altura porque la API tiene quirks entre browsers.
- BottomNavBar se desvanece con `opacity: 0` cuando hay teclado, dejando el input pegado al borde superior del teclado nativo.

### Touch targets
- Ya estaban a 44px mínimo (BottomNavBar `min-h-[44px]`).
- `touch-action: manipulation` ya aplicado a botones en index.css (elimina delay de 300ms iOS).
- Haptics `tap()` ya disparados al cambiar de tab.
- **No** aumenté tamaños de botones ni cambié layouts — la base ya cumple la guideline.

### Scroll
- Sin cambios. `-webkit-overflow-scrolling: touch` no es necesario en iOS modern (default smooth). `overscroll-behavior` ya configurado.

### Navegación / swipe
- Implementado entre las 4 root tabs.
- Velocidad/threshold elegidos para coincidir con el feel iOS estándar (60px / 1.5× ratio / 500ms max).
- **No** se cambió la animación de transición de vista — ya existía vía `routeMotion` en App.jsx con direction +1/-1. El swipe simplemente alimenta esa animación con la dirección correcta.

### Haptics
- Sin cambios — los existentes son correctos.
- **Decidido NO** disparar haptic en cambio de vía swipe (sería demasiado intrusivo si el usuario está scrolleando con dudas).

### Cold start
- Punto 5 ya cubrió el caso (BootSplash espera a authLoading).
- Verificado en preview: no hay flash, no hay datos privados antes de auth.

---

## 5. Pruebas realizadas

- **Unit tests** del hook de swipe (11) — cubren gates de input/modal/teclado, threshold values razonables.
- **Suite completa** (93 tests): apns, cron, security, auth-required, auth-errors, ai-pricing, usage-limits, privacy-cleanup, swipe-navigation. **93/93 ok**.
- **Build** `npm run build` → 2.05s, sin warnings.
- **Preview server** Vite dev → app arranca limpia, sin errores en consola, BootSplash → Mi Día sin flash.

```bash
node --test tests/auth-errors.test.js tests/privacy-cleanup.test.js \
            tests/ai-pricing.test.js tests/usage-limits.test.js \
            tests/auth-required.test.js tests/security.test.js \
            tests/cron-config.test.js tests/apns.test.js \
            tests/swipe-navigation.test.js
```

---

## 6. Dispositivos / viewports recomendados para QA manual

Hago las pruebas estructurales que pude hacer desde aquí. Las **manuales con
gestos reales** las debe hacer Martín en el simulador o iPhone real. Lista:

| # | Caso | Esperado |
| --- | --- | --- |
| 1 | Cold start en iPhone real (cualquier modelo) | BootSplash hasta hidratar auth, después Mi Día sin flash. |
| 2 | iPhone SE (pantalla chica) | Bottom bar respeta safe area; tabs se pueden tocar; input no queda tapado. |
| 3 | iPhone 15 / 15 Pro (Dynamic Island) | TopAppBar respeta el inset top; ningún contenido cae bajo la isla. |
| 4 | Swipe izquierda en Mi Día | Debe pasar a Calendario con la animación de slide existente. |
| 5 | Swipe izquierda en Calendario | Debe pasar a Tareas. |
| 6 | Swipe izquierda en Tareas | Debe pasar a Ajustes. |
| 7 | Swipe derecha desde Ajustes | Debe volver a Tareas. |
| 8 | Swipe en Ajustes (extremo derecho) | No debe hacer nada (no hay vista siguiente). |
| 9 | Swipe vertical en una lista larga (tareas) | Debe ser scroll, no cambio de tab. |
| 10 | Diagonal swipe ambiguo | Si vertical > horizontal × 1.5 → scroll. |
| 11 | Tap en input de Mi Día → escribir | BottomNavBar debe desvanecerse. |
| 12 | Cerrar teclado | BottomNavBar reaparece. |
| 13 | Abrir Nova → escribir | Sheet de Nova no debe tener "agujero blanco" debajo del input. |
| 14 | Modal abierto (Quick Add, Auth modal, Memory) | Swipe NO debe disparar cambio de tab — el modal sigue al frente. |
| 15 | Background → foreground | Sesión se mantiene, sin pantalla en blanco. |
| 16 | Swipe sobre la barra inferior (BottomNavBar) | NO debe disparar — los botones lo capturan. |
| 17 | Modo demo (sin sesión) | Igual feel, los endpoints IA responden 401 con copy claro. |

### Cómo probarlo en Xcode Simulator
1. `npx cap open ios` → Xcode abierto.
2. Target `App` + simulador iPhone 15 Pro (o el que tengas configurado).
3. ▶️ Cmd+R.
4. Una vez en la pantalla de Mi Día, **Device → Touch Bar** o usa el trackpad para gestos. En Mac con trackpad: dos dedos horizontal hace swipe en el simulador.

---

## 7. Pendientes para QA visual profundo (Punto 10)

**No hechos en este punto** (intencional, no son bugs ahora):

1. **Swipe en `day` view** (vista de un día específico) — el día tiene scroll horizontal interno entre días; no agregamos swipe-to-tab para no chocar.
2. **Swipe en `memory` / `nova-knows` / `task-detail`** — son sub-views con back. No tienen swipe-to-tab; salida vía botón back.
3. **Onboarding tour del swipe** — no se le indica al usuario que puede hacer swipe. Decidido NO mostrar (gestos descubrir-por-uso es la convención iOS).
4. **Edge swipe back gesture** (deslizar desde el borde izquierdo para volver) — iOS lo soporta nativamente para `Browser.open()` pero no en el WebView del root. Pendiente para futuro.
5. **Haptic en cambio de tab por swipe** — decidido NO por ahora (ver decisión arriba).
6. **Pull-to-refresh** en listas — no implementado, no es prioridad pre-TestFlight.
7. **Long press menus** sobre tareas/eventos — pendiente para QA visual.
8. **Test del hook con renderer React real** (renderHook) — el repo no tiene `@testing-library/react` instalado. Cubrimos solo helpers puros.

---

## 8. Lo que Martín debe verificar manualmente en iPhone

**Críticos (bloquean TestFlight si fallan)**:
- [ ] Cold start: BootSplash → Mi Día sin flash, sin datos del usuario antes de hidratar.
- [ ] Login con OTP funciona normal.
- [ ] Logout limpia datos privados.
- [ ] Swipe entre tabs funciona y no rompe scroll vertical.
- [ ] Teclado abierto en Mi Día / Nova: input visible, sin bordes negros.
- [ ] Bottom bar oculta con teclado, vuelve al cerrarlo.
- [ ] Modales (Quick Add, Auth, Memory) no se interrumpen con swipe.

**Importantes (no bloquean pero lograr antes de App Store)**:
- [ ] Swipe se siente fluido en device real (lat ~250-300ms es OK).
- [ ] Tap en BottomNavBar tiene feedback haptic perceptible.
- [ ] Navegación a sub-views (memory, nova-knows) sigue funcionando vía tap, no rompe el back.
- [ ] Aurora background no causa lag al hacer swipe (deshabilitada en Capacitor → debería estar OK).
- [ ] iPhone SE / pantallas chicas: nada cortado.
