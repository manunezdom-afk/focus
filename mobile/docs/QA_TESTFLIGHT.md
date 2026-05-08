# QA matrix pre-TestFlight

Matriz de pruebas manuales que **debe pasar al 100%** antes de hacer Archive y subir a TestFlight Internal.

Tiempo estimado: 20-25 minutos en iPhone físico (build Release recomendado, pero Debug acepta).

---

## Cómo correr build Release

1. Abrir `mobile/ios/Focus.xcworkspace` en Xcode (NUNCA `.xcodeproj`).
2. Top bar → click en "Focus" (junto al device selector) → **Edit Scheme…** (⌘<).
3. Sidebar **Run** → tab **Info** → **Build Configuration** → cambiar `Debug` a **`Release`**. Cerrar.
4. iPhone conectado y desbloqueado → ⌘R.
5. Build optimizada (Hermes JIT). Tarda 2-4 min cold. Metro NO se conecta — la app corre 100% nativa.
6. Cuando termine: probar la matriz abajo.
7. Para volver a Debug: ⌘< → `Release` → `Debug` → ⌘R.

---

## Matriz de pruebas

| # | Flow | Pasos | OK si |
|---|---|---|---|
| 1 | Cold start | Cerrar app completa (swipe up). Tap Focus icon. | <3s al primer paint. Splash → tabs sin red screen. |
| 2 | Login persistente | Abrir app con sesión activa. | Mi Día renderiza datos reales sin login. |
| 3 | Navegación bottom nav | Tap cada tab (Mi Día → Calendario → Nova → Tareas → Ajustes). | Todas cambian sin red screen ni lag visible. |
| 4 | Swipe entre tabs | Swipe horizontal en cualquier tab. | Tab adjacente aparece con spring suave. |
| 5 | Mi Día empty | Día sin eventos ni tareas pendientes. | EmptyDayState con 3 chips. Halo sutil (no domina). |
| 6 | Mi Día con eventos | Abrir Mi Día con ≥1 evento existente. | Bloques proporcionados. NextBlockCard si hay timed events. |
| 7 | Toggle done | Tap checkbox de un bloque. | Solo ese bloque cambia (sin re-render visible de otros). |
| 8 | Borrar evento (Mi Día) | Trash icon → "Eliminar". | Desaparece. Si error: ErrorBanner. |
| 9 | Calendario cambiar día | DayPicker → tap día con eventos. | Eventos del día correctos. |
| 10 | Calendario crear evento | "+" → llenar form → submit. | Aparece en Calendario. Si es hoy: también en Mi Día. |
| 11 | Calendario vista Mes | Toggle pill "Mes". | Grilla 6×7 navegable. selectedDate en primary. |
| 12 | Calendario vista Semana | Toggle pill "Semana". | Lista 7 días con eventos resumidos. |
| 13 | Nova prompt simple | "agenda dentista mañana 10am" en Nova. | Crea evento mañana 10:00 AM. Confirma con título correcto. |
| 14 | Nova hora-sin-fecha | "a las 3 ir a buscar a mi hermano" en Nova. | **Crea evento HOY 3:00 PM**. NO edita un evento viejo. |
| 15 | Nova edit explícito | "mueve gym a las 8". | Edit_event aplicado al gym de hoy. Sin crear duplicado. |
| 16 | Nova edit sin verbo | (con un evento "Llamar a mamá" en agenda) "llamar a mamá hoy a las 5". | Crea NUEVO evento hoy 5pm. NO mueve el existente. |
| 17 | Nova destructivo | "borra el dentista". | Pide confirmación con Alert antes de eliminar. |
| 18 | Tareas crear | Composer en bucket Hoy → escribir → "Añadir". | Aparece arriba en lista. Flash chip "Añadidas N" tras múltiples adds. |
| 19 | Tareas completar | Tap círculo de tarea. | Strikethrough + opacity reducida. |
| 20 | Tareas borrar | Long-press tarea → "Borrar". | Confirmar → desaparece. |
| 21 | Tareas bulk defer | "Seleccionar varias" → tap 3 tareas → "Mover a Esta semana". | Las 3 cambian de bucket. |
| 22 | Tareas due_date | Tarea → long-press → detail → chip "Mañana" → Guardar. | Aparece en bucket "Próximas" con fecha. |
| 23 | Tareas prefill Nova | EmptyState → "Organizar con Nova". | Navega a Nova con prompt prellenado. |
| 24 | Ajustes cuenta | Abrir Ajustes. | Avatar con inicial del email + status verde "Sesión activa". |
| 25 | Ajustes plan beta | Sección "Plan". | Badge verde "BETA · ILIMITADO". Descripción honesta. |
| 26 | Ajustes apariencia oscuro | Apariencia → Oscuro. | Toda la app cambia. Persiste tras kill app. |
| 27 | Ajustes apariencia sistema | Apariencia → Sistema. | Sigue al modo del iPhone (Settings → Display). |
| 28 | Logout | Cerrar sesión → confirmar Alert. | Redirige a /(auth)/login limpiamente. Sin warnings. |
| 29 | Migration Mirror dev-only | (Solo Debug build) Ajustes → Migration Mirror. | Carga la web legacy en LAN. **En Release: NO debe aparecer la sección Desarrollo.** |
| 30 | Cold start con sin red | Activar Airplane Mode + cerrar/reabrir app. | Splash + tabs visibles. Banners de error con Reintentar. Sin red screen. |

---

## QA Mic (FASE 4 explícito)

| # | Test | Pasos | OK si |
|---|---|---|---|
| M1 | Mic visible Nova screen | Abrir tab Nova. | Botón mic gris aparece entre cámara y send. |
| M2 | Mic visible mini Nova | Mi Día / Calendar / Tareas → barra Nova abajo. | Botón mic gris entre input y send. |
| M3 | Permiso primera vez | Tap mic en estado "undetermined". | iOS muestra 2 sheets (mic + speech recognition). Tap "Permitir" en ambos. |
| M4 | Estado "Escuchando" | Tras permiso granted, mic ya en listening. | Botón se vuelve **rojo con check blanco**. Texto del input: vacío o pre-existente. |
| M5 | Dictar y soltar | Decir "agenda gym mañana siete am". Tap mic otra vez. | Texto aparece en input: "agenda gym mañana siete am" o similar. |
| M6 | Cancelar dictado | Mic listening → tap mic. | Vuelve a idle gris. NO envía a Nova. |
| M7 | Permiso denegado | Settings iOS → Focus → Speech Recognition: OFF. Volver a app → tap mic. | Alert "Activa el micrófono en Ajustes para dictarle a Nova" con CTA "Abrir Ajustes". |
| M8 | Mic en Release sin crash | Build Release → tap mic una vez. | **NO crashea**. Permission flow funciona idéntico que en Debug. |
| M9 | Mic durante envío | Tap mic mientras send está pending. | NO hay race condition. Mic no se activa O se activa después del send. |
| M10 | Texto largo | Dictar frase de >20 palabras. | Texto completo aparece. iOS Speech maneja la duración. |

---

## Estados visuales por scheme

| Pantalla | Light OK | Dark OK |
|---|---|---|
| Mi Día | Halo sutil indigo, fondo claro | Halo más sutil, fondo dark surface |
| Calendario | Toggle pills sobre surfaceMuted | toggle pills bg dinámico ok |
| Nova | Composer translúcido sobre fondo | Adaptado |
| Tareas | Cards con border + shadow leve | Cards en surface dark |
| Ajustes | Hero halo sutil | Mismo, opacity 0.22 |
| Detail sheets | Danger color OK | Danger usa `c.danger` ('#ef4444' brillante en dark) |

---

## Bloqueos para abortar el upload a TestFlight

Si **cualquiera** de estos falla, NO subir build. Arreglar antes:

- ❌ Red screen al cambiar entre tabs.
- ❌ Crash al tap mic en Release (probable falta de NSSpeechRecognitionUsageDescription).
- ❌ Nova interpreta "a las 3 X" como edit_event de evento viejo.
- ❌ Logout deja la app en estado limbo (sesión persistente sin redirect).
- ❌ Apariencia oscuro deja pantallas blancas (color hardcoded sin theme).
- ❌ Migration Mirror visible en Release.
- ❌ Cold start con red caída tira el splash infinito.

---

## Aceptación final

Para considerar que la app pasa QA y está lista para Archive:

- ✅ Los 30 tests de la matriz general pasan.
- ✅ Los 10 tests de mic pasan.
- ✅ No hay bloqueos de la lista anterior.
- ✅ Performance subjetivo: ningún flow se siente <30 FPS.
- ✅ Ningún error en Xcode console que sea consistent (warnings ok, errors no).

Reportar al final: cuántos tests pasaron / cuántos fallaron / cuál fue el flow más problemático. Con eso decidimos si hace falta otra fase de fixes o si vamos directo a Archive.
