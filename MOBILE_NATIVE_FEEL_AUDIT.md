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

## 6.1 Mobile Native Interaction Foundation — segunda pasada

La pasada inicial dejó el swipe **detectivo** (detectar gesto al final y
cambiar tab). Después de probarlo, se sentía tosco — "click después del
swipe", el contenido no acompañaba al dedo, no había snap-back, no había
feedback al cruzar threshold, BottomNav desaparecía con un fade plano.
Esta sección documenta la segunda pasada, donde reescribimos los gestos
para que sean **interactivos** (el contenido sigue al dedo) con física
spring de tipo iOS.

### Diagnóstico de lo que se sentía tosco

| # | Síntoma | Causa raíz |
| --- | --- | --- |
| 1 | "Click después del swipe" | El hook anterior solo detectaba dirección al `touchend` y llamaba `navigate()`. El contenido nunca se movía con el dedo. |
| 2 | Cambio de tab solo con opacity en Capacitor | `pageVariants` en `is-capacitor` devolvía `{ opacity: 0 }` sin `x`. Sin direccionalismo visual. |
| 3 | BottomNav desaparece con fade plano | `body.keyboard-open` aplicaba `opacity: 0; pointer-events: none`. La barra se desvanecía pero no se sentía como un elemento físico saliendo. |
| 4 | No había snap-back | Si el swipe no llegaba al threshold, simplemente no pasaba nada — silencio = sensación de "se atascó". |
| 5 | No había haptic al cruzar threshold | El usuario no sabía hasta soltar si el cambio de tab había sido aceptado. |
| 6 | Sin física consistente entre componentes | Cada animación traía sus propios `cubic-bezier` random. |
| 7 | Falta de rubber-band en bordes | Ajustes deslizando aún más a la izquierda no daba ningún feedback. |

### Cambios aplicados

#### A. Sistema centralizado `src/lib/motion.js`

Single source of truth de física. Define:
- 4 curvas easing (EASE_IOS, EASE_KEYBOARD, EASE_SNAP_BACK, EASE_DECEL).
- 6 duraciones (instant, fast, page, sheet, snapBack, keyboard).
- 4 spring presets (page, snap, panel, ui) con stiffness/damping/mass calibrados.
- `prefersReducedMotion()` y `safeTransition()` helpers.
- **Solver de spring 1D** (`stepSpring`, `isSpringSettled`) para animaciones manuales con `requestAnimationFrame` sin depender de framer-motion en hot paths.

#### B. Hook nuevo `src/lib/useNativeSwipe.js` (reemplaza `useSwipeNavigation`)

El cambio de fondo: **el contenido sigue al dedo en tiempo real**. Aplicamos `transform: translate3d(...)` directamente al wrapper vía ref dentro del `touchmove`. Cero `setState` por frame (ese era el suicidio de performance).

- **Threshold combinado**: 30% del ancho del viewport O velocidad ≥ 550 px/seg (mismo que Apple usa para flick en Safari).
- **Snap-back**: si el gesto no completa, animamos de vuelta a 0 con `SPRING.snap` (más blando, rebote ligero).
- **Commit**: si pasa, animamos hasta `±width` con `SPRING.page` (rígido, asienta rápido) y al terminar disparamos `onCommit{Left,Right}()`.
- **Rubber band en bordes**: cuando no hay vista en esa dirección, el drag responde con 0.45× del movimiento (sensación iOS típica).
- **Haptic al cruzar threshold**: `haptics.selectionTick()` se dispara una sola vez por gesto, **antes** de soltar — el usuario siente físicamente que el cambio fue aceptado.
- **Edge swipe del sistema**: ignora los primeros 20px del borde izquierdo para no chocar con el back nativo de iOS.
- **Decisión de eje temprana** (≥8px): si el ratio horizontal/vertical es < 1.5×, dropea el gesto y deja que sea scroll.
- **Cancel limpio**: en `touchcancel` o unmount del hook, animamos de vuelta a 0.

#### C. `pageVariants` con slide direccional

Ya no es `opacity-only` en Capacitor. Cambio peer (Mi Día → Calendario): la vista entrante arranca a `+28px` en la dirección del movimiento; la saliente se va a `-28px`. Combinado con opacity y `EASE_IOS`. Para deeper/back (sub-views) seguimos con scale + opacity (Apple usa crossfade sin slide para drill-in).

#### D. BottomNavBar con `translateY` (no opacity-only)

```css
nav[aria-label="Navegación principal"] {
  transition:
    transform 0.24s cubic-bezier(0.32, 0.72, 0, 1),
    opacity   0.18s cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform;
}
body.keyboard-open nav[...] {
  transform: translate3d(0, calc(100% + env(safe-area-inset-bottom, 0px)), 0);
  opacity: 0;
  pointer-events: none;
}
```

La barra **se desliza fuera** de la pantalla (incluyendo safe area) cuando aparece el teclado, en vez de desvanecerse. La curva matchea aprox la del teclado iOS (250ms ease-out fuerte). Ya no es "fantasma transparente" mientras escribes.

#### E. Hook `src/hooks/useKeyboardState.js`

Para componentes React que necesiten reaccionar al estado del teclado (ej. autoscroll de mensajes en Nova). Usa `MutationObserver` sobre `body.classList` — única fuente de verdad ya gestionada por `iosKeyboard.js`. No duplica listeners.

#### F. `useCallback` y refs estables

El wire del swipe en `App.jsx` lee `activeViewRef.current` (no del state) para que los handlers no se recreen en cada render. `swipeWrapperRef` apunta a un `<div>` adentro del `motion.div` (no al motion.div directo, que framer-motion intercepta — aprendizaje del primer intento que tiraba warnings de React).

### Archivos modificados / nuevos en la pasada 6.1

| Archivo | Tipo |
| --- | --- |
| `src/lib/motion.js` | **Nuevo** — language de motion centralizado + spring solver. |
| `src/lib/useNativeSwipe.js` | **Nuevo** — hook interactivo (reemplaza useSwipeNavigation). |
| `src/hooks/useKeyboardState.js` | **Nuevo** — estado del teclado para React. |
| `src/lib/useSwipeNavigation.js` | **Eliminado** — reemplazado. |
| `tests/swipe-navigation.test.js` | **Eliminado** — reemplazado. |
| `tests/native-swipe.test.js` | **Nuevo** — 12 tests (gates + spring solver + curvas). |
| `src/App.jsx` | Cableado del nuevo hook + `pageVariants` con slide direccional + ref wrapper interno. |
| `src/index.css` | BottomNav con `translateY` en lugar de `opacity` puro + curvas iOS. |

### Decisiones explícitas

**Swipe interactivo**:
- `transform: translate3d` aplicado directamente al ref via JS, **NO** vía setState. Si lo hiciera vía React state, los re-renders por frame harían 60+ commits/seg → jank.
- Threshold dual (distancia 30% O velocidad 550 px/seg) — uno solo es frágil. Apple usa ambos.
- `e.preventDefault()` solo después de decidir horizontal — no rompe scroll vertical.
- Animaciones de release con rAF + spring solver propio (no framer-motion para hot paths de gestos).

**BottomNav**:
- `translateY(100% + safe-area-inset-bottom)` — saca la barra del todo, no solo la opacity.
- `will-change: transform` para que iOS pre-pinte el layer.
- No usé `display: none` para no romper layout flow (el scroll del contenido principal no debe re-flowear cuando el teclado abre/cierra).

**Haptics**:
- `selectionTick()` en `useNativeSwipe.onHaptic` — feedback de "pasaste el threshold". Más sutil que `tap()`.
- `tap()` al confirmar el cambio de tab (commit).
- Decidido NO disparar haptic en snap-back fallido — sería ruidoso.

**Reduced motion**:
- `pageVariants` cae a opacity-fade plano si el user pidió reduced motion.
- El swipe sigue funcionando pero sin spring de release (jump directo). Si en futuro queremos desactivarlo del todo, agregar un check en el hook.

**Performance**:
- Spring solver es ~10 ops/frame en JS puro. Bajo consumo, no hay GC pressure (mismo objeto state se asigna).
- `cancelAnimationFrame` al desmontar/cancelar gesto.
- Listeners pasivos donde se puede; sólo `touchmove` con `passive: false` para preventDefault.

### Pruebas ejecutadas

- `node --test tests/native-swipe.test.js` → **12/12 ok**
- Suite completa: 94/94 ok.
- `npm run build` → 2.13s, sin warnings.
- Preview Vite dev → app limpia, **sin warnings de React** (corregido el conflicto de `ref` en `motion.div`).
- Verificación manual desde el preview en formato móvil → renderizado limpio.

### Lo que Martín debe probar manualmente en iPhone (smoke test 6.1)

**Críticos del swipe interactivo**:
- [ ] Iniciar drag horizontal lento → el contenido debe seguir al dedo en tiempo real (no esperar al release).
- [ ] Soltar antes del 30% del ancho → debe hacer snap-back con rebote suave.
- [ ] Soltar después del 30% → debe completar el cambio de tab con spring.
- [ ] Flick rápido (movimiento corto pero veloz) → debe completar también (threshold por velocidad).
- [ ] En Mi Día, deslizar a la derecha (no hay tab anterior) → rubber band, vuelve solo.
- [ ] En Ajustes, deslizar a la izquierda (no hay tab siguiente) → rubber band, vuelve solo.
- [ ] Sentir el haptic suave al cruzar el threshold antes de soltar.
- [ ] Sentir el haptic `tap` al confirmar el cambio.

**Críticos del teclado**:
- [ ] Tap en input de Mi Día → BottomNav se desliza hacia abajo (translateY), no solo desaparece.
- [ ] Cerrar teclado → BottomNav vuelve con la misma curva.

**Sin regresiones**:
- [ ] Tap normal en BottomNavBar (sin swipe) sigue cambiando de tab con haptic.
- [ ] Modales/sheets siguen abriendo/cerrando bien.
- [ ] Login/logout/Nova/demo intactos.

### Pendientes para próxima iteración

1. **Animación de transición coordinada con el commit del swipe** — hoy al soltar con commit, animamos el wrapper hasta el borde y luego framer-motion arranca su propia animación de slide. Hay un microsegundo de "doble animación". La solución sería suprimir la animación de framer-motion para tabs cambiados via swipe (el wrapper ya completó visualmente). Requiere comunicar el estado del swipe al motion.div padre.
2. **Edge swipe back desde sub-views** — `memory`, `nova-knows`, `task-detail` no tienen swipe-back, solo botón.
3. **Pull to dismiss** en sheets de Nova / Memory.
4. **Long press en tareas/eventos** — para acciones rápidas (eliminar, completar, mover).
5. **Drag to reorder** tareas — usable pero requiere lib o trabajo dedicado.
6. **Test del hook con renderer React** — el repo no tiene `@testing-library/react`. Cubrimos solo helpers puros y la matemática del spring.
7. **Tests para useKeyboardState** — necesitan jsdom para MutationObserver. Pendiente.

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
