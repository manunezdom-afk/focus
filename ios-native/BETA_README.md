# Focus — Beta cerrada (TestFlight)

Build **1.0 (2)** — primer build de beta cerrada. 2–5 testers.

---

## 📲 Cómo instalar (testers)

1. Abre el link de invitación TestFlight que te llega por email.
2. Instala la app TestFlight si todavía no la tienes.
3. Acepta la invitación → "Instalar".
4. Abre Focus → completa el onboarding (4 pantallas) → continúa con tu correo.

**Login**: solo email + código de 6 dígitos. Llega en menos de un minuto. Si no llega: revisa spam, vuelve a pedir el código (botón "Reenviar" tras 30 s).

---

## ✅ Checklist obligatorio antes de mandar feedback

Marca cada uno cuando lo verifiques. Si algo falla, anota la frase exacta y la hora.

### Onboarding y login
- [ ] Onboarding pasa las 4 pantallas y abre la app sin pantallas duplicadas.
- [ ] Pides código → llega → ingresas → entras a Mi Día.
- [ ] Cierras sesión desde Ajustes → vuelves al login.
- [ ] Vuelves a iniciar sesión con el mismo email → tus eventos siguen ahí.

### Mi Día
- [ ] Creas un evento desde el FocusBar: escribe "agenda dentista mañana a las 10".
- [ ] El evento aparece en la timeline de Mi Día y en Calendario.
- [ ] Tocas el bloque y "Editar" funciona; al guardar, cambia.
- [ ] Deslizas el bloque a la izquierda y lo borras → confirma con toast.
- [ ] Cierras la app completamente, la reabres, el evento borrado **no** vuelve.

### Tareas
- [ ] Creas una tarea: "comprar pan".
- [ ] Aparece en la pestaña Tareas y en "Pendientes de hoy" de Mi Día.
- [ ] La marcas como hecha (toque al círculo) → se tacha.
- [ ] La eliminas (swipe o long-press) → desaparece.
- [ ] Cierras y reabres → la tarea borrada no vuelve.

### Recordatorios / notificaciones locales
- [ ] Creas un recordatorio para dentro de 2 minutos: "acuérdame llamar a mamá en 2 min".
- [ ] Acepta el permiso de notificaciones cuando lo pida iOS.
- [ ] Sales de la app y esperas → llega una notificación push local en la hora prevista.
- [ ] La notificación trae el título limpio (no "Recordatorio: Acuérdame…").

### Nova (texto) — frases obligatorias del usuario
- [ ] **"tengo que seguir trabajando a las 3:30 y comer a las 4"** → debe crear **dos** bloques: "Seguir trabajando" 15:30 y "Comer" 16:00. Ninguno marcado como "reunión".
- [ ] **"necesito ir a buscar a mi hermano a las tres"** → un bloque "Ir a buscar a mi hermano" hoy 15:00. **No** debe preguntar "¿Cuándo?".
- [ ] **"en una hora voy a jugar fútbol, en dos horas vuelvo y a las 12 me acuesto"** → tres bloques: jugar fútbol (+1 h), volver (+2 h), acostarme (00:00 o pregunta noon/medianoche).

### Nova (voz) — micrófono inline
- [ ] En el FocusBar, tocas el micrófono → iOS pide permisos de mic y voz → acepta.
- [ ] Dictas "agenda almuerzo con Pedro mañana a la una" → el texto aparece en la barra.
- [ ] Revisas y envías → se crea el evento.

### Calendario
- [ ] Vas a la pestaña Calendario y deslizas entre días.
- [ ] El día con evento muestra un punto/indicador.
- [ ] Tocas el evento → puedes editar o eliminar.

### Logout
- [ ] Ajustes → "Cerrar sesión" → vuelves al login.
- [ ] Vuelves a iniciar sesión → tus datos cargan desde la nube (sync).

---

## 🚫 Funciones ocultas en esta beta (a propósito)

Estas existen en el código pero **no se muestran** porque todavía no están listas:

| Función | Por qué oculta |
|---|---|
| **Continuar con Google** | Requiere el SDK GoogleSignIn-iOS + URL Scheme en Info.plist. Mientras eso no esté integrado, tocar el botón daba error. Solo OTP por email en beta. |
| **Importar Google Calendar / Apple Calendar / .ics** | Aparece en Ajustes como "Próximamente" sin acción real. La sincronización con calendarios externos llega en una versión siguiente. |
| **Abrir ubicación en Maps / Waze** | El campo "ubicación" guarda texto pero no abre apps externas. |
| **Notificaciones push remotas (APNs)** | Solo locales (programadas en este iPhone). No hay servidor de push remoto. |

Si ves algo más que parezca "a medias" o "Próximamente", **no es bug, es ocultado a propósito** — confírmalo por mensaje y seguimos.

---

## 🐞 Bugs conocidos / fricción esperada

1. **Frases con muchas acciones encadenadas sin estar logueado**: en modo demo, si escribes algo tipo "en una hora X y en dos horas Y", Nova te pide que envíes una acción por mensaje. Es a propósito — sin sesión no podemos llamar al modelo fuerte.
2. **Hora ambigua "a las 12"**: Nova preguntará si te refieres a medianoche o mediodía. Es la conducta esperada.
3. **Verbos puntuales** ("despertarme", "levantarme") crean recordatorios con notificación. Si no quieres alerta, di "agenda despertarme…" o desactiva el toggle de notificaciones del bloque.
4. **Edición en demo**: si modificas un evento ejemplo, ese cambio puede no persistir al cerrar la app (los ejemplos son read-only). Para probar persistencia, **inicia sesión**.
5. **El primer evento real reemplaza los ejemplos demo**: no es bug, así fue diseñado — apenas creas tu primer evento o tarea, los ejemplos desaparecen.
6. **Sin conexión**: los cambios se guardan en este iPhone y suben cuando vuelvas a tener internet. Si esto demora, ciérrala y vuelve a abrirla.

---

## 🆘 Cómo reportar un problema

Por mensaje directo, con:
1. **Qué escribiste exactamente** (copy-paste de la frase).
2. **Qué esperabas que pasara**.
3. **Qué pasó realmente** (captura si puedes).
4. **Día y hora aprox** del incidente.

Si la app crashea: TestFlight te ofrece "Send Beta Feedback" con un screenshot — manda eso, incluye una nota corta.

---

## 🔐 Privacidad y datos

- Tu correo y tus eventos se guardan en una base de datos Supabase con RLS (cada usuario ve solo lo suyo).
- El audio del micrófono **no** sale del iPhone — la transcripción la hace Apple en el dispositivo.
- Cuando escribes a Nova, el texto sí va a un modelo de IA (Anthropic Haiku 4.5). No se entrena con tu data.
- Para borrar todo: Ajustes → "Datos locales" → "Borrar todo lo de este iPhone". Para borrar la cuenta entera: pídelo por mensaje.
