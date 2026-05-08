# Política de privacidad — Focus

**Última actualización**: [completar al publicar]

> **Estado**: borrador. **NO publicada todavía**. Para TestFlight Internal Beta NO hace falta. Antes de External Beta o release público: revisar con asesor legal, publicar en `https://www.usefocus.me/privacy`, y configurar la URL en App Store Connect → App Privacy.

---

## Quiénes somos

Focus es una aplicación de productividad inteligente operada por **[Razón social / persona] ([país])**. Email de contacto: **[contacto@usefocus.me]**.

## Qué datos recolectamos

### Que tú nos das directamente
- **Email**: para crear tu cuenta y autenticarte. Almacenado en Supabase Auth.
- **Eventos de calendario**: título, fecha, hora, descripción opcional. Almacenado en `events` con RLS por usuario.
- **Tareas**: etiqueta, prioridad, categoría, fecha opcional. Almacenado en `tasks` con RLS por usuario.
- **Memorias de Nova**: hechos relevantes (relaciones, preferencias, rutinas) que tú compartes en conversación con Nova. Persistidos para personalizar respuestas futuras. Tú puedes borrarlas en Ajustes → Memorias.
- **Configuración**: personalidad de Nova, preferencia de apariencia (sistema/claro/oscuro). Almacenado en `user_profiles` con RLS por usuario.
- **Contenido de tus conversaciones con Nova**: el texto que escribes y las fotos que envías para análisis. Procesado por Anthropic (ver más abajo). Las conversaciones se guardan localmente en tu dispositivo (AsyncStorage) y se envían al servidor solo en el momento del request.

### Que recolectamos automáticamente
- **Métricas de uso de IA**: tokens consumidos, modelo usado (Haiku 4.5, Sonnet 4.6), latencia, tipo de acción. Almacenado en `ai_usage_events` para medir costos y mejorar el servicio. **No incluye el contenido de tus mensajes**.
- **Errores técnicos**: stack traces sin contenido personal en logs server-side de Vercel.

### Que NO recolectamos
- Ubicación en tiempo real.
- Contactos del teléfono.
- Información de salud / financiera / biométrica.
- Identificadores de tracking publicitario.
- Tu actividad en otras apps.

## Permisos del dispositivo

| Permiso | Uso |
|---|---|
| **Cámara** | Para que Nova analice fotos de agendas/notas y detecte eventos. La foto se comprime, se envía al backend, se procesa con IA, y se devuelven solo los eventos detectados (sin almacenar la imagen). |
| **Galería de fotos** | Mismo uso que cámara, pero usando una foto que ya tienes. |
| **Micrófono** | Para dictar a Nova en lugar de escribir. La voz se transcribe en el dispositivo (iOS Speech Framework, on-device). El audio NO se envía a ningún servidor. |
| **Reconocimiento de voz** | iOS necesita este permiso adicional para activar la transcripción on-device (SFSpeechRecognizer). |
| **Notificaciones** | Solo si tú las activas en Ajustes → Notificaciones. V1 son recordatorios locales en tu dispositivo (no push remoto). |

## Cómo usamos tus datos

- **Para que la app funcione**: mostrarte tus eventos, tareas, memorias y plan.
- **Para que Nova personalice respuestas**: enviamos al backend tu mensaje + contexto resumido (hasta 200 eventos, 200 tareas, 100 memorias) + tu zona horaria + clima si lo tenemos. Anthropic procesa el request y devuelve la respuesta.
- **Para medir costos**: agregamos uso anónimo de IA (tokens, modelo) a métricas internas. No vendemos ni cedemos esos datos.
- **Para mejorar el servicio**: errores técnicos nos ayudan a arreglar bugs.

## Terceros que procesan tus datos

| Servicio | Qué hace | Dónde | Política |
|---|---|---|---|
| **Supabase** | Autenticación, almacenamiento de eventos/tareas/memorias, base de datos | EU/US según región configurada | https://supabase.com/privacy |
| **Vercel** | Hosting del backend API y la app web | US/global edge | https://vercel.com/legal/privacy-policy |
| **Anthropic (Claude)** | Procesamiento de mensajes con IA (Haiku 4.5 + Sonnet 4.6 para escalación). Política Anthropic: NO entrenan modelos con tu API data. | US/global | https://www.anthropic.com/legal/privacy |
| **OpenWeather** | Pronóstico del clima (solo si activamos location en futuras versiones) | global | – |

Anthropic se compromete contractualmente a NO usar las requests de la API para entrenar modelos. Los logs de Vercel pueden retener datos hasta 30 días para debugging.

## Tus derechos

Cumplimos GDPR / CCPA / LFPDPPP México:

- **Acceso**: pídenos copia de tus datos a [contacto@usefocus.me].
- **Rectificación**: edita en la app o pídenos.
- **Eliminación**: en Ajustes → "Eliminar cuenta". Borra cascade en Supabase: events, tasks, user_memories, ai_usage, ai_usage_events, user_plans, etc. Irreversible.
- **Portabilidad**: pídenos export en JSON (próximamente función "Tus datos" en Ajustes).
- **Oposición / Limitación**: contáctanos.
- **Retiro de consentimiento**: dejar de usar la app y/o eliminar cuenta.

## Seguridad

- TLS 1.3 entre app y backend.
- Tokens de auth en AsyncStorage del iPhone.
- Row-Level Security (RLS) en Supabase: cada usuario solo accede a sus propias filas.
- Sin tracking publicitario, sin SDKs de terceros que envíen datos.
- Service role key (bypass RLS) solo en backend, nunca en el cliente.

## Niños

Focus no está dirigido a menores de 13 años. Si descubrimos cuentas de menores, las borramos.

## Cambios en esta política

Te avisaremos por email a la cuenta registrada cuando hagamos cambios significativos. La fecha "Última actualización" reflejará la versión vigente.

## Contacto

Email: [contacto@usefocus.me]
Sitio: https://www.usefocus.me

---

> **TODOs antes de publicar (manuales del owner):**
> 1. Reemplazar `[Razón social / persona] ([país])` con datos reales.
> 2. Confirmar email de contacto.
> 3. Decidir región Supabase (EU vs US) y reflejarlo en tabla.
> 4. Revisar con asesor legal si vas a aceptar usuarios EU (GDPR explícito) o solo LATAM.
> 5. Publicar en `https://www.usefocus.me/privacy` (página estática Vercel).
> 6. Pegar URL en App Store Connect → My Apps → focus-app → App Information → Privacy Policy URL.
