# Política de privacidad — Focus (borrador técnico)

> **Importante:** este documento es un borrador técnico escrito por el equipo
> de ingeniería para servir como base. **NO** es texto legal definitivo.
> Antes de publicar (en la web pública o en App Store Connect), un revisor
> con conocimiento legal debe validarlo y ajustar la redacción a la
> jurisdicción aplicable.
>
> Última actualización: 2026-05-07.

---

## ¿Qué es Focus?

Focus es una aplicación móvil y web de productividad que combina calendario,
tareas y un asistente conversacional llamado **Nova** basado en inteligencia
artificial. La app está disponible en `usefocus.me` y como app nativa para
iPhone vía TestFlight / App Store.

El responsable del tratamiento de datos es: **Martín Nuñez Domínguez**
(`manunezdom@gmail.com`).

---

## ¿Qué datos recopilamos y para qué?

### Datos que tú nos das directamente

| Dato | Para qué |
| --- | --- |
| Email | Login con código (OTP) y recuperación de contraseña. |
| Contraseña (si eliges esa vía) | Solo se guarda hasheada, nunca en claro. |
| Tareas, eventos, notas que crees | Mostrarlos en tu calendario y tu lista. |
| Memorias que Nova aprende sobre ti | Para personalizar respuestas (ej. recordar nombres de personas relevantes para ti). |
| Mensajes que escribes a Nova | Generar la respuesta y mostrarla en tu chat. |
| Preferencias de la app (cronotipo, role, personalidad de Nova, horarios silenciosos) | Adaptar la experiencia. |
| Foto que subes a "Analizar foto" | Extraer eventos de la imagen y mostrártelos. La foto no se guarda. |

### Datos técnicos

| Dato | Para qué |
| --- | --- |
| Identificador interno (UUID) | Asociar tus datos a tu cuenta. |
| Sesión (token de auth) | Mantenerte logueado. |
| Suscripción a notificaciones push (token APNs / Web Push) | Enviarte recordatorios y avisos cuando los actives. |
| IP del dispositivo | Limitar abusos (rate limiting). No la asociamos a tu cuenta en base de datos; solo aparece temporalmente en logs del proveedor de hosting. |
| Métricas de uso (ej. cuántas veces hablaste con Nova hoy) | Aplicar los límites del plan gratuito y diagnosticar problemas. |

**No usamos** identifiers de seguimiento publicitario (IDFA, IDFV, cookies de
ads). **No accedemos** a tu calendario nativo, contactos, GPS, micrófono
en backend, ni a otras apps del dispositivo.

---

## ¿Qué datos se procesan con IA (Nova)?

Cuando hablas con Nova, enviamos a **Anthropic** (proveedor del modelo Claude
que usamos como motor) un contexto que incluye:

- La fecha y zona horaria.
- Tu cronotipo / role (si los configuraste).
- Memorias que Nova ya aprendió sobre ti.
- Los títulos y horarios de tus eventos próximos.
- Los nombres de tus tareas pendientes.
- Tu mensaje y los últimos 20 turnos de la conversación actual.

**No enviamos** tu email, tu identificador, datos de pago, ni el contenido
literal de descripciones largas, contraseñas, o tokens.

Anthropic procesa estos datos para generar la respuesta. Según sus términos
de servicio para clientes API, Anthropic **no entrena sus modelos** con tus
datos por defecto (ver
<https://www.anthropic.com/legal/commercial-terms>).

**Cuando subes una foto** ("Analizar foto"), la imagen se envía a Anthropic
solo para extraer eventos del horario que muestre. La imagen **no se guarda**
en nuestros servidores ni en los suyos más allá del tiempo de procesamiento.

---

## ¿Quién más recibe tus datos?

Los siguientes proveedores reciben datos limitados y específicos para
cumplir con su función:

| Proveedor | Qué recibe | Para qué |
| --- | --- | --- |
| **Supabase** (base de datos) | Todos los datos que guardas en la app | Almacenamiento, autenticación |
| **Vercel** (hosting) | Requests HTTP a la app, IP del dispositivo | Servir la app y los endpoints |
| **Anthropic** (Claude) | El contexto descrito arriba | Generar respuestas de Nova |
| **Resend** (email) | Tu email cuando solicitas un OTP | Enviar el código de verificación |
| **Apple** (APNs) y **Google/Mozilla** (Web Push) | Token de tu dispositivo + contenido de la notificación | Entregarte las notificaciones que tú activaste |
| **OpenWeatherMap** | Coordenadas si decides compartirlas para contexto climático | Que Nova sepa el clima al sugerirte tareas |

**No vendemos tus datos.** **No usamos analytics de terceros** (Google
Analytics, Mixpanel, Facebook Pixel, etc.). **No compartimos tus datos** con
brokers de datos ni redes de publicidad.

---

## ¿Cómo usamos los datos para los límites y costos?

Para sostener una versión gratuita, registramos:
- Cuántas veces interactúas con Nova en el día (sin guardar el contenido).
- Cuántos tokens consume cada llamada al modelo (sin guardar prompts ni
  respuestas).
- El plan asignado a tu cuenta (gratis, early access, etc.).

Estos datos se usan **exclusivamente** para aplicar los límites de uso y
calcular costos operativos. No se cruzan con publicidad.

Detalle técnico en `USAGE_LIMITS.md` y `AI_COST_TRACKING.md` del repositorio.

---

## ¿Cuánto tiempo guardamos tus datos?

- Mientras tu cuenta esté activa, los datos persisten para que la app funcione.
- Si eliminas tu cuenta, **borramos todo** lo asociado a tu user_id en menos
  de 24 horas (en la práctica, inmediatamente vía `ON DELETE CASCADE`).
- Los logs operacionales (Vercel, Supabase) tienen su propio TTL, típicamente
  no más de 30 días.
- Notificaciones push ya enviadas a Apple/Google: se descartan según las
  reglas del proveedor.

---

## ¿Cómo elimino mi cuenta?

1. Abre Focus → **Ajustes** → **Eliminar cuenta**.
2. Escribe "DELETE" para confirmar.
3. La cuenta y todos los datos asociados se eliminan inmediatamente.
4. La app cierra tu sesión y limpia el caché local del dispositivo.

Si no puedes acceder a la app, escríbenos a `manunezdom@gmail.com` y
borraremos la cuenta manualmente.

---

## Tus derechos

Dependiendo de tu jurisdicción, puedes tener derecho a:
- Acceder a una copia de tus datos.
- Corregir datos incorrectos.
- Eliminar tu cuenta y datos.
- Limitar el procesamiento.
- Portabilidad (recibir tus datos en formato leíble).

Hoy puedes ejercer **eliminar** desde la app. Para los demás derechos,
escríbenos a `manunezdom@gmail.com`. Implementaremos un flujo de
exportación in-app antes del lanzamiento estable.

---

## Niños

Focus no está dirigido a menores de 13 años (o la edad mínima aplicable en
tu país). No recopilamos conscientemente datos de menores. Si crees que un
menor nos envió datos, escríbenos para borrarlos.

---

## Seguridad

- Las comunicaciones entre la app y nuestros servidores van por HTTPS.
- La base de datos está cifrada at-rest por Supabase.
- El acceso a tus datos está restringido por Row Level Security: ningún
  usuario puede ver los datos de otro usuario.
- Las contraseñas se almacenan hasheadas (Supabase Auth).
- Los secrets (API keys de Anthropic, Resend, etc.) viven solo en el
  backend; nunca en el código del cliente.

Ninguna app es 100% inviolable; reportá cualquier vulnerabilidad a
`manunezdom@gmail.com` y la atendemos en menos de 7 días.

---

## Cambios a esta política

Si actualizamos esta política, la versión nueva quedará publicada en la app
y en el sitio. Cambios materiales se notifican con al menos 30 días de
anticipación cuando sea posible.

---

## Contacto

Responsable: Martín Nuñez Domínguez
Email: `manunezdom@gmail.com`
Sitio: `https://www.usefocus.me`

---

## Pendientes antes de publicar (checklist para revisor legal)

- [ ] Verificar jurisdicciones aplicables (España, Chile, EU, US, etc.) y
      ajustar lenguaje legal específico.
- [ ] Confirmar bases legales (consentimiento vs interés legítimo) por
      categoría de datos para GDPR.
- [ ] Validar que la cláusula de "datos a Anthropic" cumple el contrato
      vigente con ellos.
- [ ] Revisar la copy de "Niños" según COPPA / regulación aplicable.
- [ ] Definir política de retención de logs explícita (Vercel/Supabase).
- [ ] Agregar enlace al texto de Términos de Servicio (no existe todavía).
- [ ] Versionar este documento (v1.0) y mantener changelog público.
- [ ] Decidir si ofrecemos exportación automática vs solicitud manual.
- [ ] Revisar política de Resend respecto al envío de OTPs.
- [ ] Definir DPA (Data Processing Addendum) con Supabase si la app entra
      a EU.
