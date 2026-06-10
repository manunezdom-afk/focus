# Nova — Cierre QA (2026-06-10)

Reporte de la tanda de cierre de Nova/Cael: diagnóstico de arquitectura, bugs
encontrados y corregidos, sistema de pruebas (batería de 200 casos), estado del
bug del teclado y veredicto honesto de readiness para TestFlight.

---

## 1. Resumen ejecutivo

**El hallazgo central:** casi todos los síntomas reportados (horas mal
interpretadas, "todo dura 1 hora", subtítulos perdidos, no distingue
evento/recordatorio/tarea, no responde "qué tengo hoy", no puede corregir ni
borrar) tenían UNA causa raíz común: **el provider de producción es OpenAI
(`gpt-5-mini`) y su contrato (`api/_lib/openaiNova.js`) era una versión
recortada del contrato Anthropic**:

| Capacidad | Prompt Anthropic (fallback) | Path OpenAI (producción) ANTES | AHORA |
|---|---|---|---|
| Reglas de duración | Tabla completa | **NADA** (schema exige `durationMinutes` → el modelo ponía 60 a todo) | Regla "0 salvo duración explícita" (orden de cierre: ni siquiera tipos obvios llevan término; la tabla centralizada solo aplica si el usuario pide bloquear tiempo) |
| Campo `subtitle` | Sí | **No existía** | Sí (schema + adapter + prompt con casos canónicos) |
| Tareas (`add_task`) | Sí | **No existía** ("comprar pan" → evento o reminder) | Sí (`create_task` → `add_task`) |
| Editar/borrar eventos | Sí (con id real) | **Imposible** ("cámbialo a las 6" no podía funcionar) | Sí (`edit_event`/`delete_event` con `targetEventId` validado) |
| Lista de eventos/tareas del usuario en el prompt | Sí | **No** (no podía responder "qué tengo hoy" ni evitar duplicados) | Sí |
| Tema en discusión (`discussedEventIds`) | Sí | No | Sí |
| Reglas de fechas/horas/franjas | Extensas | Mínimas | Extensas (hoy default, finde, "el 15", franjas, AM/PM por actividad, "tipo 5") |
| Continuidad conversacional | Regla 5b | No | Sección CONTINUIDAD con los casos del spec |
| Tono natural / anti-robótico | Reglas | Mínimo | Sección TONO con ejemplos buenos/prohibidos |
| Hora en recordatorios | Conservada | **Descartada** (`time=null` forzado) | Conservada |

El cliente iOS **no necesitó cambios de lógica**: ya decodifica `subtitle`,
`add_task`, `edit_event`, `delete_event` y `reminderOffsets` desde siempre
(`NovaService.swift`). El único cambio Swift es el fix de teclado (1 modificador,
ver §6).

---

## 2. Arquitectura (cómo fluye un mensaje)

```
Usuario escribe en NovaView / MiDiaView (iOS)
  → FocusDataStore.sendNovaMessage()
      → fast-path local (NovaResponder) si es trivial
      → NovaService.send() → POST /api/focus-assistant
            provider = OpenAI si OPENAI_API_KEY (prod), si no Anthropic
            ┌─ OpenAI: buildOpenAISystemPrompt (CON eventos/tareas/discussed)
            │     → gpt-5-mini Structured Outputs (NOVA_OPENAI_SCHEMA)
            │     → convertOpenAIToBackendResponse (valida ids, anti-basura,
            │       anti-contaminación, duración→endTime, subtitle, task)
            │     → filterCalendarEditActions (verbo explícito o se strippea)
            └─ Anthropic: Haiku → escala a Sonnet (complejo/clarificación/fallo)
      → iOS: NovaActionValidator → NovaActionNormalizer → FocusDataStore
        (gate: endTime del backend se ignora si el usuario no dijo duración)
      → si todo falla: parser local NovaResponder (heurístico, fallback)
```

Separación de responsabilidades tras esta tanda:

- **`api/_lib/durations.js` (NUEVO)** — única fuente de verdad de duraciones:
  tabla tipo→minutos, `inferDefaultDurationMinutes()`,
  `userMentionedExplicitDuration()`, `renderDurationTableForPrompt()`. Los DOS
  prompts (OpenAI y Anthropic) renderizan la tabla desde aquí. Cambiar una
  duración = una línea.
- **`openaiNova.js`** — schema + prompt + adapter (IntentClassifier +
  DateTimeResolver + DurationResolver + TitleSubtitleExtractor viven en el LLM
  guiado por el prompt; el adapter es la capa determinista testeable).
- **`calendarIntent.js`** — defensa de ediciones (ahora con correcciones
  conversacionales y formas acentuadas).
- **iOS NovaActionNormalizer** — sin cambios; sigue siendo la red local.

---

## 3. Bugs encontrados y corregidos

| # | Bug | Causa | Fix | Archivo |
|---|---|---|---|---|
| 1 | Todo evento dura 1 hora | Schema OpenAI exige `durationMinutes` sin ninguna regla en el prompt → modelo emitía 60 por defecto | Regla "sin duración explícita → 0/null SIEMPRE" en ambos prompts ("fútbol a las 5" y "doctor a las 11" quedan sin término); tabla centralizada en `durations.js` SOLO para pedidos de bloquear/reservar tiempo; eliminada la regla Anthropic que preguntaba "¿cuánto dura?" | `durations.js`, `openaiNova.js`, `systemPrompt.js` |
| 2 | Subtítulos no se separan del título | El contrato OpenAI no tenía campo `subtitle` | `subtitle` en schema + adapter + 5 casos canónicos del spec en el prompt | `openaiNova.js` |
| 3 | "tengo que llamar al médico" creaba evento con hora inventada | Sin `create_task` en el contrato OpenAI | `create_task` → `add_task` | `openaiNova.js` |
| 4 | "cámbialo a las 6" / "borra lo de fútbol" imposibles en producción | Sin edit/delete en el contrato OpenAI | `edit_event`/`delete_event` con `targetEventId` validado contra ids reales + red `filterCalendarEditActions` en el path OpenAI | `openaiNova.js`, `focus-assistant.js` |
| 5 | "qué tengo hoy" no podía responderse / duplicados / reminders sin ancla | El prompt OpenAI no recibía eventos, tareas ni `discussedEventIds` | Se inyectan al prompt (cap 80 eventos / 50 tareas) | `focus-assistant.js`, `openaiNova.js` |
| 6 | "acuérdame comprar pan a las 6" perdía la hora | Adapter forzaba `time=null` en reminders ("intencional" mal decidido) | Reminders conservan hora; `endTime` sigue null | `openaiNova.js` + test actualizado |
| 7 | "mañana reunión a las 10" se descartaba entera | Defensa anti-genéricos no distinguía título alucinado de título literal del usuario | Genérico de 1 palabra se permite si el usuario lo dijo literalmente | `openaiNova.js` |
| 8 | "cámbialo"/"muévelo" (con tilde) no contaban como intención de edición | Regex sin vocal acentuada en la raíz (`\bcambi`, `\bmuev`) | `c[aá]mbi`, `mu[eé]v` | `calendarIntent.js` |
| 9 | "mejor no", "ponlo una hora antes", "mejor mañana", "olvida eso" se strippeaban como ediciones no pedidas | Verbos de corrección conversacional fuera de la lista | Patrones de corrección agregados | `calendarIntent.js` |
| 10 | Continuaciones ("cambia lo de fútbol" → "¿a qué hora?" → "a las 6") perdían la intención de edición | El filtro solo miraba el mensaje actual | El scope del filtro incluye el último turno del usuario | `focus-assistant.js` |
| 11 | Horas ambiguas con actividad obvia bloqueaban en clarification ("fútbol a las 5") | Regla Anthropic demasiado agresiva | Resolver por tipo de actividad + confirmar en el reply; preguntar solo si ambas lecturas son igual de probables | `systemPrompt.js` |
| 12 | Teclado pegado en chat de Nova | Sin gesto alguno de cierre (ver §6) | `.scrollDismissesKeyboard(.interactively)` | `NovaView.swift` |
| 13 | Tabla de duraciones duplicada (prompt Anthropic) y ausente (OpenAI) | Reglas repartidas | Única fuente `durations.js` | ambos prompts |

---

## 4. Resultados de tests (ejecutados de verdad en esta tanda)

```
node --test tests/*.test.js   (npm run test:unit)
# tests 167  pass 167  fail 0
```

Incluye:
- **`tests/nova-qa-closure.test.js` (NUEVO, 34 tests)** — duraciones
  centralizadas (tabla, inferencia, detección de duración explícita con los
  casos D31-D40 del spec), subtitle en schema/adapter, `create_task`,
  edit/delete con id real e id inventado, reminders con hora, multi-acción,
  contenido del prompt (tabla, tono, continuidad, hipotéticos, fechas),
  correcciones conversacionales.
- **`tests/openai-nova-adapter.test.js` (actualizado)** — 2 tests corregidos
  con justificación (bug #6 y #7).
- **`tests/nova-battery.test.js` (NUEVO)** — valida la integridad de los 200
  casos de la batería (ids únicos, expectativas con keys conocidas, 15
  categorías del spec + ≥50 extra, historiales bien formados).
- Resto de la suite preexistente (133 tests) sin regresiones.

## 5. Batería de 200 casos (150 del spec + 50 extra)

- **Casos:** `tests/nova-battery/cases.json` — los 150 del spec (A-O) más 50
  extra (typos, chileno informal, franjas, duraciones, multi, no-crear,
  contexto multi-turno con eventos seed).
- **Runner:** `scripts/run-nova-battery.mjs` — ejecuta cada caso contra el
  pipeline REAL de producción (prompt → gpt-5-mini → adapter → defensas) y
  evalúa intención, tipo, título, subtítulo, fecha, hora, duración, ids de
  edición, tono no-robótico y "no creó nada cuando no correspondía". Genera
  `docs/NOVA_BATTERY_REPORT.md` con la tabla Test ID / Input / Esperado /
  Real / Pass-Fail / Notas.

```bash
OPENAI_API_KEY=sk-... npm run nova:battery          # 200 casos
OPENAI_API_KEY=sk-... node scripts/run-nova-battery.mjs --cat multi
OPENAI_API_KEY=sk-... node scripts/run-nova-battery.mjs --only A1,O144
```

> **PENDIENTE DE EJECUCIÓN EN VIVO:** este contenedor no tiene
> `OPENAI_API_KEY` y la política de red bloquea `api.openai.com`, así que la
> batería quedó lista pero NO ejecutada contra el modelo real. Correrla toma
> ~10-15 min y un par de dólares de API. Es el primer paso al retomar.

## 6. Bug del teclado — diagnóstico y fix

**Síntoma:** en el chat de Nova el teclado queda "pegado" (abierto, sin forma
de cerrarlo).

**Causa raíz (verificada en código, `NovaView.swift` + `NovaChatComponents.swift`):**
1. El toolbar "Listo" del teclado se eliminó a propósito (tapaba los botones
   mic/send del composer) — comentario en `NovaChatComponents.swift:643-647`.
2. El plan B era "tocar fuera del input": el `onTapGesture` con
   `resignFirstResponder` vive en `NovaChatBackdrop` (`NovaView.swift:494-497`),
   pero el backdrop está DEBAJO del `ScrollView` del chat en el `ZStack`. Con
   mensajes en pantalla, el ScrollView intercepta todos los taps → el gesto
   solo funcionaba en el estado vacío (hero).
3. El plan C era "hacer scroll cierra el teclado", pero **no existía ningún
   `.scrollDismissesKeyboard` en el proyecto** (el default de SwiftUI no
   cierra el teclado al scrollear en este contexto).

Conclusión: con ≥1 mensaje en el chat no existía NINGÚN gesto para cerrar el
teclado.

**Fix aplicado (1 modificador, aditivo, sin tocar lógica):**
`.scrollDismissesKeyboard(.immediately)` en el `ScrollView` del chat
(`NovaView.swift`, `chatScroll`) — arrastrar el chat hacia abajo cierra el
teclado.

**Por qué `.immediately` y no `.interactively`:** el composer de Nova NO usa
el keyboard avoidance nativo de SwiftUI — usa tracking MANUAL
(`keyboardOverlap` vía `keyboardWillShow/Hide` + `.padding(.bottom,
keyboardOverlap)` + `.ignoresSafeArea(.keyboard)` en el VStack root,
`NovaView.swift:38-107`), workaround documentado de un bug de iOS 26.4 donde
el avoidance nativo dejaba el composer detrás del teclado. Con un dismiss
interactivo, el padding manual quedaría desincronizado del frame real del
teclado durante el drag (hueco fantasma bajo el composer). `.immediately`
dispara un `keyboardWillHide` discreto y el padding anima a 0 en sincronía.

**Auditoría del resto del flujo de teclado (punto 7 de la orden):**
- Listeners: UN solo par willShow/willHide en NovaView (el de MainTabView es
  para ocultar el tab bar, no conflictúa). Sin listeners duplicados.
- Padding fantasma: `keyboardWillHide` resetea `keyboardOverlap = 0` siempre
  → no queda padding residual tras cerrar.
- Doble-avoidance: `.ignoresSafeArea(.keyboard)` en el VStack root desactiva
  el avoidance nativo para todo el subtree → el padding manual es la única
  fuente de elevación, sin sumarse dos mecanismos.
- Dictado/micrófono: `audioLevel` (≈14 fps) re-renderiza el input bar pero
  `@FocusState` sobrevive recomputaciones de body; no es la causa del bug.
  Si en simulador se observa jank DURANTE dictado, subir el throttling en
  `NovaLiveService.swift:439` (`% 3` → `% 6`).

**Verificación pendiente en simulador** (no hay Xcode en este entorno):
abrir chat con mensajes → tocar input → escribir/enviar → arrastrar el
scroll hacia abajo (teclado debe bajar y el composer asentarse sin hueco) →
reabrir/cerrar repetidas veces → activar micrófono y volver a escribir →
cambiar de pestaña y volver.

(El diagnóstico alternativo "audioLevel re-renderiza el input bar y resetea
`@FocusState`" se investigó y se descartó como causa principal: `@FocusState`
sobrevive recomputaciones de `body` mientras la identidad de la vista no
cambie. Si tras el fix el teclado sigue dando problemas **durante dictado**,
revisar el throttling de `audioLevel` en `NovaLiveService.swift:439`.)

## 7. Tests manuales obligatorios en simulador (pendientes — checklist)

No ejecutables en este entorno (Linux, sin Xcode/simulador). Checklist para
la primera sesión en Mac — los 20 del spec:

| # | Caso | Verificar |
|---|---|---|
| 1 | "fútbol a las 5 acuérdame llevar la pelota" | Evento Fútbol 5 PM, detalle "Llevar la pelota" visible bajo el título |
| 2 | "reunión a las 8 de mindfulness" | Título "Reunión", subtítulo "Mindfulness" |
| 3 | "dentista mañana a las 11 llevar radiografía" | Mañana 11 AM + subtítulo |
| 4 | "estudiar publicidad hoy a las 7 por media hora" | 7 PM, rango de 30 min (no 1 h) |
| 5 | "gym mañana pierna a las 6" | Título "Gym", subtítulo "Pierna" |
| 6 | "mañana tengo psicólogo online a las 12" | Mañana 12 PM |
| 7 | "acuérdame comprar pan en 20 minutos" | Recordatorio ahora+20, CON hora, notificación programada |
| 8 | "hoy a las 5 fútbol y después estudiar Focus" | Dos elementos (o fútbol + pregunta por hora de estudiar) |
| 9 | "tengo dentista mañana" → "a las 11" | Mantiene contexto, crea Dentista mañana 11 AM |
| 10 | "ponme reunión mañana" → "a las 8 de mindfulness" | Contexto + subtítulo |
| 11 | "no sé cómo ordenar mi día" | Conversación útil, NO crea nada |
| 12 | "estoy cansado, qué hago primero" | Conversación con su agenda real |
| 13 | "quizás mañana vaya al gym" | NO crea nada |
| 14 | "qué opinas si estudio a las 7" | NO crea nada |
| 15 | "mañana clase a las 10, trabajo a las 3 y llamar a mi mamá en la noche" | 3 elementos |
| 16 | "reunion manana alas 8" | Tolera typos |
| 17 | "futbol alas 5 llevar pelota" | Typos + subtítulo |
| 18 | "tipo 7 hago gym" | Gym 7 PM |
| 19 | "mañana en la tarde tengo que estudiar" | Tarea o pregunta de hora — NO evento con hora inventada |
| 20 | "cambia eso a las 6" tras crear algo | edit_event del evento recién creado (id real) |
| + | Teclado | Con mensajes en el chat, arrastrar hacia abajo cierra el teclado |
| + | Tests Swift | En Xcode/LLDB: `po NovaActionNormalizerTests.runAll()` → "ALL TESTS PASSED" |

## 8. Limitaciones conocidas / qué queda pendiente

1. **Batería en vivo sin ejecutar** (sin API key ni red en este entorno) —
   `npm run nova:battery` al retomar; iterar el prompt con los fails que salgan.
2. **Recurrencia por el path OpenAI**: el contrato OpenAI NO tiene
   `add_recurring_event`. "todos los lunes gym a las 8" en producción crea (en
   el mejor caso) un evento único. Soluciones posibles: agregar el type al
   schema OpenAI, o rutear frases recurrentes al provider Anthropic. **No se
   abordó en esta tanda** para no agrandar el blast radius.
3. **"cambia el subtítulo a pierna"**: `BackendEventUpdates` de iOS no tiene
   campo `subtitle`, así que editar SOLO el subtítulo requiere un cambio Swift
   (decoder + applyUpdates). Documentado, no implementado (sin compilador aquí).
4. **edit_event desde OpenAI no renombra títulos** — decisión deliberada (un
   rename accidental es peor); se puede habilitar después con un campo
   `newTitle` explícito.
5. **App sin compilar en esta tanda**: el entorno es Linux sin toolchain Swift.
   El único cambio Swift es el modificador del teclado (§6) — bajo riesgo,
   pero **compilar antes de subir build** (`xcodebuild -scheme Focus …`).
6. Los tests Swift existentes (`NovaActionNormalizerTests.runAll()`, ~400
   checks) siguen siendo LLDB-only; mover a un target XCTest real es deuda.

## 9. ¿Listo para TestFlight?

**Todavía no — faltan 3 verificaciones, todas mecánicas:**

1. Compilar la app en Xcode (cambio Swift de 1 línea, riesgo bajo pero no
   verificado aquí) + `po NovaActionNormalizerTests.runAll()`.
2. Correr la batería en vivo (`npm run nova:battery`) y revisar el reporte —
   el prompt nuevo está testeado en contenido pero no contra el modelo real.
3. Los 20 casos manuales del §7 en simulador (en particular #4 duración, #20
   edición, y el teclado).

El backend puede deployarse antes que el build iOS: los cambios son
retrocompatibles (el cliente actual ya decodifica todos los action types y el
campo `subtitle`; los campos nuevos del schema son aditivos).
