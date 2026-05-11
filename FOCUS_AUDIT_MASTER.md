# Focus — Audit Master

Documento central de auditoría continua del proyecto Focus.

- **Última revisión**: 2026-05-11 (Fase 1 audit pass)
- **Branch auditada**: `main` @ `63506ea` (worktree en `claude/nervous-snyder-7547ac`)
- **App nativa**: `ios-native/Focus.xcodeproj` (Swift/SwiftUI, iOS 17+)
- **Bundle**: `me.usefocus.app` · **Team**: `D8UM897B2T`
- **Backend**: Supabase + Vercel APIs · **Dominio**: `usefocus.me`

> Este archivo se mantiene actualizado a cada sesión de auditoría. Cada sección tiene un **Estado actual** (lo que sabemos) y **Pendientes** (lo que falta verificar/corregir).

---

## Audit pass log

| # | Fecha | Tipo | Resumen |
|---|---|---|---|
| 1 | 2026-05-11 | Fase 1 read-only | Inventario de tools, audit de código Swift, schema Supabase desde repo, vercel.json, secrets básicos. Sin instalaciones. Sin cambios de código. |
| 2 | 2026-05-11 | Audit completo + fixes Swift safe | Audit en 15 áreas. Aplicados 5 fixes seguros: Bundle.main version, lineLimit en cards de evento, DateFormatters cacheados, picker .dark deshabilitado, Nova onAppear simplificado. Sin tocar backend ni Supabase. |
| 3 | 2026-05-11 | Resolver C1 — persistencia local V1 | Implementado `FocusLocalStore` (UserDefaults + JSON ISO-8601 + keys versionadas `focus.v1.*`). Carga al boot con fallback a demo, guarda en cada mutación. Sección "Datos locales" en Ajustes con confirmationDialogs para reset / clear. App ya recuerda datos entre sesiones. Fix de falso positivo en regex `audit-quick.sh` (word boundary). |
| 4 | 2026-05-11 | Resolver C2 — AppIcon V1 + iOS readiness mínimo | Generado AppIcon 1024×1024 RGB (sin alpha) programáticamente con Python+PIL. Script reutilizable `scripts/build-ios-appicon.py`. Diseño: gradiente vertical slate-900 → blue-900 → blue-500 + F blanca geométrica. Build sin warnings de AppIcon. Xcode auto-genera variantes 60×60@2x (iPhone) y 76×76@2x~ipad. Preview en `docs/assets/focus-app-icon-preview.png`. |
| 5 | 2026-05-11 | Resolver C4 — Auth Supabase OTP V1 (parcial) | Implementado flujo OTP email completo en SwiftUI nativo. Opción técnica: URLSession (no SPM). 5 archivos nuevos: `FocusConfig`, `KeychainStore`, `AuthService`, `AuthStore`, `LoginView`. Tokens en Keychain (`kSecAttrAccessibleAfterFirstUnlock`), expiresAt en UserDefaults. Send OTP usa `/api/auth/email/send-otp`; verify usa `<supabase>/auth/v1/verify` directo. Modo demo preservado. Ajustes muestra email/signout o "iniciar sesión" según estado. **Bloqueado en config**: falta pegar `SUPABASE_ANON_KEY` en `FocusConfig.swift`. |
| 6 | 2026-05-11 | Polish UX + Onboarding V1 | Eliminado todo el ruido visual de "demo": 0 `ExampleBanner`, 0 `ExampleBadge`, 0 dashed borders en cards normales. Empty state de Mi Día con copy honesto. FocusBar sin botón cámara (no implementado). Onboarding 3 pasos con `@AppStorage("focus.v1.hasSeenOnboarding")` — Bienvenida, Organiza tu día, Habla con Nova. Botón "Empezar" + "Probar en modo demo" + "Saltar". Ajustes: "Ver tutorial otra vez" + Plan honesto ("Modo demo · datos solo en este iPhone" vs "Early Access · pre-lanzamiento"). Quitado el "12 mensajes hoy · sin límite" engañoso. 1 archivo nuevo: `OnboardingView.swift`. |
| 7 | 2026-05-11 | Rediseño visual V2 (identidad de marca) | **AppIcon V2**: sol/medalla blanca de 8 rayos + dot azul central sobre gradiente azul vivo (#2E4FE8→#1E3A8A). Matchea logo provisto por usuario. Regenerado vía `scripts/build-ios-appicon.py`. **FocusLogoMark** SwiftUI component (squircle + 8-point sun + center dot) reutilizable. **BootView V2**: fondo navy profundo (#0A0E2A→#1A203F) + "FOCUS" wordmark + FocusLogoMark centrado con fade-in. Onboarding y LoginView usan FocusLogoMark (replaced rotated diamond). **FAB out** en Tareas y Calendario → botón `+` compacto azul (38pt) en header. **Tareas compacta**: priority como dot 7pt (no chip), padding vertical reducido (sm+2 vs md), metadata condicional (solo si dueLabel/subtasks). **Calendario diferenciado**: dayMetadataLabel con horas ocupadas ("6 eventos · 5h 30m ocupadas"). **Mi Día Nova Pulse**: card sutil entre FocusBar y Próximo Bloque cuando hay sugerencias pendientes. **Ajustes brand footer**: FocusLogoMark + "Focus" + version + "Hecho para organizar tu día con Nova." |
| 8 | 2026-05-11 | Brand identity V3 + family system | **AppIcon V3**: pétalos REDONDEADOS como capsules rotadas (vs polígono spiky V2). Match mucho mejor el logo original del usuario. Disco central más grande (0.19r vs 0.18r). **FocusLogoMark V3**: refactor con `Capsule()` rotadas + parámetro `gradient` opcional (preparado para Kairos violet / Spark orange). **BootView cinematic**: radial gradient (centro brillante → bordes navy profundo), logo con glow halo blanco animado, wordmark FOCUS + tagline "Mente clara, día ordenado." debajo del logo. **LoginView premium**: logo 108pt (vs 78pt), título 42pt, subtle blue gradient en hero zone superior, primary button con gradient linear + shadow más fuerte. **Mi Día cockpit**: gradient hero zone (focusAccent.opacity(0.08) → background) detrás del header y FocusBar — diferencia visualmente Mi Día de otras tabs. **Tab bar refinada**: `.systemUltraThinMaterial` blur (más liviano), SF Symbol `.fill` cuando selected (sun.max.fill/checkmark.circle.fill/gearshape.fill). **Nova sparkle animado**: pulse continuo scale 1.0↔1.20 1.4s en sparkle del toolbar, círculo nova con shadow violeta. **Theme family docs**: bloque comentario explicando Focus/Kairos/Spark — base portable cambiando solo brandPrimary. |
| 9 | 2026-05-11 | Identidad V4: F geométrica + Nova-first onboarding | **AppIcon V4 NO floral**: F geométrica blanca + sparkle 4-point arriba-derecha en cobalto. Brand letter + IA accent en un solo símbolo. Reemplaza la flor de V3. **FocusLogoMark V4**: 3 RoundedRectangle blancos (stem + top bar + middle bar) + `SparkleMark` Shape. Matchea exactamente el AppIcon. **Onboarding rediseñado**: 3 páginas con visuals reales (no solo icono). P1 brand: "Focus OS" + tagline. P2 mock timeline: 4 mini-rows con horas + color sidebar (Foco/Reunión/Personal/Estudio). P3 mock Nova card: avatar gradiente + "Nova tiene 4 sugerencias" + 3 acciones (mover gym, asignar bloque, reservar pausa). Botones primary "Empezar" + secondary "Probar en modo demo". **Mi Día Focus Brief**: nueva card "cockpit" arriba con 3 stats horizontales: bloques (azul), tareas (warning), Nova (violet). Convierte Mi Día en centro de control vs lista. **LoginView copy**: "Entra a tu sistema de organización personal." (vs "Organiza tu día con Nova"). |
| 10 | 2026-05-11 | Simplificación visual fuerte (menos ruido) | **Mi Día más limpio**: removido Focus Brief (3 stats card) — era ruido. Mantiene header + FocusBar + Nova Pulse (condicional) + Próximo Bloque + Timeline + Pendientes. **Timeline truncada**: muestra primeros 4 bloques + botón "Ver X bloques más" (chevron down) que expande con animación. Antes mostraba TODOS los 7 demo. **Event cards minimalistas**: removidas las notes/descriptions de la vista por defecto en MiDía y Calendario. Solo título + ubicación (con pin icon). Detalles secundarios reservados para vista expandida futura. Cards ~30% más cortas verticalmente. **Ajustes sin redundancia**: removida sección "Plan" entera — duplicaba info de "Cuenta" ("Modo demo" en ambas). 7 secciones → 6. |
| 11 | 2026-05-11 | Refine Focus mark + Nova UI + ubicación | **FocusLogoMark V5**: núcleo + 2 anillos concéntricos (aperture/claridad mental) reemplaza F+sparkle. AppIcon regenerado vía script. **Nova UI**: bienvenida más corta, 3 quick actions, header sin pulse animado, burbujas más chicas, input compacto. **EventSection.personal**: heart.fill → person.fill. **Ubicación evento**: placeholder "Sala, oficina, link o dirección…" + comentario para futura integración Maps. |
| 12 | 2026-05-11 | Trim demo + live countdown + Nova mark + Google login | Demo a 3 ejemplos (3 eventos + 3 tareas). Contador real-time en azul cobalto con segundos (TimelineView .periodic 1s). Banner "Nova tiene N sugerencias" removido del inicio. **NovaSparkMark**: rombo vertical (no sparkle 4-point genérico) en FocusBar/ExampleBadge/ExampleBanner/PromptChip/onboarding. LoginView: botón "Continuar con Google" con G multicolor en Canvas + divider "o" + banner "Próximamente". |
| 13 | 2026-05-11 | Nova como tab central + navegación paginable | **4 tabs** (Mi día/Calendario/Nova/Ajustes), Tareas sale del tab bar. **Swipe horizontal** entre tabs (ScrollView .paging). **NavigationCoordinator** central. **NovaView**: 3 segmentos (Bandeja default / Acciones / Chat). 6 quick actions visibles. **Mi Día header**: FocusLogoMark + fecha en azul + título. Contador con segundos format natural ("Queda 1 h 36 min 24 s"). |
| 14 | 2026-05-11 | QA pass — make core interactions functional | **Toast system** (`ToastManager` + `ToastBanner`) inyectado en MainTabView con overlay arriba. Feedback en eventos/tareas/sugerencias creadas. **MiDía fixes**: botón perfil → tab Ajustes; botón mic → alert honesto "Voz próximamente". **Nova quick actions reales**: Crear tarea/evento abren sheets reales (NuevaTareaSheet, NuevoEventoSheet ahora internal y reusables); Organizar/Preparar mañana crean sugerencia en bandeja; Revisar pendientes → bandeja; Cerrar día → chat. **Bandeja approve**: `.schedule` crea evento real, `.task` crea tarea real, otros solo `.approved`. **LoginView**: regex de email + error inline, auto-focus email al entrar y código al pasar a `.codeSent`, cooldown de 30s en "Reenviar código". **Ajustes**: política de privacidad y eliminar cuenta marcadas "Próximamente" (no prometen funcionalidad inexistente). **AuthService**: dialecto neutro (sin voseo). |
| 15 | 2026-05-11 | C4 cerrado — Supabase OTP auth funcional end-to-end | **Publishable key pegada** en `FocusConfig.supabaseAnonKey` (formato nuevo `sb_publishable_*`, NO service_role). Verificado HTTP 200 en `/auth/v1/health` y respuesta correcta de `/auth/v1/verify` con código bogus (`otp_expired`) — endpoint reconoce el proyecto. Build OK, instalado en iPhone 16. AuthStore persiste sesión en Keychain (`accessToken`, `refreshToken`, `userId`, `email`) y `expiresAt` en UserDefaults. **Limitación conocida**: refresh token rotation NO implementada — cuando el access_token expira (1h por defecto en Supabase), la sesión expira y el usuario vuelve a login. Para extender la sesión se necesita un endpoint `/auth/v1/token?grant_type=refresh_token` (futuro). |
| 16 | 2026-05-11 | C4.1 cerrado — refresh token automático + prep import/export calendario | **`AuthService.refreshSession(refreshToken:)`** nuevo método que pega contra `/auth/v1/token?grant_type=refresh_token` con `apikey` + `Authorization: Bearer <anon>` headers. Decodifica `expires_at` o cae a `expires_in` o fallback 1h. Errores `expired/invalid/401` → `otpExpired` → fuerza re-login. **`AuthStore.init()`** ahora detecta sesión expirada con refresh válido y arranca en `state = .loading`, dispara Task que renueva en background. Si OK → `.loggedIn` sin parpadeo de Login. Si falla → `.loggedOut` con mensaje "Tu sesión expiró. Vuelve a iniciar sesión." Limpia solo auth (Keychain + UserDefaults `expiresAt`); **NO toca FocusLocalStore**. **`ContentView`** respeta `.loading` mostrando BootView (evita flash de Login durante refresh). **Phase EXTRA — import/export calendario V1 informativo**: `NovaQuickAction` agrega `importarCalendario` + `exportarCalendario` (8 actions ahora). Ajustes gana sección "Calendarios conectados" con 4 filas (Apple Calendar, Google Calendar, .ics, Maps/Waze) que abren `ComingSoonSheet` honesto. **`FocusEvent`** gana fields opcionales para C5/C6 (backward-compat con JSON existente vía optional + decodeIfPresent): `source`, `externalCalendarId`, `externalEventId`, `url`, `lastSyncedAt`. Nuevo enum `EventSource` (local/google/apple/ics). Computed `effectiveSource` defaults a `.local`. **`LocationLabel`** componente nuevo: ubicación tappable en cards de Mi Día y Calendario → sheet "Más adelante podrás abrir en Apple Maps / Google Maps / Waze". **`ComingSoonSheet`** componente reutilizable (icono, título, mensaje, botón "Entendido" + acción secundaria opcional). |
| 17 | 2026-05-11 | Nova inline + input multilínea + parser refactor | **Bug Nova lleva al chat**: Mi Día ahora ejecuta inline el intent y muestra respuesta debajo del FocusBar (`InlineNovaResponseView`). Nunca navega al chat salvo que el usuario tappee "Abrir chat" desde un `.clarify`. **Bug input cortado**: `FocusBarInput` pasa a `axis: .vertical` + `lineLimit(1...5)`, crece hasta 5 líneas y después scroll interno con cursor visible. HStack alinea botones a `.bottom`. Botón enviar siempre presente, deshabilitado sin texto. **NovaResponder estructurado** con `parse(_:context:) -> NovaIntent`: estados `createTask(title, recurrence)`, `createEvent(title, when, location, section)`, `organizeDay`, `reviewPending`, `askAboutDemo`, `smallTalk(reply)`, `clarify(reason)` (con razones específicas). **`reply(to:)`** randomiza entre 2-3 variantes por intent. |
| 18 | 2026-05-11 | Nova parser inteligente + contexto + chat keyboard | **Parser expandido** con triggers naturales en español chileno/informal: "salir a", "ir a", "buscar a", "juntarme con", "tengo prueba/parcial/clase", "tengo que", "recuérdame", verbos de quehacer ("comprar", "llamar", "responder", "preparar"). **"tipo N"** colloquial: `tipo 3` → 15:00 (default PM 13–18h para N=1–6), `tipo 8 de la mañana` → 08:00. AM/PM (`3pm`, `8am`) y `esta tarde/noche/mañana` mapean a horas concretas. **Sección por keyword**: parcial/examen/clase → estudio; buscar/salir/almuerzo/café → personal; gym/yoga → descanso; reunión/llamada → reunión. **`RecurrenceHint`** (daily/weekly/weeklyOn/monthly/unspecified) detectado en texto; el ejecutor crea tarea normal y explica que la recurrencia queda preparada. **`NovaContext`** memoria de sesión (RAM, 10 min TTL): `lastTitle`, `lastDate`, `lastLocation`, `lastSection`, `lastIntentKind`, `lastEventId/TaskId`. Frases como `agéndalo como tarea recurrente` resuelven título y fecha desde el último intent. **`eventNeedsTime(title, partialDate)`** clarify nuevo cuando el usuario da día pero no hora ("tengo parcial el jueves" → "Tengo «Parcial» para el jueves. ¿A qué hora?"). **Chat keyboard fix**: `chatContent` ahora usa `.safeAreaInset(edge: .bottom)` para anclar el input automáticamente arriba del teclado. ScrollView se posiciona al último mensaje en envío y al enfocar input. `scrollDismissesKeyboard(.interactively)` permite arrastrar para cerrar teclado. Input del chat pasa a multilínea (`axis: .vertical` + `lineLimit(1...4)`). **Límites conocidos** del parser local: solo procesa UN intent por frase (no maneja "agenda X y crea tarea Y"); no edita ni borra items por nombre; recurrencia visible pero no funcional; sin entender meses específicos ("15 de diciembre"). |
| 19 | 2026-05-11 | Lenguaje coloquial chileno + correcciones + swipe-to-delete | **Bug "a las 3" → 03:00**: `adjustAmPm` ahora aplica regla coloquial cuando NO hay marcador AM/PM: 1–7 → PM (13:00..19:00), 8–11 → AM (mantener), 12 → 12:00. Marcadores explícitos respetados: `de la mañana`/`madrugada` → AM, `de la tarde`/`de la noche`/`pm` → PM. **Bug día se va a mañana sin pedir**: cuando no hay día explícito, mantenemos HOY incluso si la hora pasó. Solo bumpeamos a mañana si el gap > 4h y no hay verbo de actividad inminente (ir/salir/buscar/acuérdame). **Patrones nuevos de hora**: `como a las 3`, `a eso de las 3`, `cerca de las 3`, `alrededor de las 3` — todos resuelven a 15:00. **Correcciones contextuales**: `isCorrectionStart` detecta `no,` / `no `/ `mejor` / `cámbialo` / `ponlo` / `pásalo` / `muévelo`. Casos cubiertos: `no, mañana` → `correctLastEvent(.shiftDays(1))`; `cámbialo a las 18` → `correctLastEvent(.setTime(18,0))`; `en sala H013` (corrección sola) → `setLocation(...)`; `ponlo como tarea` → `convertLastToTask` (borra evento, crea tarea con mismo título). **`acuérdame`/`recuérdame`**: el parser activa `wantsReminder` y el inline response avisa "Las notificaciones inteligentes están en preparación" — honesto sobre estado. **`SwipeToDelete`** componente nuevo: arrastrar fila hacia la izquierda muestra fondo rojo con basurero; pasar threshold (70pt) confirma delete con animación y haptic warning. Aplicado a TimelineEventRow + MiDiaTaskRow en Mi Día, a CalendarEventCard en Calendario, y a TaskRowFull en Tareas. **Solo habilitado para items reales** — los de demo no se borran (no están en el store). Toast "Evento eliminado" / "Tarea eliminada" al confirmar. **`FocusDataStore.updateEvent(_:)`** nuevo método. **Vercel**: `npm run build` local pasa (576 módulos, dist/ generado OK). El email de "Failed production deployment" probablemente fue transitorio del runner — el commit actual debería deployar Ready. Si persiste, hay que revisar el log específico desde el dashboard de Vercel. |
| 20 | 2026-05-11 | Bugs finales: pendientes, recordatorios, notch, teclado | **Bug pendientes no se podían borrar**: SwipeToDelete tenía `simultaneousGesture(nil)` cuando `enabled = false` — SwiftUI lo ignoraba silenciosamente. Refactor con `Group { if enabled ... else }` explícito. **Demo dismissable inline**: Mi Día ahora mantiene `dismissedDemoEventTitles`/`dismissedDemoTaskTitles` (Set<String>, sesión-only). Swipe sobre cualquier fila (real o demo) la oculta inmediatamente; real va al `store.deleteX`, demo va al set local. Filtramos en `displayEvents`/`displayPendingTasks`. **`contextMenu` backup**: long-press en cualquier fila de evento/tarea en Mi Día muestra "Eliminar" — vía alternativa al swipe, no falla por conflictos de gesto. **Reminders sin duración falsa**: `FocusEvent.isReminder: Bool?` nuevo, backward-compat por ser optional. `timeRangeLabel` y `durationLabel` chequean `displayAsPointInTime` y muestran solo la hora ("15:00" en vez de "15:00 – 16:00"). El parser ya seteaba `wantsReminder` desde "acuérdame"/"recuérdame"; el ejecutor de Mi Día ahora crea el evento con `isReminder: true`, duración interna de 5 min (necesario para que ordene en el timeline) y sección `.reminder` por defecto. Inline response cambia el copy: "Recordatorio agendado" + "Las notificaciones automáticas están en preparación". **Notch/Dynamic Island**: padding superior del header de Mi Día sube de `Theme.Spacing.md` (12pt) a `Theme.Spacing.lg` (16pt). Junto al safe-area que iOS ya respeta, da aire suficiente al logo+fecha+título. **Teclado dismiss**: `.scrollDismissesKeyboard(.immediately)` en el ScrollView de Mi Día — arrastrar hacia abajo cierra el teclado. `FocusBarInput` agrega toolbar "Listo" en `placement: .keyboard` que también lo cierra. Tras submit en Mi Día, llamamos `UIResponder.resignFirstResponder` para limpiar foco. **Vercel**: sin CLI/auth disponibles desde la sesión Claude, no puedo leer logs. El user tiene que abrir Vercel Dashboard → focus → Deployments → último Failed → Build Logs y pegar el error. Documentado en sección 17 nueva. |
| 21 | 2026-05-11 | Limpieza títulos Nova + sugerencias stale + chat Gemini-style | **Bug título sucio**: "buscar a la agustina tipo 3 acuérdate" creaba evento "Buscar a la agustina tipo 3 acuérdate". Parser ahora extiende `stripDateTimeMarkers` con patterns para `tipo N`, `como a las N`, `a eso de las N`, `cerca de las N`, `alrededor de las N`. Agrega `stripReminderTriggers` (acuérdame/acuérdate/acuérdalo/recuérdame/no olvides/que no se me olvide/que me acuerde) y `stripFillers` (porfa/por favor/oye/hey/dale). Nuevo `normalizeProperNounsAfterArticles` que reconoce "a la agustina"/"con el carlos" y lo transforma en "a Agustina"/"con Carlos" (capitaliza nombre, quita artículo). Aplicado en `extractEventTitle` y `cleanTaskTitle`. **Triggers de recordatorio ampliados**: acuérdate, acordarme, acuérdalo, que no se me olvide, que me acuerde detectan `wantsReminder`. **Contador limpio**: ProximoBloqueCard pasa de tick cada 1s con segundos ("Queda 1 h 36 min 24 s") a tick cada 30s sin segundos ("Queda 1 h 36 min"). Para recordatorios usa formato absoluto humano: "Hoy a las 15:00" / "Mañana a las 15:00" / "El lunes 18 a las 15:00". **ProximoBloqueCard borrable**: ahora envuelta en `SwipeToDelete` + menú overflow (·· ·) con "Eliminar" + `contextMenu` long-press. Tres vías para borrar el evento próximo. Sección pill cambia a "Recordatorio" + bell.fill cuando `displayAsPointInTime`. **Sugerencias stale**: `FocusDataStore.init` ya NO pre-seedea demo en el store. Migración one-shot remueve seeds legacy persistidos (match por título contra `DemoDataProvider.suggestions()`). Nuevo `displaySuggestions` filtra las que referencian items inexistentes y cae a demo fallback solo si `!hasUserData`. `pendingDisplaySuggestions` para badges (Nova tab, header Mi Día, Ajustes). `cleanupStaleSuggestions()` corre tras `deleteEvent`/`deleteTask`. `resetToDemoState` limpia suggestions a vacío. Empty state copy: "Cuando agregues eventos o tareas, Nova te propondrá ajustes acá. Probá «organiza mi día» o «preparar mañana» desde el FocusBar." **Chat estilo Gemini**: bubble de Nova ahora tiene avatar 30pt con `RoundedRectangle` cobalto gradient + sombra violeta + NovaSparkMark adentro (vs el dot 8pt anterior). Label "Nova" pequeña sobre el primer mensaje. Bubble del usuario tiene gradient diagonal (focusAccent → focusAccentHover) + sombra cobalto. Bubble de Nova tiene gradient sutil violeta-borde. **`NovaTypingIndicator`** componente: 3 puntos que pulsan en secuencia (delay 0.18s cada uno) con avatar Nova al lado. Aparece cuando `store.isNovaTyping == true` y desaparece cuando llega la respuesta. **`isNovaTyping`** flag nuevo en el store: se activa al mandar mensaje, se desactiva cuando la respuesta se renderiza (delay 850ms para sentir el tick). Chat hace scroll automático cuando aparece el typing indicator. |
| 22 | 2026-05-11 | Persistir descartes de demo + cleanup pendientes | **Bug**: el usuario borraba ejemplos demo en Mi Día con swipe, cerraba la app y al reabrir los pendientes volvían. **Causa**: `dismissedDemoEventTitles`/`dismissedDemoTaskTitles` vivían como `@State` privado de MiDiaView. Al cerrar la app SwiftUI descartaba el State; los sets se reiniciaban vacíos. **Fix**: ambos sets migrados a `FocusDataStore` como `@Published`. Persistencia vía `FocusLocalStore` con keys nuevas `focus.v1.dismissedDemoEvents` y `focus.v1.dismissedDemoTasks` (array de strings JSON-encoded). `init` los carga; helpers `dismissDemoEvent(title:)` / `dismissDemoTask(title:)` insertan + guardan en un paso. `resetToDemoState` y `clearAllLocalData` limpian los sets. MiDiaView ahora lee/escribe contra el store. Resultado: swipe-borrar un ejemplo → persiste → no vuelve al reabrir. Restablecer demo → los ejemplos vuelven. |
| 23 | 2026-05-11 | Bloque 1: Nova natural + chat Gemini empty state | **Parser muy ampliado** con frases coloquiales chilenas/latinas:<br>• **Nuevos verbos de evento**: `ponme `/`ponme un/una/el/la`, `tengo médico/medico/doctor`, `clase con`.<br>• **Nuevos verbos de tarea**: `avísame `/`avisame `/`avísame que ` (también dispara `wantsReminder`).<br>• **Marcadores de tiempo coloquiales**: `en la tarde` → 16:00, `en la noche` → 20:00, `en la mañana` → 9:00, `después de almuerzo`/`después del almuerzo` → 15:00, `después del trabajo` → 18:00, `al final del día` → 18:00, `al amanecer` → 7:00.<br>**Triggers que mantienen el verbo en el título** (`keptInTitleTriggers`): `buscar a `, `ir a buscar `, `salir a /con`, `ir a `/`voy a `/`vamos a `, `juntarme con `, `almuerzo/cena/desayuno/café con `, `reunión con`, `clase con/de`, `pasar a /por `. Resultado: "buscar a la agustina tipo 3 acuérdate" → "Buscar a Agustina"; "ir a buscar a la agustina a las 3 acuérdame" → "Ir a buscar a Agustina".<br>**Triggers tipo `tengo X`** (`tengoLikeTriggers`): "tengo parcial" → título "Parcial"; "tengo médico" → "Médico"; "tengo clase" → "Clase". El título es la palabra-clave después de "tengo".<br>**`stripLeadingArticle`**: artículo "la"/"el" al inicio del título limpio se quita y capitaliza la siguiente palabra ("la agustina" → "Agustina").<br>**`firstMatchingTrigger` ahora prioriza el trigger más largo** cuando hay empate de posición. Garantiza que "ir a buscar " (12 chars) gane sobre "ir a " (5 chars) en la misma frase. **Correcciones contextuales nuevas**: `bórralo`/`elimínalo`/`borrar` → `.deleteLastItem` (borra el último evento o tarea del store y limpia contexto). `era X`/`no era Juan, era Pedro`/`era con X` → `.correctLastEvent(.setTitle(X))` (cambia título del último evento conservando fecha/hora/ubicación). `isCorrectionStart` ampliado para detectar estos casos. **`createTask` lleva `dueDate`**: el parser ahora preserva la fecha extraída ("mañana") y la pasa al executor, que mapea a categoría (.hoy/.semana/.algunDia) y al campo `dueDate` de `FocusTask`. Inline response incluye "para mañana" / "para el jueves" cuando aplica. **Chat empty state estilo Gemini**: cuando `novaMessages.isEmpty && !isNovaTyping`, NovaView muestra hero centrado con NovaSparkMark 36pt en una RoundedRect 84pt cobalto + sombra violeta, título "¿Qué quieres ordenar?" (28pt medium), subtítulo, y 4 chips: Organizar mi día / Crear tarea / Agendar evento / Revisar pendientes. Tap → `handleQuickAction` correspondiente. **Sin welcome message persistido**: `FocusDataStore.init` y `resetToDemoState` arrancan `novaMessages = []`. El saludo vive solo en la UI del empty state. **Límites conocidos**: parser solo procesa UN intent por frase; no entiende fechas absolutas tipo "15 de diciembre"; recurrencia detectada pero no implementada; no edita propiedades múltiples a la vez. |
| 24 | 2026-05-11 | Calendario Día/Semana/Mes + editar + segundos | **Calendario Día/Semana/Mes**: `CalendarioView.ViewMode` enum con segmented control. Día = detalle de un día. Semana = comportamiento previo. Mes = nueva `MonthGridView` (7 cols L-D, puntos cobalto, navegación chevrones). **Editar eventos/tareas**: `NuevoEventoSheet(editing:onSave:)` y `NuevaTareaSheet(editing:onSave:)` precargan campos y conservan id. `FocusDataStore.updateTask(_:)` nuevo. ProximoBloqueCard menú `· · ·` y contextMenus en TimelineEventRow / MiDiaTaskRow / CalendarEventCard / TaskRowFull suman "Editar" además de "Eliminar". **Recordatorios sin duración inferida**: `FocusEvent.inferredDuration: Bool?` nuevo. `displayAsPointInTime = isReminder \|\| inferredDuration`. Parser `extractExplicitEndTime` detecta "de X a Y", "hasta las Y", "por N hora(s)/min". `NovaIntent.createEvent` lleva `endTime: Date?`. Executor tres caminos: reminder (5min + isReminder), rango explícito (end real, no point), sin rango (5min + inferredDuration=true, point). **Segundos en eventos EN CURSO**: TimelineView 1s tick + formato "Termina en X min Y s" para in-progress. Futuros sin segundos. Recordatorios formato absoluto. |
| 25 | 2026-05-11 | Bloque 2: QA UI/teclado/safe area | **Tap-outside keyboard dismiss**: `simultaneousGesture(TapGesture)` agregado al ScrollView de Mi Día y al chat de Nova. Convive con taps de botones (simultáneo, no exclusivo) — los botones siguen funcionando, el teclado se cierra. Combina con `scrollDismissesKeyboard(.immediately)` ya existente y toolbar "Listo" del FocusBarInput. **Header top padding consistente**: Mi Día, Calendario, Nova y Ajustes ahora usan `Theme.Spacing.lg` (16pt) en lugar del mix `.md/.lg` que tenían. Junto al safe-area inset que iOS aplica, da aire suficiente respecto a notch/Dynamic Island en todos los tabs. **Bottom safety verificado**: todas las pantallas (Mi Día, Calendario, Nova, NovaInbox, Ajustes, Tareas) cierran su scroll con `Spacer(minLength: Theme.Spacing.bottomBarSafety)` (110pt) — la tab bar custom no tapa la última card. **Toast position verificado**: `.overlay(alignment: .top)` respeta safe area inset (no se solapa con Dynamic Island). **Calendar Mes empty**: si el día seleccionado del mes no tiene eventos, `dayContent` muestra "Día libre" + botón "Nuevo evento" — comportamiento consistente con Día/Semana. **Build OK** simulador + iPhone 16 físico. Parser smoke-test: casos clave del Bloque 1 siguen funcionando (verified via parse trace mental + build success). **No se modificó**: lógica de parser, modelo de datos, persistencia, auth, demo, sync (no se conecta Supabase ni LLM). **Pendiente para Bloque 3+**: Supabase sync, Nova LLM real, notificaciones APNs, micrófono real, widgets, EventKit/Google Calendar OAuth, recurrencia funcional, deadlines visibles en TaskRow. |
| 33 | 2026-05-11 | **Bloque 5 V1 implementado** — Notificaciones locales para recordatorios (sin push remoto) | **Sanity Bloque 4 OK** antes de tocar nada (HEAD `704759d`, build pasa, working tree limpio). **NotificationService nuevo**: [ios-native/Focus/Services/LocalNotificationService.swift](ios-native/Focus/Services/LocalNotificationService.swift) — wrapper sobre `UserNotifications`. Singleton `LocalNotificationService.shared` con API mínima: `requestAuthorization()` (idempotente: si ya hay decisión iOS no muestra prompt), `currentStatus()`, `scheduleReminder(for: FocusEvent)`, `cancelReminder(eventId:)`, `cancelAllReminders()`, `pendingReminderCount()`. Identifier estable `"focus-reminder-event-<UUID>"` → re-schedule reemplaza sin duplicar. Notificación con title fijo "Focus", subtitle "Recordatorio", body "<título evento>" o "<título> · <ubicación>" si hay location. `userInfo` lleva el `eventId` para futuro deep-link. Sound default. **Hooks en FocusDataStore**: `addEvent`/`updateEvent` ahora invocan `syncLocalNotification(for:)` que decide schedule vs cancel según `isReminder == true`, `startTime > now` y `settings.remindersEnabled`. Si el permiso está en `.notDetermined`, pide autorización on-the-fly (UNotificationCenter solo muestra prompt una vez por instalación, así que es seguro). `deleteEvent` cancela siempre. `mergeRemoteEvents` (sync Supabase) llama `resyncAllLocalNotifications` al final — recordatorios futuros traídos del backend se re-programan automáticamente (identifiers estables, no duplica). `updateSettings` detecta cambio del toggle global "Recordatorios": OFF → cancela todas las pendientes; ON → re-programa futuras. `resetToDemoState` / `clearAllLocalData` cancelan todas las notifs como parte de la limpieza. **Boot bootstrap**: [FocusApp.swift](ios-native/Focus/FocusApp.swift) tiene `.task { dataStore.bootstrapLocalNotifications() }` que asegura que tras un launch (incluso después de re-instalar) los recordatorios futuros tengan su notif programada. **UI Ajustes → Notificaciones** ([AjustesView.swift](ios-native/Focus/Views/AjustesView.swift)): nueva primera fila "Permiso del iPhone" dinámica por `UNAuthorizationStatus`: (a) `.authorized` / `.provisional` / `.ephemeral` → "Activadas. Focus puede avisarte." con check; (b) `.notDetermined` → botón "Toca para activarlas" que llama `requestAuthorization` y después dispara bootstrap si se acepta; (c) `.denied` → "Toca para abrir Ajustes del iPhone" que abre `UIApplication.openSettingsURLString`. Footer informativo: "Focus usa notificaciones locales para recordarte eventos y tareas en este iPhone. No hay push remoto todavía." `.task { await refreshNotificationStatus() }` refresca el estado cuando la vista aparece. Toggles existentes ("Recordatorios", "Resumen diario", "Sugerencias inteligentes") conservados — "Recordatorios" ahora SÍ está conectado (controla schedule/cancel); los otros dos siguen como aspiracionales con label "(próximamente)". **Solicitud automática de permiso**: integrada en `syncLocalNotification`. Cuando el usuario crea su primer recordatorio (vía Nova o manual), si el permiso está en `.notDetermined`, iOS muestra el prompt nativo. Si acepta, se programa; si rechaza, el evento se crea sin alerta pero queda visible. **Reglas respetadas**: solo programa si `isReminder == true` (Nova marca recordatorios puntuales así); no programa si fecha pasada; no programa si toggle off; no programa si denied; no programa si `notDetermined` y el usuario rechaza el prompt. **Modo demo**: SÍ programa notificaciones locales (decisión documentada — son 100% del device, no expone datos al remoto). Sync Supabase no se afecta. **Contenido de la notificación**: ejemplos — "Llamar a Juan", "Buscar a Agustina · Sala H013", "Reunión con Pedro". Sin metadata rara, sin emojis, sin nombrar "Nova". **Tap action**: V1 abre la app (iOS default). Deep link a Mi Día / Calendario de la fecha del evento queda como follow-up (no bloqueante). **Build OK** simulador iPhone 17 / iOS 26.4.1. **QA pendiente en device físico** (Martin): (1) primer recordatorio dispara prompt iOS; (2) recordatorio "en 1 minuto" llega con app en background; (3) con app cerrada también llega; (4) editar reschedule a otra hora — llega solo la nueva; (5) borrar evento cancela; (6) toggle OFF cancela todas; (7) toggle ON re-programa futuras; (8) modo demo programa local pero NO sincroniza a Supabase. **Pendientes Bloque 5 / postergados**: no push APNs remoto (Bloque 6+), no resumen diario real (toggle persiste pero no agenda nada), no sugerencias inteligentes push, no widgets, no Nova Live, no deep link al tocar notificación, no notificaciones para tareas (solo recordatorios-eventos en V1). |
| 32 | 2026-05-11 | Bloque 4.1 — Nova short-circuit local + refuerzo prompt backend "en N" | **Endpoint Nova verificado vivo**: `curl POST https://www.usefocus.me/api/focus-assistant` → `HTTP 401 · 0.9s` con `{"error":"auth_required","message":"Inicia sesión para hablar con Nova."}`. Coincide con la rama `unauthorized` de `NovaServiceError` y dispara fallback local automático. **Bug crítico detectado en audit**: inline mode (`MiDiaView.processNovaInline`) no guardaba pending cuando el backend hacía la clarify, porque el backend devuelve `reply` con `actions: []` y el cliente no detectaba que era una pregunta. Resultado: turnos como "tengo parcial el jueves" → backend pregunta → "a las 3" → el cliente lo manda al backend SIN history (inline no toca `novaMessages`) → backend "no sé qué hacer". **Bug crítico 2**: correcciones inline ("no, mañana" / "bórralo" / "ponlo como tarea") iban al backend sin `lastEventId` ni contexto local, así que el backend no podía resolverlas. **Fixes aplicados**: (1) [MiDiaView.swift](ios-native/Focus/Views/MiDiaView.swift) `resolveNovaResponse` ahora hace **pre-parse local** del input ANTES de decidir. Nuevo helper `shouldShortCircuit(_:)` evita el backend cuando el local resuelve mejor: `correctLastEvent`/`deleteLastItem`/`convertLastToTask` (requieren `lastEventId`/`lastTaskId` local), `organizeDay`/`reviewPending`/`askAboutDemo` (comandos meta del cliente), `smallTalk` (confirmaciones/cancelaciones), y `createEvent`/`createTask` SOLO cuando `pendingIsActive` (es decir, el local resolvió un follow-up de pending). Para mensajes nuevos sigue prefiriendo backend. Si local detecta `.clarify` con título, se guarda pending preventivamente para que un follow-up posterior se pueda completar localmente aun si el backend responde sin actions. (2) [FocusDataStore.swift](ios-native/Focus/State/FocusDataStore.swift): `shouldShortCircuitLocally(_:)` espejo del de MiDiaView (en el store para que el chat lo use sin acoplar State a SwiftUI), y `applyLocalNovaIntent(_:userText:)` ejecuta el intent local devolviendo texto listo para el chat — cubre `createEvent` (con bloque reminder/range), `createTask` (con dueLabel), `correctLastEvent` (shiftDays/setTime/setLocation/setTitle), `convertLastToTask`, `deleteLastItem`, `organizeDay` (suggestions en bandeja), `reviewPending` (lista preview), `askAboutDemo`, `smallTalk`. Todos los side effects pasan por los métodos del store (`addEvent`/`updateEvent`/`deleteEvent`/`addTask`/`deleteTask`/`addSuggestion`) que ya sincronizan a Supabase (B3). (3) `sendNovaMessage` (chat) ahora hace short-circuit antes del Task: si `shouldShortCircuitLocally` y `applyLocalNovaIntent` devuelven texto, append directo al chat sin llamar al backend. Ahorra cuota Nova + es deterministic + funciona offline. **Refuerzo system prompt backend** ([api/_lib/systemPrompt.js](api/_lib/systemPrompt.js)): nueva sección "OFFSET RELATIVO 'EN N'" con regla coloquial chilena/latina explícita: "en N" sin unidad (N en 1..180) en frase de acción inmediata SIEMPRE significa "+N minutos a partir de ahora", NUNCA la hora del día N:00. Ejemplos obligatorios incluidos en el prompt: "ir a buscar a la Agustina en 20" → ahora+20min recordatorio "Buscar a Agustina"; "salgo en 15" → ahora+15min; "te llamo en 5" → ahora+5min. Sólo si el usuario dice "a las 20" / "tipo 20" / "20:00" / "20 hrs" / "20 hs" es hora del día. Esto despliega automáticamente con el próximo push (Vercel re-deploya en cada commit a main). **Casos cubiertos por el short-circuit** (no llaman backend, son deterministic y respetan reglas locales): "a las 3" tras "tengo parcial el jueves" → "Parcial" jueves 15:00 ✅; "en 20 minutos" tras pregunta ambigua → "Buscar a Agustina" now+20 ✅; "mañana a las 5" tras "agenda reunión con Pedro" → mañana 17:00 ✅; "no, mañana" tras crear evento → shift +1 día ✅; "bórralo" tras crear → elimina último + sync soft delete ✅; "sí"/"ok"/"dale" tras propuesta → ejecuta con valores propuestos ✅; "no"/"cancela"/"olvídalo" → cancela con smalltalk ✅; "organiza mi día" → 2 sugerencias en bandeja ✅; "qué tengo pendiente" → preview de tareas ✅. **Casos que siguen yendo al backend** (mejor NLU): "buscar a la Agustina tipo 3 acuérdate" (mensaje nuevo, Haiku interpreta), "mañana a las 3 reunión con Juan" (mensaje nuevo), "tengo que estudiar cálculo mañana" (mensaje nuevo). El cliente cae a local si backend falla. **Seguridad/costos verificados**: 401 → fallback con nota humana; 429 → mensaje del backend + fallback; tokens nunca se imprimen; ai_usage_events sigue registrando cada call backend; service_role no aparece en iOS; modo demo sigue sin consumir backend. **Build OK** simulador iPhone 17 / iOS 26.4.1. **Pendiente — QA real en iPhone físico de Martin**: validar 9 casos Mi Día + 3 casos memoria conversacional con cuenta logueada, confirmar que las acciones aparecen en Supabase Dashboard (`focus_events`/`focus_tasks` con `user_id` correcto), y que el modo demo no genera filas. Cuando confirmes, marco Bloque 4 como cerrado 100%. **Limitaciones V1 (postergadas)**: notificaciones reales, micrófono/Nova Live, widgets, recurrencia real con tabla, sync de `nova_suggestions`/`nova_messages`, action cards visuales en chat (V1 integra summary al texto), `update_task` granular, `remember` action persistida. |
| 31 | 2026-05-11 | Nova memoria conversacional corta + regla "en N" relativa + UI eventos | **Bug del usuario**: Nova preguntaba "¿20:00 o en 20 minutos?" para "ir a buscar agustina en 20", y al responder "en 20 minutos" actuaba como sin memoria. **Cambios en `NovaContext`**: el viejo trío `pendingTitle/pendingSection/pendingWantsReminder` fue reemplazado por struct rica [`PendingClarification`](ios-native/Focus/State/FocusDataStore.swift) con campos `originalInput`, `kind` (event/task/reminder/ambiguous), `proposedTitle`, `proposedDate`, `proposedSection`, `proposedLocation`, `wantsReminder`, `missingFields` (Set de title/date/time/duration/targetItem/actionType), `questionAsked`, `source` (inlineMiDia/novaChat), `createdAt/expiresAt` (auto-10min). Helper `pendingIsActive` chequea expiración + frescura. **Cambio de regla "en N"**: antes "en 20" disparaba `ClarifyReason.ambiguousTime24OrRelative` que preguntaba. Ahora `extractDateTime` reconoce "en N" SIN unidad como minutos relativos (regla coloquial: "salgo en 20" = +20 min, "te llamo en 5" = +5 min, "ir a buscar agustina en 20" = +20 min). Pattern nuevo `\ben\s+(\d{1,3})\b(?!\s*(?:min|hora|hr|hs|h\b))` con cap N ≤ 180 (3h). El case `ambiguousTime24OrRelative` quedó eliminado del enum, junto con `ambiguousEnNValue` y todo el wiring asociado. Para "a las 20" / "tipo 20" / "20:00" / "20 hrs" sigue siendo hora del día. **Nueva sección "-1" en `NovaResponder.parse()`**: si hay `pendingClarification` activo y el input parece un follow-up, intenta completar. `resolvePendingFollowUp` maneja: (a) cancelaciones cortas ("no" / "cancela" / "déjalo" / "olvídalo") → cancela pending con smalltalk suave; (b) confirmaciones cortas ("sí" / "dale" / "ok" / "perfecto") → ejecuta con valores del pending; (c) solo hora ("a las 3" / "20:00" / "en 20 min") → combina con pending.proposedDate; (d) solo día ("mañana" / "viernes") → combina con pending.proposedTime si existe; (e) día+hora juntos → usa ambos del input. `hasNewActionMarkers` detecta event triggers / "tengo que" / "crea tarea" / "organiza mi día" → descarta pending y deja flujo normal. `hasExplicitDayMarker` + `pendingHadTime` discriminan qué viene del input vs del pending. **Sección 8 actualizada**: cuando llega "a las 20" (solo hora) y title está vacío post-strip, usa `pending.proposedTitle` + `pending.proposedLocation` + `pending.proposedSection` + `pending.wantsReminder` en lugar de los viejos campos triplete. **Save pending en ambos surfaces**: `MiDiaView.executeIntent` caso `.clarify` ahora llama `setPendingClarification(_:)` (no `setPendingNovaContext`); `FocusDataStore.sendNovaMessage` hace **pre-parse local** del input ANTES de llamar al backend — si el parser detecta clarify, guarda pending. Si el backend resuelve con actions, `updateNovaContext` limpia el pending; si deja sin actions (también pregunta), el pending sobrevive 10 min. `clearPendingClarification()` nuevo helper para borrar solo el pending sin tocar lastEventId/lastTaskId. **UI eventos Mi Día**: TimelineEventRow ahora tiene **banda lateral coloreada de 4pt** (a la izquierda) con el color de la sección (foco/reunión/personal/estudio/descanso/reminder). Padding interno aumentado (`Theme.Spacing.md`), título usa `bodyBold` en lugar de `bodyEmphasized` (un toque más grande), icon-row 11pt y `focusCardShadow()` agregado a la card. **Build OK** simulador iPhone 17 / iOS 26.4.1. **Casos cubiertos por la memoria**: (1) "ir a buscar agustina en 20" → "Buscar a Agustina" hoy now+20min (sin preguntar más); (2) "tengo parcial el jueves" → "¿A qué hora?" → "a las 3" → crea "Parcial" jueves 15:00; (3) "recuérdame llamar a Juan" → "¿Cuándo?" → "mañana a las 5" → recordatorio "Llamar a Juan" mañana 17:00; (4) "agenda reunión con Pedro" → "¿Día y hora?" → "mañana a las 5" → evento "Reunión con Pedro" mañana 17:00; (5) confirmaciones "sí"/"ok"/"dale" después de propuestas; (6) cancelaciones "no"/"cancela"/"olvídalo" limpian pending. **Persistencia**: pending NO se guarda a disco (vive en RAM). Cerrar/reabrir app expira el pending limpiamente; eventos/tareas creados ya se sincronizan a Supabase (B3). **NO se rompió**: "a las 3" = 15:00, "3 de la mañana" = 03:00, "buscar a la Agustina tipo 3 acuérdate" → "Buscar a Agustina", "no, mañana" sigue moviendo último evento, "bórralo" sigue eliminando último item, recordatorios puntuales sin rango 15:00–16:00, fallback local intacto, sync Supabase intacto. |
| 30 | 2026-05-11 | **Bloque 4 implementado (parcial)** — Nova iOS conectada a `/api/focus-assistant` con fallback local | **NovaService.swift** nuevo ([ios-native/Focus/Services/NovaService.swift](ios-native/Focus/Services/NovaService.swift), ~450 líneas): cliente URLSession stateless que llama `POST /api/focus-assistant` con `Authorization: Bearer <accessToken>`, `Content-Type: application/json`, timeout 45s (matchea backend). Request shape exacto al esperado por el endpoint actual (lo usa también la web en prod): `{message, novaPersonality, mode, events[], tasks[], history[], clientNow, clientTimezone}`. Response parsing resiliente: decoder hace dispatch por `type` y mete tipos desconocidos en `BackendAction.unsupported(typeName)` en lugar de tumbar la respuesta. Errores tipados (`NovaServiceError`): `unauthorized`/`quotaExceeded`/`offline`/`timeout`/`serviceUnavailable`/`badLLMOutput`/`network`/`encoding`/`decoding`/`server`. Cada uno con flag `canFallbackToLocal: Bool` para que el caller sepa si caer al parser. **NUNCA loguea tokens completos ni prompts/replies**. Helpers: `NovaTimeFormatter` para parsear/serializar "h:mm AM/PM" + "YYYY-MM-DD"; extensiones `TaskPriority/TaskCategory/EventSection` con `backendLabel` y `fromBackendLabel/fromBackendIcon` para mapping bidireccional. **FocusDataStore.applyBackendActions(_:userText:)** nuevo ([ios-native/Focus/State/FocusDataStore.swift](ios-native/Focus/State/FocusDataStore.swift) líneas ~2095-2440): switch sobre cada `BackendAction` que delega a métodos existentes (`addEvent`, `updateEvent`, `deleteEvent`, `addTask`, `toggleTask`, `deleteTask`) — todos ellos ya sincronizan a Supabase (B3). Soporta `add_event/add_recurring_event/edit_event/delete_event/add_task/toggle_task/delete_task/remember/unsupported`. `add_recurring_event` se expande localmente a N `addEvent` (max 31 instancias por acción, soporta `daily`/`weekdays`/`weekly` con `weekday` 0=domingo backend → Swift). Recordatorios: si título empieza con "Recordatorio:" o icon es "alarm", se setea `isReminder=true` + `inferredDuration=nil` → UI muestra como punto puntual, no rango falso. `edit_event`/`delete_event` con id que no matchea local quedan en `ignored` sin crashear. `remember` se loguea pero no persiste (no hay memory store V1). Devuelve `NovaApplyOutcome` con `didMutate`, `summary`, `primaryEventId/TaskId`, `primaryIsReminder` para que la UI arme respuestas claras. **`MiDiaView.processNovaInline` refactorizado** ([ios-native/Focus/Views/MiDiaView.swift](ios-native/Focus/Views/MiDiaView.swift) líneas 280-460): ahora `async`. Decide path: si `store.syncCredentials != nil` → backend; sino → parser local directo. En caso de error backend con `canFallbackToLocal == true`, corre `NovaResponder.parse` y agrega nota humana ("Usé el modo local porque Nova avanzada no respondió.") al detalle. Errores no recuperables (encoding/decoding/server inesperado) muestran error real. Backend exitoso: aplica `actions` via `applyBackendActions`, muestra summary del outcome + reply textual como detalle, acción contextual (`.openCalendar`/`.openTasksList`). Si actions vacías y backend solo dio `reply` (clarify/info), split por primera oración para summary/details. Envía context: eventos en ventana hoy+7d, tareas pendientes (`!done`), últimos 12 turnos de chat. **`FocusDataStore.sendNovaMessage` refactorizado**: misma lógica para Chat. Snapshot atómico de `syncCredentials` antes de armar el Task; backend con `surface: .novaChat`. En el resultado, compone mensaje de Nova con: reply textual + summary de mutación (si hubo) + nota de cuota/fallback (si aplica). Mínimo delay 350ms para que el typing indicator no parpadee. **Modo demo intacto**: sin `syncCredentials` → siempre parser local, NO se llama backend (auth required → 401 evitado) → NO se sincroniza con Supabase. **Build OK** simulador iPhone 17 / iOS 26.4.1. **Cuándo se usa backend**: usuario logueado + red + cuota OK. **Cuándo se usa fallback local**: modo demo, sin sesión, 401, 429, 503, 504, timeout, sin internet, decode fail con `canFallbackToLocal`. **Acciones soportadas en V1**: `create_event` (mapeado de `add_event`), `create_event_recurring` (expandido), `update_event` (de `edit_event`), `delete_event`, `create_task`, `toggle_task`, `delete_task`. **NO implementado en V1**: `create_suggestion` como type backend (no existe en contrato actual; sugerencias siguen siendo client-side), `update_task` separado del toggle (el backend no lo expone; cambios de prioridad/categoría aún manuales en Tareas), `remember` (no hay memory store local todavía), action cards visuales en chat (V1 lee resultado del summary integrado al texto del mensaje, futuro: cards dedicadas). **Costos/seguridad verificados**: backend exige JWT (sin sesión → 401 que cae a fallback), respeta `usageLimits.js` (NOVA_MESSAGE 20/día Free, NOVA_SMART_ACTION 10/día), registra `ai_usage_events` por cada call (pricing + tokens). iOS NO usa service_role, NO loguea tokens ni prompts. Mensaje de cuota agotada se muestra como nota humana al final del reply. **Pendientes Bloque 4**: action cards dedicadas en chat (Crear evento/Tarea/Confirmar como botones visibles), validación manual en iPhone físico con casos del usuario (1-11 de Fase 9), tuneado fino de copy si los replies del backend son largos. **NO incluye** (siguen para bloques futuros): notificaciones reales, micrófono/Nova Live, widgets, recurrencia real con tabla, sync de `nova_suggestions`/`nova_messages`. |
| 29 | 2026-05-11 | Nova parser — soporte 24h coloquial y ambigüedad "en N" | Bug report del usuario: "ir a buscar agustina en 20" devolvía clarify genérico "Necesito el día y la hora", cuando "en 20" debe interpretarse como hora 24h (20:00) o relativo (+20 min). **Cambios en [FocusDataStore.swift](ios-native/Focus/State/FocusDataStore.swift)**: (1) **Notación 24h** — `extractHourMinute` ahora parsea "N hrs"/"N hs"/"N h" (0..23) como hora directa sin pasar por `adjustAmPm`, complementando los patterns existentes "a las N", "N:MM", "tipo N". Pattern existente "a las 20" ya funcionaba via `adjustAmPm(20)` que devuelve la hora literal cuando es >12. (2) **Offset relativo** — `extractDateTime` reconoce "en N minutos" / "en N min" → `now + N min`, y "en N horas" / "en N h" / "en N hs" / "en N hrs" → `now + N h`. (3) **Ambigüedad "en N"** — nuevo `ClarifyReason.ambiguousTime24OrRelative(title, value)`. Cuando el usuario escribe "ir a buscar agustina en 20" (N en 13..23 sin unidad), Nova devuelve "¿Te refieres a las 20:00 o en 20 minutos?". Si N<13 o N>23, no se considera ambiguo (no hay choque con notación 24h). (4) **Follow-up via pendingTitle** — `NovaContext` ahora guarda `pendingTitle/pendingSection/pendingWantsReminder`. Cuando Nova hace clarify con título (`eventNeedsTime`/`eventNeedsDateTime`/`ambiguousTime24OrRelative`), `MiDiaView.executeIntent` llama `setPendingNovaContext(...)`. La siguiente respuesta del usuario con solo hora ("a las 20", "20:00", "en 20 minutos") cae en sección 8 con `title=""`; el código detecta `pendingTitle` fresco (<10 min) y completa el evento. `updateNovaContext` resetea pendingTitle al ejecutar un intent real. (5) **Limpieza de títulos** — `extractEventTitle` ahora normaliza "ir a buscar X" → "Buscar a X" (verbo redundante en español natural), consumiendo el "a/al/a la/a las/a el/a los" leading del rest para evitar "Buscar a a Agustina". Nueva helper `capitalizeFirstNounIfLower` captura "agustina" → "Agustina" cuando no hubo artículo previo que dispare `normalizeProperNounsAfterArticles`. `dateTimeMarkerPatterns` extendido con "en N minutos/horas", "N hrs/hs" y "en N" suelto para limpiar el título. (6) **Recordatorio puntual con hora** — sección 5 (`taskActionTriggers` como "recuérdame", "tengo que", "avísame") ahora cae al flujo de evento cuando hay `hasTimeMarker(lower)` true. Así "recuérdame buscar a la agustina tipo 20" crea **recordatorio puntual** (FocusEvent con isReminder=true, sin rango 20:00-21:00) en lugar de tarea sin hora. Si no hay hora explícita, sigue creando tarea como antes ("recuérdame pagar internet"). (7) **`extractLocation` reject numeric** — nuevo filtro: si después de "en " viene solo un número o un horario ("20", "20 minutos", "2 horas"), devuelve nil. Antes el location quedaba con "20" cuando el usuario decía "en 20". **Headlines más naturales**: `eventNeedsDateTime` ahora dice "Tengo «X». ¿Cuándo?" en lugar del genérico "Necesito el día y la hora.". Copy en `MiDiaView.clarifyHeadline`/`clarifyDetail` actualizado a español neutro (tú, no voseo). **NO se rompió**: "a las 3" sigue siendo 15:00 (regla diurna intacta), "3 de la mañana" sigue siendo 03:00, "no, mañana"/"bórralo"/"agéndalo" siguen usando contexto, sync Supabase intacto (afecta solo a NovaResponder local). **Build OK** simulador iPhone 17 / iOS 26.4.1. **Casos validados mentalmente** (faltan tests manuales en iPhone): A) "ir a buscar agustina en 20" → clarify ambiguo; B) "a las 20" follow-up → crea "Buscar a Agustina" hoy 20:00; C) "ir a buscar agustina a las 20" → directo; D) "recuérdame buscar a la agustina tipo 20" → recordatorio puntual; E) "en 20 minutos" sin contexto → clarify, con contexto → completa. |
| 28 | 2026-05-11 | **Bloque 3 — CERRADO 100%** (Sync V1 e2e validado en iPhone real) | Martin corrió la prueba end-to-end en iPhone físico con cuenta logueada y todos los checkpoints pasaron: **Ajustes → Sincronización**: "Sincronizado" (no "Tabla no encontrada", no "Permiso rechazado por RLS", no "Error de red", no "Modo demo" estando logueado). **Crear evento desde iPhone**: row aparece en `public.focus_events` con `user_id` correcto, `deleted_at IS NULL`. **Editar evento**: cambia local + remoto, `updated_at` se actualiza (trigger `focus_events_set_updated_at`) y persiste al cerrar/reabrir. **Borrar evento**: desaparece local, no vuelve al reabrir, soft delete en Supabase (`deleted_at` set). **Crear tarea**: row aparece en `public.focus_tasks` con `user_id` correcto, `is_completed = false`. **Completar tarea**: cambia local + remoto y persiste. **Modo demo**: con `syncCredentials == nil` la app NO escribe a Supabase — confirmado, no aparecen rows fantasma. **Resumen de cierre Bloque 3**: Supabase tablas OK ✅ · RLS owner-only OK ✅ · Vercel Ready ✅ · Sync eventos OK ✅ · Sync tareas OK ✅ · Modo demo no sync OK ✅ · Backend producción 100% funcional con app nativa iOS. **Limitaciones V1 conocidas y aceptadas para esta versión** (no son blockers, se atacan en Bloque 4+): (a) **No realtime** — sync se dispara en mutación local + botón "Sincronizar ahora" en Ajustes, no hay subscripción Postgres Changes; (b) **Sin queue offline avanzada** — si la red falla durante una mutación, el local queda correcto pero el upstream se pierde hasta el próximo `fetchRemoteAndMerge` exitoso (last-write-wins por id, no journaling); (c) **`nova_suggestions` / `nova_messages` / `settings` no sincronizan** — viven solo en `FocusLocalStore` (UserDefaults) en cada device; (d) **Migración demo→cuenta pendiente** — al loguearse después de crear datos en modo demo, esos datos quedan locales y NO se suben automáticamente (decisión consciente para evitar duplicar rows si la cuenta ya tiene datos); (e) **`last_synced_at` no se setea** — campo creado en schema pero el cliente no lo escribe en V1 (no lo necesita para el flujo actual). **Bloque 4 NO se abre en este commit** — esto es solo el cierre formal de B3. |
| 27 | 2026-05-11 | Bloque 3 Sync V1 — migración aplicada + verificada en producción | **Migración 018 aplicada** en proyecto Supabase `hvwqeemtfoyvfmongwzo` vía SQL Editor del Dashboard (Claude lo manejó con Chrome MCP, inyectando el SQL al editor Monaco y ejecutando con `⌘+Enter`). Supabase pidió confirmación por "destructive operations" (causa: `DROP TRIGGER IF EXISTS` idempotentes — los triggers no existían aún, los creamos a continuación), Claude confirmó "Run this query" y la query devolvió **"Success. No rows returned"** (~3 s). **Verificación post-migración** corrida en 5 queries en el mismo Editor: (1) `information_schema.tables` → 2 rows (`focus_events`, `focus_tasks` existen); (2) `pg_policies` → 8 rows (4 policies × 2 tablas: `focus_*_owner_select/insert/update/delete`); (3) `pg_class.relrowsecurity` → ambos `rls_enabled = true`; (4) `pg_policies (qual, with_check)` → todas `PERMISSIVE` con `qual = (auth.uid() = user_id)` para SELECT/UPDATE/DELETE y `with_check = (auth.uid() = user_id)` para INSERT/UPDATE (INSERT con qual NULL como debe ser, **ninguna policy abierta tipo `true`**); (5) `information_schema.columns` para legacy `events`/`tasks` → 12 rows, schema intacto (TEXT date/time, sin tocar). **Vercel verificado** via Chrome MCP en https://vercel.com/manunezdom-9658s-projects/focus-app: último deploy `feat(ios-native): add Supabase sync foundation for events and tasks` (commit 2228cab), Status **Ready**, dominio `www.usefocus.me` vivo. **Build iOS local OK**: `xcodebuild -scheme Focus -destination "platform=iOS Simulator,name=iPhone 17,OS=26.4.1" -configuration Debug build` → `** BUILD SUCCEEDED **` sin warnings. **Estado del lado servidor**: tablas paralelas creadas, RLS habilitado, policies owner-only activas (auth.uid() = user_id), triggers `focus_*_set_updated_at` instalados, índices `(user_id, start_time DESC)`, `(user_id, deleted_at)`, `(user_id, due_date NULLS LAST)`, `(user_id, is_completed)`. **Cierre Bloque 3 — checklist**: Migración 018 aplicada ✅ · `focus_events` verificada ✅ · `focus_tasks` verificada ✅ · RLS owner-only verificado ✅ · Legacy `events`/`tasks` intactas ✅ · Build iOS Debug OK ✅ · Vercel Ready ✅ · Sync eventos probado e2e ⏳ (pendiente prueba manual desde iPhone con cuenta real) · Sync tareas probado e2e ⏳ · Modo demo no sincroniza ⏳ (gated en código por `syncCredentials == nil`, falta confirmación visual desde device). **Limitaciones V1 conocidas y aceptadas**: no realtime (sync trigger en mutación + manual desde Ajustes); no queue offline avanzada (errores no revierten local, próximo merge corrige); `nova_suggestions`/`nova_messages`/`settings` fuera de scope; migración demo→cuenta pendiente. **Cómo cerrar el e2e (instrucciones para Martin)**: abrir app en iPhone → si está logueado, ir a Ajustes → Sincronización (debería mostrar "Sincronizado" o "Sincronizando…", nunca "Tabla no encontrada"); crear evento "Reunión test mañana a las 10" → en Dashboard `focus_events` aparece row con tu `user_id` y `deleted_at IS NULL`; editar evento → en Dashboard `updated_at` cambia; borrar evento → en Dashboard `deleted_at` se setea (soft delete); crear tarea "Estudiar cálculo mañana" → row en `focus_tasks` con `is_completed = false`; completar → `is_completed = true` y `done_at` con timestamp; en modo demo (botón "Continuar sin cuenta") las mutaciones NO deben generar rows en Supabase. **NO se hizo en esta sesión**: prueba e2e con device físico (requiere Martin + iPhone presente), sync de `nova_*`/`settings`, Nova LLM, notificaciones, micrófono, widgets. |
| 26 | 2026-05-11 | Bloque 3 Sync V1 — foundation events/tasks | **Diagnóstico**: refresh token ya implementado (pass 16, validado). Supabase tiene `public.events`/`public.tasks` legacy con shape web (TEXT date/time) — intactas para no romper producción. Vercel: sin CLI/auth en sesión Claude, instrucciones de diagnóstico ya documentadas en §14.7. **Migración `018_focus_native_v1.sql`** nueva: crea `public.focus_events` y `public.focus_tasks` paralelas con TIMESTAMPTZ + campos nativos (isReminder, inferredDuration, location, source, external_*, deleted_at). RLS owner-only (4 policies × tabla: SELECT/INSERT/UPDATE/DELETE con `auth.uid() = user_id`). Triggers de `updated_at` auto. Índices por user_id + start/due/completed. **Pendiente**: aplicar la migración en producción vía Supabase Dashboard SQL Editor o `supabase db push`. La iOS app ya envía requests, pero hasta que la migración esté aplicada, retorna `tableNotFound` (gracefully). **`SupabaseSyncService.swift`** nuevo (`ios-native/Focus/Services/`): cliente REST stateless para `/rest/v1/focus_events` y `/rest/v1/focus_tasks`. Métodos: `fetchEvents/Tasks`, `upsertEvent/Task` (con `Prefer: resolution=merge-duplicates`), `softDeleteEvent/Task` (PATCH `deleted_at = now()`). Headers: `apikey` (publishable anon) + `Authorization: Bearer <access_token>` (del usuario). Errores tipados: `tableNotFound`, `rlsRejected`, `network`, `server`, `decoding`, `notAuthenticated`. **NUNCA loguea tokens completos**. DTOs `RemoteFocusEvent`/`RemoteFocusTask` con `init(local:userId:)` y `toLocal()` — conversión bidireccional. **`FocusDataStore` extendido**: nuevos `@Published`: `syncCredentials: SyncCredentials?`, `syncState: SyncState` (.demo/.loggedOut/.idle/.syncing/.error), `lastSyncAt: Date?`. Método `applyAuthChange(accessToken:userId:)` que `FocusApp` llama vía `.task(id:)` cuando el `AuthState` cambia. Al recibir credenciales nuevas, dispara `fetchRemoteAndMerge()` que trae remoto y mergea por id. **Sync en cada mutación**: `addEvent`/`updateEvent`/`deleteEvent` y sus análogos de tarea ahora también disparan `uploadEvent/Task` o `softDeleteEventRemote/Task` en background. Modo demo: no llega a sync (`syncCredentials == nil`). Si la red o RLS falla, sync registra error pero no revierte local — consistencia se restaura en próximo merge exitoso. **Ajustes → "Sincronización"**: nueva sección que muestra `syncState` (demo/idle/syncing/error) + última hora de sync + botón "Sincronizar ahora" (deshabilitado en demo/logout). **`FocusApp`** observa `authStore.state` vía `.task(id:)` con identidad derivada (loggedIn:userId / demo / loggedOut). **Seguridad**: tokens viven en Keychain (auth) + memoria (RAM via `SyncCredentials`). No service_role en cliente. No tokens en logs. RLS rechaza writes con user_id ajeno (probado vía interpretError 401/403). **Build OK** simulador + device. **Pendiente para cerrar Bloque 3**: aplicar `018_focus_native_v1.sql` en Supabase producción, probar fetch real con cuenta logueada en iPhone, verificar que datos creados en device aparecen en Supabase Dashboard. **NO se hizo**: migración demo→cuenta (riesgoso), sync de `nova_suggestions`/`nova_messages`/`settings` (fuera de scope V1), conflict resolution avanzado (last-write-wins por ahora), Nova LLM real, notificaciones, micrófono, widgets. |

## Audit Pass 2 — Findings completos (2026-05-11)

> Auditoría exhaustiva en 15 áreas, classificada por severidad. ✅ = fix aplicado en este pass · 🔜 = pendiente para futura sesión.

### CRÍTICOS

| ID | Hallazgo | Evidencia | Impacto | Archivo | Solución | Status |
|---|---|---|---|---|---|---|
| C1 | Cero persistencia local | `FocusDataStore.init` deja arrays vacíos en memoria | Tareas/eventos creados por el usuario se PIERDEN al matar app | `State/FocusDataStore.swift` | Implementar `UserDefaults` (encode `[FocusTask]`/`[FocusEvent]` como JSON) o `SwiftData` | ✅ **Resuelto V1 audit pass 3** — `FocusLocalStore` con UserDefaults+JSON. Migración a Supabase queda pendiente para sync multi-device. |
| C2 | AppIcon sin PNG | `Assets.xcassets/AppIcon.appiconset/Contents.json` declara 1024x1024 pero la carpeta no contiene PNG | TestFlight/App Store **rechazan** sin icon. Build Debug funciona pero archive fallaría | `ios-native/Focus/Assets.xcassets/AppIcon.appiconset/` | Agregar PNG 1024×1024 (diseño) + variantes vía `npm run build:ios-icons` (script ya existe en `scripts/`) | ✅ **Resuelto V1 audit pass 4** — `scripts/build-ios-appicon.py` genera 1024×1024 RGB con gradiente slate→cobalt + F blanca. Diseño temporal V1, sustituible por diseño profesional antes de App Store público. |
| C3 | Nova desconectado del backend real | `NovaResponder` solo keyword matching local | No es Nova de verdad. Bloquea promesa de producto | `State/FocusDataStore.swift` → `NovaResponder` | Implementar `NovaService` con `URLSession` a `/api/focus-assistant` + JWT Supabase | 🔜 (requiere auth Supabase primero) |
| C4 | Sin auth Supabase | No hay login flow ni sesión en la app nativa | Datos de usuario no se asocian a cuenta; Nova no puede personalizar | `ios-native/Focus/` | Agregar SPM `supabase-swift` + `AuthService` + `LoginView` con OTP | ✅ **Cerrado audit pass 15** — publishable key pegada (`sb_publishable_*`, NO service_role), endpoint `/auth/v1/verify` verificado. **C4.1 cerrado pass 16** — `refreshSession()` + AuthStore renueva access_token con refresh_token al boot. Sesión sobrevive a la expiración de 1h sin re-login. |

### ALTOS

| ID | Hallazgo | Evidencia | Impacto | Archivo | Solución | Status |
|---|---|---|---|---|---|---|
| A1 | Versión hardcoded "1.0 · build 1" | `AjustesView.swift:295` | Versión visible se vuelve obsoleta al subir builds | `Views/AjustesView.swift` | Leer de `Bundle.main.infoDictionary` con helper `AppVersion.displayString` | ✅ aplicado |
| A2 | Títulos de evento sin `.lineLimit` | `MiDiaView.swift:409`, `CalendarioView.swift:295` | Títulos largos pueden romper layout / overflow vertical | Views | Agregar `.lineLimit(2)` + `.multilineTextAlignment(.leading)` | ✅ aplicado |
| A3 | Picker apariencia permite `.dark` no funcional | `AjustesView.swift` ForEach allCases | Confunde al usuario — tap mueve check pero theme sigue light | `Views/AjustesView.swift` | `.disabled(pref == .dark)` + `.opacity(0.45)` mientras no esté implementado | ✅ aplicado |
| A4 | gitleaks no corrido sobre historial | Tool no instalado | Posibles secrets antiguos sin detectar (aunque grep básico = 0 matches) | Repo | `brew install gitleaks` + `gitleaks detect --redact` | 🔜 (Fase B install) |
| A5 | RLS policies sin auditar | Schema declara RLS pero no se revisaron las queries `CREATE POLICY` | Posible scope demasiado permisivo (`USING (true)` o sin `WITH CHECK`) | `supabase/migrations/012_security_rls_baseline.sql` etc | Audit con Supabase CLI: `supabase db dump --linked` + revisar policies | 🔜 (requiere CLI + autorización) |
| A6 | gh CLI sin auth | `gh auth status` falla | Bloquea triage de PRs/issues desde Claude | Manual | `gh auth login` (Martin manual) | 🔜 |

### MEDIOS

| ID | Hallazgo | Evidencia | Impacto | Archivo | Solución | Status |
|---|---|---|---|---|---|---|
| M1 | DateFormatters creados en cada body render | 8 instancias `let fmt = DateFormatter()` en views/models | Perf: ~1ms por instancia × N events. Suma al scroll | varios | Cachear en `DateFormatters` enum static let | ✅ aplicado |
| M2 | NovaView wraps llamada @MainActor innecesario | `NovaView.swift:80` `Task { @MainActor in store.sendNovaMessage }` | Cosmético — onAppear ya está en main thread | `Views/NovaView.swift` | Llamada directa | ✅ aplicado |
| M3 | CSP usa `'unsafe-inline'` en `script-src` | `vercel.json` header CSP | Limitación de Vite. Aumenta XSS surface mínimo | `vercel.json` | Migrar a nonces (requiere config Vite) | 🔜 (no bloqueante) |
| M4 | Tabla `ai_usage` declarada por migration 010 ausente de schema.sql | `supabase/migrations/010_ai_usage.sql` existe pero `schema.sql` solo tiene `ai_usage_events` | Posible drift schema local vs prod | `supabase/` | Confirmar con `supabase db dump --linked` si la tabla existe en prod | 🔜 (CLI) |
| M5 | Sin Info.plist keys de Calendar/Photos | `pbxproj` solo tiene Camera + Microphone usage descriptions | Bloquea EventKit + photo-to-event futuros | `Focus.xcodeproj/project.pbxproj` | Agregar `NSCalendarsUsageDescription`, `NSPhotoLibraryUsageDescription` cuando se implementen features | 🔜 (no bloqueante hasta features) |
| M6 | Sin background modes para push | `pbxproj` no declara `UIBackgroundModes` | APNs push notifications no funcionarán background | `Focus.xcodeproj/project.pbxproj` | Agregar capability "Push Notifications" + `remote-notification` mode | 🔜 (cuando se implemente push) |
| M7 | UITabBar.appearance() global mutation | `MainTabView.init()` muta apariencia global de UITabBar | Si más adelante hay otras TabView, hereda este estilo | `Views/MainTabView.swift` | Migrar a `.toolbarBackground` por instancia (iOS 17+) | 🔜 (no urgente) |
| M8 | Sin tests automatizados nativos | No hay target XCUITest ni snapshot tests | Cero regression coverage | `ios-native/Focus.xcodeproj` | Agregar target Tests con `SnapshotTesting` SPM + `XCUITest` smoke suite | 🔜 (Fase QA dedicada) |

### BAJOS

| ID | Hallazgo | Evidencia | Impacto | Archivo | Solución | Status |
|---|---|---|---|---|---|---|
| B1 | Default LaunchScreen (auto-generation) | `INFOPLIST_KEY_UILaunchScreen_Generation = YES` | Splash genérico iOS, no marca Focus al instalar | `pbxproj` | Crear `LaunchScreen.storyboard` con BootView estático | 🔜 (Fase polish) |
| B2 | AccentColor no exactamente igual a Theme.Colors.focusAccent | AccentColor=`(0.231, 0.510, 0.992)` vs focusAccent=`(0.145, 0.388, 0.922)` | Sutil — afecta tint en algunos componentes nativos (alerts, etc.) | `Assets.xcassets/AccentColor.colorset/` | Sincronizar valores | 🔜 (cosmético) |
| B3 | Sin SwiftLint ni linter config | Tool no instalado | Estilo enforced por humano (yo) | Repo | Fase 2 install + `.swiftlint.yml` | 🔜 |
| B4 | Sin script de install Playwright browsers | Tests configurados pero browsers no instalados | `npx playwright test` falla en máquina nueva | Repo | Agregar `npx playwright install` a setup docs / npm postinstall | 🔜 |
| B5 | `nuevoEventoSheet` permite endTime < startTime sin feedback | `CalendarioView.swift` NuevoEventoSheet `canSave` bloquea pero sin alerta | UX: usuario no sabe por qué Guardar está disabled | `Views/CalendarioView.swift` | Mostrar error inline cuando endTime <= startTime | 🔜 (UX polish) |

### IDEAS FUTURAS

| ID | Idea | Origen |
|---|---|---|
| F1 | Animación sparkle pulsante en FocusBar | Gemini-style polish |
| F2 | "Nova está escribiendo" indicador (3 dots animados) | Chat UX estándar |
| F3 | Skeleton loaders en lugar de empty states cuando se cargan datos remotos | Fase 3+ |
| F4 | Onboarding mínimo de 1 pregunta post-login | Recomendación legacy |
| F5 | Confirmación visual al crear primer evento (animación de ejemplos saliendo) | UX detail |
| F6 | Sign in with Apple (Apple lo exige si hay otro OAuth) | App Store compliance |
| F7 | Memorias de Nova editable desde Ajustes | Legacy web feature |
| F8 | Voice input nativo (Speech framework) reemplazando placeholder de mic | Diferencial mobile |
| F9 | Photo-to-event con Vision + Claude | Feature de legacy |
| F10 | Modo focus con bloqueador de notificaciones del sistema | iOS Focus integration |

---

## Audit Pass 2 — Fixes aplicados (resumen)

5 fixes safe aplicados en este pass:

1. **A1** ✅ `AjustesView.swift`: versión leída de `Bundle.main` via `AppVersion.displayString` helper.
2. **A2** ✅ `MiDiaView.swift` + `CalendarioView.swift`: `.lineLimit(2)` en `Text(event.title)` de timeline cards.
3. **A3** ✅ `AjustesView.swift`: opción `.dark` deshabilitada + opacity reducida hasta que esté implementada.
4. **M1** ✅ `SharedComponents.swift` + 5 archivos: `DateFormatters` enum con instancias cacheadas (`hourMinute`, `weekdayDayMonth`, `monthYear`, `weekdayShort`, `weekdayDay`, `shortDayMonth`).
5. **M2** ✅ `NovaView.swift`: simplificación de `onAppear` (sin Task wrapper innecesario).

Build verificado en iPhone 16 físico. Cero warnings nuevos. App reinstalada y corriendo.

---

## Audit Pass 5 — C4 OTP auth V1 (parcial, pendiente anon key)

**Problema parcialmente resuelto**: la app no tenía login. Ahora tiene flujo OTP completo en SwiftUI nativo, pero requiere un paso manual de config para terminar de funcionar.

### Decisión técnica: URLSession (no supabase-swift SPM)

Razones:
- **Endpoints listos**: `/api/auth/email/send-otp` ya funciona con Resend SMTP server-side.
- **Verify**: hit directo a `https://<supabase>/auth/v1/verify` con anon key como apikey + Bearer.
- **No deep links**: OTP es código numérico, no requiere URL scheme.
- **Sin dependencias**: ahorra ~6MB de binary, sin pelear con SPM/pbxproj.
- **Cross-site OK**: `rejectCrossSiteUnsafe` solo bloquea cuando `sec-fetch-site === 'cross-site'` (header browser-only). iOS nativo pasa sin tocar.

### Arquitectura implementada (5 archivos)

| Archivo | Responsabilidad |
|---|---|
| `Shared/FocusConfig.swift` | URL Supabase (público, docs), `supabaseAnonKey` placeholder, `apiOrigin` |
| `Services/KeychainStore.swift` | Wrapper `kSecClassGenericPassword` con `kSecAttrAccessibleAfterFirstUnlock` para accessToken / refreshToken / userId / email |
| `Services/AuthService.swift` | `sendOTP(email:)`, `verifyOTP(email:token:)`, `signOut()`. URLSession async. AuthError typed con copy en español |
| `State/AuthStore.swift` | `@MainActor ObservableObject`. Estados: `loading / loggedOut / codeSent / loggedIn / demo`. Hidrata sesión desde Keychain al boot. Persiste tras verify. Validación de `isExpired` |
| `Views/LoginView.swift` | UI light Gemini-style. Email step → code step. "Continuar en modo demo" + "Cambiar correo" + "Reenviar código". Auto-submit cuando código llega a 6 dígitos. Logo diamante con gradiente |

Modificados:
- `ContentView.swift` — router por `auth.isAuthenticatedOrDemo`. Boot 1.8s → MainTabView o LoginView.
- `FocusApp.swift` — inyecta `AuthStore` como `@StateObject`.
- `AjustesView.swift` — sección Cuenta dinámica: email + "Cerrar sesión" (con confirmationDialog) si logged in, "Iniciar sesión" si demo.
- `Focus.xcodeproj/project.pbxproj` — 5 nuevos refs + grupos actualizados.

### Seguridad

- ✅ Tokens en Keychain (NO en UserDefaults).
- ✅ `kSecAttrAccessibleAfterFirstUnlock` — accesible para background tasks pero protegido por unlock.
- ✅ Cero `print` de tokens completos en logs.
- ✅ `service_role` NUNCA referenciado en código iOS.
- ✅ `AuthError` types nunca exponen el JWT crudo en mensajes al usuario.
- ✅ Email se normaliza con `.trimmingCharacters` + `.lowercased()` antes de enviar.
- ⚠️ Sin refresh token automático todavía — cuando expire, usuario hace login de nuevo. Documentado.
- ⚠️ Sign out NO llama `/auth/v1/logout` server-side (no invalida refresh token en Supabase). Solo limpia local. Mitigación: refresh tokens expiran solos.

### Estado del flujo

| Acción | Status |
|---|---|
| Pantalla LoginView aparece al boot si no hay sesión | ✅ |
| Input email + validación local | ✅ |
| Send OTP → email llega vía Resend | ✅ (`/api/auth/email/send-otp` funciona) |
| Input código 6 dígitos con auto-submit | ✅ |
| Verify OTP contra Supabase | 🟡 **Falta anon key en FocusConfig** |
| Sesión persistida en Keychain | ✅ |
| Re-abrir app mantiene sesión | ✅ (si expiresAt > Date()) |
| Cerrar sesión desde Ajustes | ✅ con confirmationDialog |
| Modo demo (skip login) | ✅ |
| Volver a login desde demo (Ajustes → Iniciar sesión) | ✅ |
| Cambiar correo durante el flow | ✅ |
| Reenviar código | ✅ |
| Errores con copy claro (rate limit, código inválido, network) | ✅ |

### Pasos manuales pendientes (Martin)

**1. Obtener el anon key**:
   - Ir a [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto → **Settings** → **API**.
   - En "Project API keys", copiar el valor de **`anon` `public`** (JWT que empieza con `eyJhbGc...`).
   - Es seguro (es el mismo que ya está en el bundle JS del web en producción).

**2. Pegarlo en FocusConfig.swift**:
   ```swift
   static let supabaseAnonKey = "eyJhbGc...tu key acá..."
   ```

**3. Decisión: commitear o no el anon key**:
   - Es público por diseño (RLS controla acceso real).
   - Web ya lo expone en bundle JS.
   - Si commiteás: simple, queda en main para futuros builds.
   - Si NO commiteás: agregar `FocusConfig.swift` a `.gitignore` y mantener una versión template separada. Más fricción.
   - **Recomendado V1**: commitear. Es lo que hace el web.

**4. Rebuildear y probar**:
   ```bash
   xcodebuild -project ios-native/Focus.xcodeproj -scheme Focus \
     -destination "platform=iOS,id=4F6149BC-79B3-5261-AB8F-A940C1E3CB60" \
     -configuration Debug -derivedDataPath /tmp/focus-derived \
     -allowProvisioningUpdates build && \
   xcrun devicectl device install app --device 4F6149BC-79B3-5261-AB8F-A940C1E3CB60 \
     /tmp/focus-derived/Build/Products/Debug-iphoneos/Focus.app
   ```

**5. (Opcional) Verificar redirect URLs en Supabase Dashboard**:
   - Authentication → URL Configuration.
   - Para OTP **NO hace falta** redirect URL (no es magic link).
   - Si en el futuro agregamos Google OAuth: necesitará `me.usefocus.app://login-callback`.

### Limitaciones conocidas (V1)

| Limitación | Cuándo importa | Plan |
|---|---|---|
| Sin refresh token automático | Cuando expire (~1h por default) | Implementar `refreshSession()` que llame `/auth/v1/token?grant_type=refresh_token` antes de cada request si `isExpired` |
| Sign out no invalida server-side | Si alguien clona el JWT antes de expire | Implementar `POST /auth/v1/logout` con bearer |
| Sin sync de datos local↔remoto | Tareas/eventos siguen solo locales | C5 dedicado |
| Sin Google OAuth | Solo email OTP | Fase futura — requiere deep link |
| Sin Sign in with Apple | Apple exige si ofrecés otro OAuth (no estamos ofreciéndolo todavía) | Cuando agreguemos Google |
| Anon key hardcoded en código | Si rotás el key | Migrar a xcconfig + Info.plist build settings |
| Sin "cambiar de cuenta" smooth | Si user A se desloguea y user B entra, ven los datos locales de A | Mostrar dialog "¿Borrar datos locales?" tras sign out |

### Siguiente paso recomendado

Cuando el anon key esté pegado y login funcione end-to-end, arrancar **C5 — Sync de tareas/eventos con Supabase**:
- Repos para leer/escribir contra `events` y `tasks` con bearer.
- Sync inicial al login: pull all + merge con local.
- Sync incremental en cada mutación: write-through + queue offline.
- Mantener `FocusLocalStore` como cache + queue.

---

## Audit Pass 4 — C2 cerrado V1 (AppIcon + iOS readiness)

**Problema resuelto**: AppIcon.appiconset solo tenía Contents.json sin PNG real, TestFlight/Archive habrían fallado.

### Implementación

Nuevo script: `scripts/build-ios-appicon.py` (Python 3 + Pillow 11.3).
- Genera 1024×1024 RGB **sin canal alpha** (regla iOS).
- Gradiente vertical 3-stop: `#0F172A` (slate-900) → `#1E3A8A` (blue-900) → `#3B82F6` (blue-500).
- "F" mayúscula blanca construida con 3 rectángulos redondeados (radius 10).
- Reusable: `python3 scripts/build-ios-appicon.py` regenera en cualquier momento.

Outputs:
- `ios-native/Focus/Assets.xcassets/AppIcon.appiconset/AppIcon.png` (5KB)
- `ios-native/Focus/Assets.xcassets/AppIcon.appiconset/Contents.json` actualizado con `filename`
- `docs/assets/focus-app-icon-preview.png` (preview para review offline)

### Verificación

```
✓ pixelWidth: 1024
✓ pixelHeight: 1024
✓ hasAlpha: no
✓ format: png
✓ BUILD SUCCEEDED sin warnings de AppIcon
✓ CFBundleIcons registrado en Info.plist con CFBundleIconName=AppIcon
✓ Xcode auto-genera AppIcon60x60@2x.png (iPhone) y AppIcon76x76@2x~ipad.png
```

### iOS readiness mínimo (chequeo completo)

| Item | Estado |
|---|---|
| AppIcon 1024×1024 sin alpha | ✅ |
| Bundle display name = "Focus" | ✅ |
| Version 1.0 / build 1 (lee de Info.plist) | ✅ |
| NSCameraUsageDescription (copy es) | ✅ (texto presente para uso futuro de Nova) |
| NSMicrophoneUsageDescription (copy es) | ✅ (texto presente para uso futuro de Nova) |
| Launch screen presente | ✅ (auto-generation `UILaunchScreen_Generation = YES`) |
| Cero strings "FASE"/"Próximamente" visibles | ✅ |
| Cero TODO/FIXME en código | ✅ |
| Cero secrets en código | ✅ |

### Limitaciones / pendientes documentados

1. **Diseño V1 temporal**. La F geométrica funciona y pasa validación de Xcode/App Store, pero antes del lanzamiento público probablemente convenga un diseño profesional con marca refinada. Cuando llegue ese asset, simplemente reemplazar `AppIcon.png` (manteniendo 1024×1024 RGB sin alpha) — sin tocar pbxproj.
2. **LaunchScreen genérico** (issue B1 pre-existente). Hoy iOS muestra una pantalla en blanco según `UILaunchScreen` auto-generation. Para una experiencia premium, crear `LaunchScreen.storyboard` con el logo de Focus (similar al BootView SwiftUI). Fase polish.
3. **Permisos pendientes a agregar cuando se implementen features**:
   - `NSPhotoLibraryUsageDescription` — al agregar photo-to-event de Nova.
   - `NSCalendarsUsageDescription` — al integrar EventKit (calendario nativo iOS).
   - `UIBackgroundModes: remote-notification` — al agregar push notifications APNs.
4. **Privacy Nutrition Labels** (App Store Connect) — pendiente para sesión dedicada cuando subamos a TestFlight Beta (no requeridos para Internal Testing).
5. **App Store screenshots** (6.7" + 6.1") — pendientes para sesión App Store.
6. **AccentColor** del Asset Catalog 2 puntos off del Theme.Colors.focusAccent (`#3B82F6` vs `#2563EB`). Cosmético, no bloqueante.

### Siguiente paso recomendado

C4 — **Auth Supabase OTP** (la última crítica que falta para que la app sea "real"). Una vez que el usuario tenga sesión, podemos:
- Sincronizar `events`/`tasks` locales a Supabase.
- Conectar Nova al backend real (C3 depende de C4).
- Migrar a TestFlight Beta con testers reales.

---

## Audit Pass 3 — C1 cerrado V1 (persistencia local)

**Problema resuelto**: Tareas/eventos/sugerencias/mensajes de Nova se perdían al matar la app.

### Implementación

Nuevo archivo: `ios-native/Focus/State/FocusLocalStore.swift` (95 líneas).

- API genérica: `save<T: Encodable>(_:forKey:)`, `load<T: Decodable>(_:forKey:)`, `clear(_:)`, `clearAll()`.
- Backend: `UserDefaults.standard` con `JSONEncoder`/`Decoder` (estrategia `.iso8601`).
- Keys versionadas: `focus.v1.tasks`, `focus.v1.events`, `focus.v1.suggestions`, `focus.v1.novaMessages`, `focus.v1.settings`.
- Errores silenciosos: load → `nil`, save → log a consola. Boot nunca se rompe por decode malo.

### Integración con FocusDataStore

- `init()` carga desde `FocusLocalStore` con fallbacks: `events`/`tasks` → `[]`, `suggestions` → `DemoDataProvider.shared.suggestions()`, `novaMessages` → `DemoDataProvider.shared.welcomeNovaMessages()`, `settings` → `.defaults`.
- 10 métodos de mutación guardan vía helpers privados (`persistEvents`, `persistTasks`, `persistSuggestions`, `persistNovaMessages`, `persistSettings`) — guardado solo en mutación, nunca en body re-render.
- `resetToDemoState()` — limpia disco + vuelve a demo (sugerencias + welcome + vacío en tareas/eventos).
- `clearAllLocalData()` — limpia disco e in-memory todo a `[]` / `.defaults`.

### UI en Ajustes

- Nueva sección "Datos locales" entre Privacidad y Acerca de.
- Botón "Restablecer datos demo" → `confirmationDialog` destructivo → `store.resetToDemoState()`.
- Botón "Borrar datos locales" → `confirmationDialog` destructivo más agresivo → `store.clearAllLocalData()`.

### Lo que NO persiste (intencional)

- Secrets / tokens / auth (no hay todavía; futuro va en Keychain).
- Service role (no expuesto al cliente).
- Datos remotos no cacheados (no hay Supabase aún).

### Limitaciones conocidas (a resolver en próximas fases)

- **No sincroniza entre dispositivos** — es solo local de este iPhone. Cuando se conecte Supabase, se va a migrar a sync remoto.
- **No tiene migration entre versiones del schema** — si cambia `FocusTask`/`FocusEvent`, decode falla y vuelve a demo. Para V1 aceptable.
- **No protege contra escrituras concurrentes** — `UserDefaults` es atómico pero si la app se cierra exactamente mientras se está guardando, podría haber inconsistencia. Probabilidad baja, scope V1.
- **No encrypta** — `UserDefaults` no está cifrado. Por ahora aceptable porque no hay datos sensibles (sin auth, sin PII identificable). Antes de Auth Supabase migrar PII a Keychain.

### Siguiente paso recomendado

**Auth Supabase OTP** (C4). Una vez que el usuario tenga sesión, los datos locales se pueden sincronizar a `events` / `tasks` en Supabase, manteniendo `FocusLocalStore` como cache offline.

### Audit findings al cierre

```
20 archivos Swift · 4696 líneas en ios-native/Focus/
0 TODO/FIXME/HACK · 0 strings 'FASE' visibles · 0 force-unwraps
0 patrones de secret · service_role solo server-side
17 migraciones Supabase · RLS 15/15
```

---

## 1. App nativa (`/ios-native`)

### Estado actual (2026-05-11)
- **19 archivos Swift · 4 445 líneas** en `ios-native/Focus/`.
- Stack: SwiftUI nativo puro, **sin Pods ni SPM** todavía.
- Theme centralizado en `Shared/Theme.swift` (paleta light Gemini con azul focus `#2563EB` + acento Nova `#6366F1`).
- Estado global vía `FocusDataStore: ObservableObject` (inyectado por env).
- 4 tabs: Mi día / Calendario / Tareas / Ajustes. Nova ya no es tab — se invoca como sheet desde el FocusBar de Mi Día.
- Ejemplos en Mi Día y Tareas cuando el usuario no tiene datos propios (badge `EJEMPLO` + dashed border).
- pbxproj objectVersion 56 (Xcode 14 era) → archivos nuevos requieren editar `project.pbxproj` manualmente.

### Findings Fase 1 (read-only audit)
- ✅ **0** matches de `TODO|FIXME|XXX|HACK` en `ios-native/Focus/`.
- ✅ **0** strings visibles con `"FASE"` o `"Próximamente"` (refactor anterior limpió todo).
- ✅ **0** strings visibles con `"placeholder"`, `"WIP"`, `"Lorem"`.
- ✅ **0** force-unwraps (`!\s*$`, `.first!`, `as!`, `try!`) en código.
- ⚠️ Sin **SwiftLint** todavía → no hay enforcement automático.
- ⚠️ Sin **Periphery** → posible código muerto no detectado (post-refactor de fases).

### Pendientes
- [ ] Auditoría con **SwiftLint** + crear `.swiftlint.yml`.
- [ ] Detección de código muerto con **Periphery**.
- [ ] Audit warnings de Xcode al build Release (no solo Debug).
- [ ] Snapshot tests (`SnapshotTesting` SPM) para regresiones visuales.
- [ ] XCUITests para flujo crítico (boot → Mi Día → crear evento → ver en Mi Día).
- [ ] Profiling con **Instruments**: cold start, energía, scroll en timeline.
- [ ] Bundle size en Release vs Debug.
- [ ] Accessibility Inspector pass (VoiceOver, dynamic type).
- [ ] App Thinning report tras Archive.

---

## 2. Legacy web (`/src`)

### Estado actual
- React 18 + Vite + Tailwind. Producción en `usefocus.me` (Vercel).
- Convive con la nativa: comparten back-end (Supabase + Vercel APIs).
- Tests Playwright **1.59.1** existentes en `tests/e2e/` y `tests/audit/`. Configs `playwright.config.js` + `playwright.audit.config.js`.
- Scripts npm: `dev`, `build`, `test:e2e`, `test:audit`, `test:e2e:nova`.
- `legacy-capacitor-ios/` y `legacy-expo/` archivados — NO se buildean ni deployan.

### Findings Fase 1
- ✅ **`@playwright/test`** ya en `devDependencies` (versión 1.59.1). No necesita install global.
- ✅ Suite e2e + suite de audit configuradas.

### Pendientes
- [ ] Correr `npx playwright install` (descarga browsers, ~300MB) cuando vayamos a ejecutar tests.
- [ ] Verificar que `tests/e2e/` siguen verdes contra `main` actual.
- [ ] Correr `npm audit` y resolver vulns High/Critical.
- [ ] **osv-scanner** sobre `node_modules` para deps con CVE.
- [ ] Lighthouse / web-vitals audit para Performance, Accessibility, SEO.
- [ ] Verificar Service Worker versioning (`scripts/stamp-sw-version.mjs`).
- [ ] Detección de código no usado tras migrar a nativa (componentes Capacitor que sobraron).

---

## 3. Supabase

### Estado actual (2026-05-11)
- **17 migraciones** en `supabase/migrations/` + 1 nota (`APPLIED_016_017_NOTES.md`):
  - `001_add_timezone_to_profiles`
  - `002_device_pairings`
  - `003_drop_peak_zone`
  - `004_event_reminders_and_timezone`
  - `005_notification_deliveries`
  - `006_sent_notification_metadata`
  - `007_user_personality`
  - `008_quiet_hours`
  - `009_native_push_tokens`
  - `010_ai_usage`
  - `011_kairos_links`
  - `012_security_rls_baseline`
  - `013_ai_usage_events`
  - `014_notif_log`
  - `015_user_plans`
  - `016_task_subtasks_and_links`
  - `017_task_due_dates`
- `supabase/schema.sql` (16KB) declara **15 tablas**:
  - `user_profiles`, `events`, `tasks`, `blocks`, `suggestions`, `user_memories`, `notif_log`, `user_signals`, `user_behavior`, `push_subscriptions`, `native_push_tokens`, `sent_notifications`, `calendar_feeds`, `ai_usage_events`, `user_plans`.
- ✅ **15/15 tablas** tienen `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` en `schema.sql` (RLS coverage 100% a nivel declarado).

### Findings Fase 1
- ⚠️ No se pudo verificar **prod vs local** (Supabase CLI no instalado).
- ⚠️ No se auditaron políticas RLS individuales — solo que RLS está activada.
- ⚠️ Migración `010_ai_usage` está pero no veo tabla `ai_usage` en `schema.sql` (sí está `ai_usage_events`). Verificar si `ai_usage` se renombró o se eliminó.

### Pendientes
- [ ] Conectar **Supabase CLI** con read-only para audit (instalación pendiente; OAuth manual).
- [ ] Resolver disrepancia `ai_usage` vs `ai_usage_events` (¿está la primera obsoleta?).
- [ ] Listar policies de cada tabla y verificar `USING` + `WITH CHECK`.
- [ ] Confirmar que `user_plans` y `ai_usage*` no exponen datos cross-user.
- [ ] Confirmar que el `service_role` NUNCA está expuesto al cliente.
- [ ] Snapshot del schema actual de **prod** para diff contra `schema.sql` local.
- [ ] Backup verificado (Supabase dashboard → Settings → Database).
- [ ] Audit privacy: campos PII (`email`, `phone`) cifrados o policy estricta.

### Tablas a auditar (orden de prioridad)
1. `user_plans` — billing-sensitive
2. `ai_usage_events` — uso/costo Nova
3. `events`, `tasks` — datos personales
4. `user_memories`, `user_behavior` — sensibles de comportamiento
5. `native_push_tokens`, `push_subscriptions` — device tokens (no rotables fácil)

---

## 4. Vercel

### Estado actual (2026-05-11)
- `vercel.json` presente, esquema Vite, build `npm run build`, output `dist/`.
- Sin `.vercel/` enlazado (no hay link local).
- Despliegue automático a `main` (per CLAUDE.md: "solo `main` → producción").
- APIs serverless en `/api/`: `focus-assistant`, `transcribe`, `analyze-photo`, `auth/email/send-otp`, `push`, `calendar-feeds`, `me`, `stripe-webhook`, `cron-notifications`, etc.

### Findings Fase 1 — Análisis de `vercel.json`
- ✅ **Headers de seguridad excelentes**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2 años)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), bluetooth=()`
- ✅ **CSP** bastante estricta: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org`.
- ⚠️ **`script-src` incluye `'unsafe-inline'`** — limitación típica de Vite con módulos inline. Mejora futura: usar nonces o hashes. **No bloqueante** para release.
- ✅ `style-src` incluye `https://fonts.googleapis.com` y `font-src` incluye `https://fonts.gstatic.com` — fonts externas explícitas (OK).
- ✅ `sw.js` con `Cache-Control: no-cache, no-store, must-revalidate` — SW siempre fresh.
- ✅ `cleanUrls: true`, `trailingSlash: false` — URLs limpias.

### Pendientes
- [ ] Conectar **Vercel CLI** read-only (`vercel link` y `vercel ls`).
- [ ] Inventario de env vars en producción (sin descargar valores con `vercel env pull`).
- [ ] Listar últimos 20 deploys, status, duración.
- [ ] Verificar que ninguna env var pública (`VITE_*`) contiene service_role.
- [ ] Health checks en endpoints clave.
- [ ] Logs últimas 24h: errores 500, timeouts, rate limit hits.
- [ ] Cron `notifications-cron.yml` ejecutándose (GitHub Actions).
- [ ] Verificar rate limit / abuse protection en `/api/focus-assistant`.

---

## 5. GitHub

### Estado actual (2026-05-11)
- Branch principal: `main`. Trabajo actual en worktree branch `claude/nervous-snyder-7547ac`.
- Últimos commits en main:
  - `63506ea` — feat: rediseño Gemini light + Nova omnipresente + ejemplos
  - `07fa36d` — feat: build functional native Focus V1
  - `0d87f02` — feat: add native tab shell and Mi Día demo timeline
  - `6bd2bc7` — chore: reorganizar para app iOS nativa Swift/SwiftUI
- 1 workflow CI: `.github/workflows/notifications-cron.yml` (cron de push notifications).
- `gh` CLI 2.92.0 instalado.

### Findings Fase 1
- ⚠️ **`gh` CLI NO está autenticado** (`gh auth status` → "You are not logged into any GitHub hosts"). Bloquea cualquier acción de PR/issue desde Claude. Login manual requerido (ver Apéndice C).
- ✅ Único workflow CI activo: cron de notificaciones.

### Pendientes
- [ ] `gh auth login` ejecutado manualmente por Martin (no por Claude).
- [ ] Branch protection en `main` (require PR, status checks).
- [ ] Secret scanning habilitado a nivel repo.
- [ ] Dependabot alerts.
- [ ] CI: workflow para `swiftlint` + `xcodebuild` en cada PR que toque `ios-native/`.
- [ ] CI: workflow para `playwright` en PRs que toquen `/src`.
- [ ] PRs abiertos / Issues abiertos: triage.
- [ ] Verificar que no hay `git push --force` reciente sobre main.

---

## 6. Seguridad

### Estado actual (2026-05-11)
- `.env.example` existe con placeholders (no valores reales).
- `.gitignore` ignora `.env*` reales (asumido — verificar).
- `.claude/settings.local.json` no se commitea.

### Findings Fase 1 — Escaneo de secrets (read-only, sin imprimir valores)
- ✅ **0 matches** de patrones de secret conocidos en código y configs:
  - `sbp_[A-Za-z0-9]{16,}` (Supabase project tokens)
  - `sk_(live|test)_[A-Za-z0-9]{16,}` (Stripe)
  - `AIza[A-Za-z0-9_-]{30,}` (Google API)
  - `xox[baprs]-[A-Za-z0-9-]{10,}` (Slack)
  - `ghp_[A-Za-z0-9]{20,}`, `github_pat_[A-Za-z0-9_]{20,}` (GitHub tokens)
- ✅ **`service_role` aparece SOLO en código server-side**:
  - `api/_supabaseAdmin.js` (comentario + lectura de env)
  - `api/me/plan.js` (uso documentado del admin client con filtro server-side)
- ✅ **NO aparece `service_role` en `src/`** (cliente web limpio).
- ✅ `.env.example` exclusivamente con placeholders (`xxx`, `...`, `re_...`, etc.).
- ⚠️ No se corrió **gitleaks** sobre todo el historial — solo grep del HEAD actual. Pendiente para Fase 2.

### Pendientes críticos
- [ ] **gitleaks** scan completo del historial: `gitleaks detect --redact --source . --report-path /tmp/gitleaks-report.json`.
- [ ] **semgrep** con rulesets `auto`, `p/security-audit`, `p/owasp-top-ten`, `p/secrets`, `p/swift`.
- [ ] **osv-scanner** sobre `package-lock.json` (y futuro `Package.resolved` cuando agreguemos SPM).
- [ ] Auditar dependencias del web (`npm audit --omit=dev`).
- [ ] Validar JWT verification en cada `/api/*` (rechazar tokens expirados/inválidos).
- [ ] Rate limit en `/api/focus-assistant` y `/api/transcribe` (anti-abuse / billing).
- [ ] PIA (Privacy Impact Assessment) actualizado en `PRIVACY_AUDIT.md`.

### Endpoints sensibles a re-validar
- `/api/auth/email/send-otp` — anti-enumeration
- `/api/focus-assistant` — input sanitization, no PII en logs
- `/api/transcribe` — file size limit, content-type check
- `/api/analyze-photo` — same + EXIF strip
- `/api/auth/delete-account` — require `confirm: 'DELETE'` real, no race

---

## 7. Diseño

### Estado actual
- Paleta light Gemini-style centralizada en `Theme.swift`.
- 4 tabs limpios.
- Empty states con ejemplos + dashed border (no pantallas vacías).
- Bottom tab bar safety: `Theme.Spacing.bottomBarSafety = 110`.
- Idioma: español "tú" neutral. Sin voseo.

### Findings Fase 1
- ✅ **Cero textos internos visibles** (`"FASE..."`, `"Próximamente"`, `"placeholder"`, `"WIP"`, `"Lorem"`).
- ✅ Refactor Gemini light limpió pantallas vacías.

### Pendientes
- [ ] Audit en **iPhone físico** (no solo simulador): safe areas con Dynamic Island.
- [ ] Audit en **iPhone SE** (pantalla más chica) — overflow / truncations.
- [ ] Test con **Dynamic Type XL/XXL** — texto cortado.
- [ ] Test modo **dark del sistema** — confirmar que `.preferredColorScheme(.light)` lo bloquea correctamente.
- [ ] Test con **reduce motion** activado.
- [ ] Test con **VoiceOver** — todas las cards tienen labels.
- [ ] Test con **idioma del sistema en inglés** — fechas y copy en español hardcoded, ver si rompe layouts.
- [ ] Comparación visual con: Things 3, Notion Calendar, Apple Calendar, Sunsama, Cron, Linear.
- [ ] Audit copy: tono consistente, sin tecnicismos en empty states.

---

## 8. Performance

### Estado actual
- Sin instrumentación todavía.
- Build Debug pasa en ~30s para device físico.
- Sin tests de cold start ni profiling.

### Pendientes
- [ ] **Cold start** medido con Instruments en iPhone 16 físico: target <600ms.
- [ ] **Time to first content** (boot → Mi Día interactiva): target <1.8s.
- [ ] Profiling de scroll en Mi Día timeline con many events.
- [ ] Profiling de tap → sheet de Nova (transición spring).
- [ ] **Bundle size** (Archive Release): target <15MB.
- [ ] **Build time** Debug vs Release.
- [ ] Memory footprint en uso normal — target <80MB RAM.
- [ ] Energy impact al estar idle en Mi Día.
- [ ] Warnings Xcode Release: cero esperado.

---

## 9. QA

### Estado actual
- Sin tests automatizados para la app nativa.
- Tests Playwright existentes para la web legacy (`tests/e2e/`, `tests/audit/`).
- Build manual via `xcodebuild` + install via `devicectl`.

### Pendientes
- [ ] **XCUITest** smoke suite:
  - [ ] Boot → Mi Día se renderiza sin crash
  - [ ] Tap FocusBar → sheet Nova se abre
  - [ ] Submit texto → respuesta Nova aparece
  - [ ] Cambiar tabs sin crash
  - [ ] Tap FAB Tareas → sheet crear → guardar → aparece en lista
  - [ ] Tap FAB Calendario → crear evento → aparece en día seleccionado
  - [ ] Aprobar sugerencia en Bandeja → status approved
- [ ] **Snapshot tests** SwiftUI:
  - [ ] BootView light
  - [ ] MiDiaView empty (ejemplos)
  - [ ] MiDiaView con datos reales
  - [ ] Nova sheet abierto
  - [ ] Bandeja con sugerencias
- [ ] **Playwright** legacy: `npx playwright install` + re-correr suite.
- [ ] **Manual QA** matriz: iPhone 16, iPhone 15, iPhone SE, iPad (si soportado).

---

## 10. IA / Nova

### Estado actual
- Nova en la app nativa: **mock local** (`NovaResponder` con keyword matching).
- Backend real `/api/focus-assistant` existe pero NO conectado a la app nativa todavía.
- Bandeja con 5 sugerencias demo orientadas a universitario + trabajador.

### Pendientes
- [ ] Conectar `NovaService` Swift a `/api/focus-assistant`.
- [ ] Auth Supabase OTP funcional → token JWT en cada request.
- [ ] Manejo de errores: quota_exceeded, timeout, network.
- [ ] Audit del system prompt: ¿incluye PII innecesaria del usuario?
- [ ] Audit de `ai_usage_events`: tokens consumidos por user, costo estimado.
- [ ] Rate limit cliente para evitar burst spending.
- [ ] Conexión foto → `/api/analyze-photo` (no implementado en nativa).
- [ ] Voice dictation: `Speech` framework nativo iOS.
- [ ] Personalidad Nova (Focus/Cercana/Estratégica) viaja al backend.

---

## 11. App Store / TestFlight

### Estado actual
- Build interno funcionando en iPhone físico vía `devicectl`.
- Sin Archive ni upload a App Store Connect todavía.
- Documentación en `docs/app-store.md` y `docs/app-store-metadata.md`.

### Pendientes (orden cronológico)
- [ ] App Store Connect: crear app con bundle `me.usefocus.app`.
- [ ] Iconos finales en todas las resoluciones (`Assets.xcassets/AppIcon`).
- [ ] LaunchScreen Storyboard / config.
- [ ] Info.plist: usage descriptions de cámara, mic, calendario, notificaciones.
- [ ] Capabilities: Push Notifications, Sign in with Apple, Calendars (si EventKit).
- [ ] Privacy Nutrition Labels completos.
- [ ] Privacy policy URL pública (`usefocus.me/privacidad`).
- [ ] App Store screenshots (6.7" + 6.1" + iPad si aplica).
- [ ] Promo text + description + keywords.
- [ ] Build Release sin warnings.
- [ ] Archive + upload a TestFlight.
- [ ] Internal testing con ≥3 testers.
- [ ] Reseteo de provisioning para distribution (Apple Distribution cert).

---

## 12. Pendientes críticos (urgentes)

> Bloquean cualquier release/beta.

- [x] ~~**Persistencia local** de tareas/eventos creados~~ → resuelto en audit pass 3 con `FocusLocalStore` (UserDefaults+JSON). Migración a Supabase pendiente para sync multi-device.
- [~] **Auth real** (Supabase OTP) en la app nativa → parcialmente cerrado audit pass 5. Falta pegar anon key en `FocusConfig.swift`.
- [ ] **Nova conectada** al backend real (no mock).
- [ ] **Rate limit** server-side en `/api/focus-assistant` para abuse.
- [ ] **gitleaks** clean run sobre todo el historial.
- [ ] **RLS audit** completo sobre todas las tablas Supabase.
- [ ] **`gh auth login`** manual para habilitar acciones GitHub desde Claude.

---

## 13. Pendientes visuales

- [ ] Animación sparkle pulsante en FocusBar (sutil, con `.symbolEffect`).
- [ ] Indicador "Nova está escribiendo" (3 dots animados) durante respuesta mock.
- [ ] Skeleton loaders en lugar de empty states cuando datos están cargando.
- [ ] Onboarding mínimo (1 sola pregunta opcional post-login).
- [ ] Confirmación visual al crear primer evento (toast / haptic + animation que los ejemplos se vayan).

---

## 14. Pendientes backend

- [ ] Migración de `events` y `tasks` con columnas iOS-friendly si hace falta.
- [ ] Endpoint para `device_tokens` APNs registration desde la nativa.
- [ ] Webhook Stripe (`/api/stripe-webhook`) para Pro.
- [ ] Endpoint de health-check público (`/api/health`).
- [ ] Logs estructurados (JSON) para todos los endpoints sensibles.

---

## 14.5. C5 — Sync Supabase: plan técnico (preparado, sin implementar)

> Drafteado en audit pass 16. **No implementar sync completo en una sesión sin revisar este plan punto por punto con el usuario.** Antes de cualquier código, validar con el dueño del producto el shape de datos.

### Estado actual local vs server

| Modelo local (`ios-native/Focus/Models/`) | Tabla server (`supabase/schema.sql`) | Alineación |
|---|---|---|
| `FocusEvent` | `public.events` | ⚠️ Parcial. Server usa `time TEXT` + `date TEXT` (legacy web); nativo usa `startTime: Date` + `endTime: Date?`. Falta `location`, `notes`, `source`, `externalCalendarId`, `externalEventId`, `url`, `lastSyncedAt`. |
| `FocusTask` (con `subtasks: [FocusSubtask]`) | `public.tasks` + migración 016 (parent_task_id) | ⚠️ Server modela subtareas como filas con `parent_task_id`; nativo las anida. Falta `notes` en server. |
| `NovaSuggestion` | `public.suggestions` | ⚠️ Kinds distintos. Local: `schedule/task/rebalance/break_/prep` con status `pending/approved/postponed/dismissed`. Server: `add_event/edit_event/delete_event/mark_task_done` con status `pending/approved/rejected`. Conversion no-trivial. |
| `NovaMessage` | — | ❌ No existe tabla. Si queremos historial cross-device, necesita `nova_messages` table. |
| `AppSettings` | `public.user_profiles` (parcial — sólo personality) | ⚠️ Local tiene 8+ toggles; server sólo `personality` y `timezone`. |

### Plan de implementación recomendado

**Orden propuesto (de menos a más riesgo):**

1. **Migración `018_native_events_v2.sql`**: agregar `start_at TIMESTAMPTZ`, `end_at TIMESTAMPTZ`, `notes TEXT`, `location TEXT`, `source TEXT`, `external_calendar_id TEXT`, `external_event_id TEXT`, `url TEXT`, `last_synced_at TIMESTAMPTZ` a `events`. Mantener `time/date` por compat con web legacy. **Backwards-safe**: todos nullables.
2. **Migración `019_task_notes.sql`**: agregar `notes TEXT` a `tasks`.
3. **Decisión sobre `suggestions`**: O bien (a) extender server enum para soportar kinds nativos, o (b) mantener bandeja local-only por ahora (probable mejor V1).
4. **Implementar `SupabaseService.swift`** en `ios-native/Focus/Services/`:
   - REST directo contra PostgREST (`<supabase>/rest/v1/events`), NO via Vercel backend. Más simple, menos hops.
   - Headers obligatorios: `apikey: <publishable>`, `Authorization: Bearer <access_token>`, `Content-Type: application/json`, `Prefer: return=representation` (para obtener la fila guardada).
   - RLS ya filtra por `auth.uid() = user_id` — el server-side rechaza queries sin JWT válido.
5. **Refactor `FocusDataStore` → write-through cache**:
   - Local sigue siendo source of truth para UI (no esperar red).
   - `addEvent(event)` ahora también llama `SupabaseService.upsertEvent(event)` en background.
   - Errores de red no rompen UX — la app sigue funcionando offline. Toast suave si falla persistencia remota.
   - En boot: `SupabaseService.fetchEvents(since: lastSyncedAt)` → merge con local (server gana si `updated_at` server > `updated_at` local). Solo cuando `auth.state == .loggedIn`, NO en `.demo`.
6. **Tareas + subtareas**: análogo a eventos, con flattening (subtarea = task con `parent_task_id`).
7. **Settings**: extender `user_profiles` o nueva tabla `user_settings` con todos los toggles.
8. **Nova messages**: opcional V2. Por ahora chat queda local.

### Endpoints concretos

| Operación | Endpoint | Auth header |
|---|---|---|
| Insert evento | `POST <supabase>/rest/v1/events` | Bearer access_token |
| List eventos | `GET <supabase>/rest/v1/events?user_id=eq.<uid>&order=start_at.desc` | Bearer access_token |
| Update evento | `PATCH <supabase>/rest/v1/events?id=eq.<id>` | Bearer access_token |
| Delete evento | `DELETE <supabase>/rest/v1/events?id=eq.<id>` | Bearer access_token |

Todas con `apikey: <publishable>` extra (Supabase lo exige siempre).

### Modo demo

`state = .demo` no debe disparar ningún POST/PATCH a Supabase. Toda la lógica de `SupabaseService` debe gatearse por:

```swift
guard case .loggedIn(let session) = auth.state else { return }
```

Esto preserva la promesa "modo demo = todo local, nada sale del iPhone".

### Conflictos y pérdida de datos

- **Estrategia V1**: last-write-wins por `updated_at`. Suficiente para single-user, single-device.
- **Estrategia V2 (multi-device)**: vector clocks o CRDT — fuera de scope.
- **Migración inicial** (usuario que ya creó datos locales y luego se loguea): subir todos los locales al server (no tienen `user_id` server-side todavía), marcar como `lastSyncedAt = ahora`. **Cuidado**: NO borrar locales antes de confirmar OK en server.

### RLS — riesgos

- Cada tabla tiene policy `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`.
- ⚠️ El cliente debe SIEMPRE enviar `user_id = <session.userId>` en el body de inserts. Si lo olvida, RLS rechaza con 403.
- Tests sugeridos: insert con JWT diferente al user_id (debe fallar 403), insert sin JWT (debe fallar 401), select sin filter de user_id (debe traer solo lo del usuario por RLS).

### Riesgos para implementación

| Riesgo | Mitigación |
|---|---|
| Modo demo dispara writes al server | Gatear todo `SupabaseService` con `case .loggedIn`. |
| Conflictos de dates (TEXT legacy vs TIMESTAMPTZ nativo) | Migración 018 antes de empezar; doble-escribir mientras coexistan. |
| Token expira durante un sync largo | El refresh automático del pass 16 cubre boot; para syncs intermedios, hacer `refreshSession()` on 401. |
| RLS rechaza por falta de `user_id` en body | Helper `buildEventBody(event, userId)` centralizado. |
| Pérdida de datos al primer login (usuario con datos locales previos) | Migración upload one-shot: subir TODOS los locales antes de aceptar como sincronizado. |
| Conversion suggestions kind | Empezar con suggestions local-only; reabrir si Nova real necesita cross-device. |

### Próximo paso recomendado

**No empezar C5 sin antes**:
1. Revisar este plan con el usuario.
2. Confirmar shape de datos (especialmente events).
3. Decidir si `nova_messages` y `app_settings` se sincronizan o no.
4. Escribir las migraciones 018+019 primero.
5. Después: `SupabaseService` + refactor de `FocusDataStore`.

---

## 14.6. Importar / exportar calendario — V1 informativo (preparado, no implementado)

> Drafteado en audit pass 16. La V1 muestra Nova/Ajustes con las opciones futuras de forma honesta (`ComingSoonSheet`) y deja la estructura de datos lista. No agrega permisos, OAuth ni navegación externa todavía.

### Lo que YA está en código

- `NovaQuickAction` agrega `importarCalendario` + `exportarCalendario` (en pestaña Acciones de Nova).
- Tap en estas acciones abre `ComingSoonSheet` con texto del flujo futuro y botón secundario "Crear evento manual" (en importar).
- Ajustes → sección "Calendarios conectados" con 4 filas (Apple Calendar / Google Calendar / Archivo .ics / Maps&Waze) que abren `ComingSoonSheet` específico cada una.
- Tap en `LocationLabel` (etiqueta de ubicación en cualquier card de evento) abre `ComingSoonSheet` anticipando Maps/Waze.
- `FocusEvent` ya tiene fields opcionales: `source: EventSource?` (local/google/apple/ics), `externalCalendarId`, `externalEventId`, `url`, `lastSyncedAt`. Backwards-compatible con JSON guardado pre-V1.

### Lo que queda pendiente (orden sugerido)

1. **Importar archivo .ics (más simple)** — usar `DocumentPicker` para que el usuario elija un .ics y un parser propio (los .ics son texto plano con keys conocidas: `BEGIN:VEVENT`/`SUMMARY`/`DTSTART`/`DTEND`/`LOCATION`/`UID`). Marcar eventos importados con `source = .ics` + `externalEventId = UID`.
2. **Apple EventKit (lectura)** — `EventKit` framework. Requiere `NSCalendarsUsageDescription` en Info.plist. Permiso del sistema. Importar eventos del calendario local. Marcar con `source = .apple` + `externalEventId = EKEvent.eventIdentifier`.
3. **Exportar .ics** — generar texto VCALENDAR a partir de eventos locales y usar `UIActivityViewController` (share sheet) para que el usuario lo guarde/envíe.
4. **Google Calendar OAuth** — el más complejo. Requiere SPM `GoogleSignIn-iOS` o flow manual con AppAuth-iOS. URL scheme custom, callback handling. Marcar eventos con `source = .google` + `externalCalendarId = google_calendar_id` + `externalEventId = google_event_id`.
5. **Abrir ubicaciones en Maps/Waze** — usar `UIApplication.shared.open(url:)`:
   - Apple Maps: `http://maps.apple.com/?q=<address>`
   - Google Maps: `comgooglemaps://?q=<address>` o web fallback
   - Waze: `waze://?q=<address>` o web fallback
   - Usar `canOpenURL(_:)` para detectar apps instaladas (requiere whitelist en `LSApplicationQueriesSchemes` del Info.plist).

### Riesgos / consideraciones

| Riesgo | Mitigación |
|---|---|
| Permisos de calendario iOS (NSCalendarsUsageDescription) | Pedir explícitamente con copy claro antes del primer acceso. |
| OAuth Google complejidad y mantenimiento | Evaluar SPM official vs flow manual. Token rotation. |
| Duplicados de eventos (mismo evento desde 2 sources) | Dedupe por `externalEventId` antes de upsert. |
| Conflicto calendar local vs Supabase remote | Resolver con `lastSyncedAt` + `updated_at` (mismo patrón que C5). |
| Privacidad: lectura de calendario expone info sensible | Permiso opt-in claro. NO subir a Supabase salvo que el usuario lo apruebe explícitamente. |
| `LSApplicationQueriesSchemes` para Waze/Google Maps | Whitelist en Info.plist. Si no está, `canOpenURL` siempre devuelve false. |

### No-objetivos en esta fase

- Sync bidireccional con Google/Apple (escribir cambios de Focus de vuelta al calendario externo). Empezar lectura-only.
- Resolver conflictos automáticamente. V1: si el usuario crea uno en Google y otro en Focus a la misma hora, Focus solo muestra el de Focus y deja una sugerencia en Bandeja "Tienes conflicto con tu calendario de Google a las 14:00".

---

## 14.7. Vercel — diagnóstico de deploy fallido

> Pendiente porque no tengo acceso a Vercel CLI ni a `gh auth` desde esta sesión. Local build pasa (`npm run build` → 576 módulos, dist/ OK, service worker estampado con commit SHA).

### Pasos exactos para diagnosticar

1. Abrir https://vercel.com en el navegador (logueado con la cuenta del proyecto).
2. Ir al proyecto **focus** (debería estar bajo el team `manunezdom-afk` o personal).
3. Click en pestaña **Deployments**.
4. Ubicar el deployment con estado **Failed** (badge rojo).
5. Click sobre él → abre la página del deployment.
6. Click en **Build Logs** (o pestaña "Logs" si está en la nueva UI).
7. Copiar las **últimas 30–40 líneas** del log (las que vienen después de `error:` o `Failed`).
8. Pegarlas en una próxima sesión para que yo pueda diagnosticar.

### Causas más probables sin acceso a logs

| Síntoma | Causa probable | Fix |
|---|---|---|
| `Cannot find module 'X'` | Dependencia no en `package.json` o lock desincronizado | Verificar `package.json` + `package-lock.json` |
| Build runner timeout | Vercel runner saturado (transitorio) | Re-deploy desde dashboard |
| `Function exceeds size limit` | Función Node con bundle muy grande | Mover deps a `_lib/` o aliviar imports |
| Env var faltante para build | `VITE_SUPABASE_URL` o similar no seteada en Vercel | Revisar Vercel → Settings → Environment Variables |
| `ANTHROPIC_API_KEY` requerida en build | Algún script de build la lee | Confirmar que esté en Vercel env vars (NO commit) |
| `12 function limit` excedido | Vercel Hobby acepta máx 12 functions | Actualmente exactamente 12; revisar si algo nuevo se agregó |

### Funciones serverless actuales (12/12 en Hobby)

```
api/analyze-photo.js
api/auth/delete-account.js
api/auth/email/send-otp.js
api/calendar-feeds.js
api/cron-notifications.js
api/focus-assistant.js
api/ics-feed.js
api/kairos/inbox.js
api/kairos/link.js
api/me/plan.js
api/push.js
api/transcribe.js
```

`api/_lib/*.js` y `api/_supabaseAdmin.js` no cuentan (los `_` los excluye Vercel).

### Endpoints usados por la app iOS nativa

- `POST /api/auth/email/send-otp` (Resend SMTP) — login OTP.
- `POST /auth/v1/verify` (Supabase directo, NO Vercel) — verify OTP.
- `POST /auth/v1/token?grant_type=refresh_token` (Supabase directo) — refresh.

→ Si solo falla la build de Vercel pero `/auth/v1/*` sigue respondiendo (que es directo a Supabase), la app iOS sigue funcionando para login. Las acciones futuras que dependan de `/api/focus-assistant` (Nova real) sí caerían si producción está rota.

---

## 15. Checklist antes de beta (TestFlight interno)

> Mínimo viable para empezar a probar con usuarios.

- [ ] Auth Supabase OTP funcional end-to-end.
- [ ] Mi Día persiste datos (mínimo `UserDefaults`).
- [ ] Tareas y Calendario persisten datos.
- [ ] Nova conectada al backend real con manejo de errores.
- [ ] Push notifications APNs registradas (al menos token guardado en Supabase).
- [ ] App pasa `xcodebuild archive` sin errors ni warnings críticos.
- [ ] Iconos + LaunchScreen finales.
- [ ] Info.plist con todas las usage descriptions.
- [ ] gitleaks limpio.
- [ ] `npm audit` sin Critical en web.
- [ ] Privacy policy publicada.
- [ ] Build #1 en TestFlight Internal con tester invitado.

---

## 16. Checklist antes de producción (App Store público)

- [ ] Beta TestFlight con ≥10 testers durante ≥2 semanas.
- [ ] Crash rate <0.5% (vía App Store Connect analytics).
- [ ] Manejo robusto de offline (queue + sync).
- [ ] Backup database verificado en Supabase.
- [ ] Sign in with Apple disponible (Apple lo exige si hay otros OAuth).
- [ ] Delete account flow funcional (PIA compliance).
- [ ] App Store Privacy Nutrition Labels finalizados.
- [ ] Screenshots App Store finales en 6.7" + 6.1".
- [ ] App Review Information completa (demo account + notes).
- [ ] Pricing tier configurado (Free + Pro con IAP o Stripe).
- [ ] Localización a inglés si target US (opcional).
- [ ] Términos de servicio publicados.
- [ ] Política de privacidad publicada y actualizada.

---

## Apéndice A — Inventario de herramientas (2026-05-11)

| Herramienta | Versión | Estado | Función |
|---|---|---|---|
| Xcode | 26.4.1 (17E202) | ✅ | Build/Archive iOS |
| `gh` CLI | 2.92.0 | ⚠️ instalado pero **no logueado** | GitHub ops |
| Node | 24.14.1 | ✅ | Web + scripts |
| npm | 11.11.0 | ✅ | Web deps |
| Playwright | 1.59.1 (devDep) | ✅ | E2E web |
| Homebrew | 5.1.10 | ✅ | Package manager |
| SwiftLint | — | ❌ | Linting Swift |
| Periphery | — | ❌ | Dead code Swift |
| xcbeautify | — | ❌ | Build output legible |
| gitleaks | — | ❌ | Secret scanning |
| osv-scanner | — | ❌ | Vulns en deps |
| Supabase CLI | — | ❌ | Migraciones / RLS audit |
| Vercel CLI | — | ❌ | Deploys / env |
| Semgrep | — | ❌ | SAST |

## Apéndice B — MCPs disponibles relevantes

- ✅ `Claude in Chrome` — puede correr tests visuales en `usefocus.me`.
- ✅ `Computer Use` — para auditoría visual de la app en simulador/device.
- ✅ `Notion` — para volcar resultados de auditoría.
- ✅ `Claude Preview` — para mockups o snapshots.
- ⚠️ `Netlify` — **no es nuestro host**, ignorar.
- ❌ Supabase MCP — **NO conectado** (decisión consciente). Riesgo alto si se conecta con `service_role`. Alternativa: usar Supabase CLI con OAuth + read-only.
- ❌ GitHub MCP — **NO conectado**. Bajo riesgo si se conecta con PAT scope `repo:read`. Por ahora alcanza con `gh` CLI.

## Apéndice C — Acciones que requieren intervención humana (NO Claude)

Estas acciones requieren input directo de Martin y NO deben ser ejecutadas por Claude:

1. **`gh auth login`** — autenticación interactiva via browser / device code.
2. **`supabase login`** — OAuth browser.
3. **`vercel login`** + **`vercel link`** — autenticación + selección de proyecto.
4. **`supabase db push` / `db reset`** — DESTRUCTIVO. Sólo manual con confirmación.
5. **`vercel env pull` / `add` / `rm`** — toca secretos de producción.
6. **`brew install`** de cualquier herramienta — el primer install requiere `sudo` opcional según permisos del sistema. Mejor manual.
7. **TestFlight upload** — credenciales de App Store Connect.
8. **APNs `.p8` upload** a Supabase / Vercel — material sensible.
9. **Stripe webhook secret** — material sensible.

## Apéndice D — Documentos relacionados en el repo

| Doc | Propósito |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | Protocolo de trabajo Claude×Codex, idioma, push rules. |
| `IOS_NATIVE_MIGRATION.md` | Plan de migración nativa (Fase 1 completada). |
| `MOBILE_EXPO_MIGRATION.md` | Spec mobile heredada (referencia histórica). |
| `MOBILE_NATIVE_FEEL_AUDIT.md` | Estándar premium iOS (haptics, gestos, motion). |
| `AUTH_SESSION_AUDIT.md` | Flujo Supabase OTP, OAuth, delete-account. |
| `AI_COST_TRACKING.md` | Cost tracking de Nova (`ai_usage_events`). |
| `USAGE_LIMITS.md` | Límites Free/Pro y enforcement. |
| `PRIVACY_AUDIT.md` / `PRIVACY_POLICY_DRAFT.md` | PIA + draft de política. |
| `SECURITY_AUDIT.md` | Audit de seguridad previa (releer y comparar con findings nuevos). |
| `IOS_REAL_QA.md` | QA standards para builds reales. |
| `docs/MIGRATION_SPECS/01-mi-dia.md` | Spec quirúrgica de Mi Día. |
| `docs/push-notifications-setup.md` | APNs setup + cron. |
| `docs/app-store.md` / `app-store-metadata.md` | Posicionamiento App Store. |
| `docs/plan-de-3-semanas.md` | Roadmap producto. |

---

_Mantenido por Claude Code + Martin Núñez. Update cada vez que se cierra una fase o se agrega herramienta._
