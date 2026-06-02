# Prompt — Setup de streaming Kick + OBS (Windows, gratis)

> Pega el bloque de abajo en una sesión de **Cowork** o **Claude Code con computer use**
> (Pro/Max, "Let Claude use your computer" activado), con tu PC Windows despierta y OBS ya
> instalado y logueado en Kick.

```
ROL: Eres mi técnico de streaming. Vas a dejar mi OBS (Windows, ya instalado y ya
logueado en mi cuenta de Kick) 100% listo para transmitir en Kick, con un setup GRATIS
y a prueba de fallos. Tienes mi permiso para usar computer use: abrir apps, navegador,
descargar e instalar. NO instales nada de pago. NO instales co-host de IA.

CÓMO TRABAJAR:
- Pasos 1 a 4 (lo técnico): hazlo de corrido, sin preguntarme, usando los defaults de aquí.
- Paso 5 (lo VISUAL): SIEMPRE pregúntame y dame opciones antes de crear escenas. No decidas tú.
- Detente y avísame SOLO en: (a) el login de Botrix, (b) el paso visual.
- Antes de instalar cada plugin, VERIFICA que la versión sea compatible con mi versión de OBS.
  Si un plugin no tiene release para mi versión, OMÍTELO y avísame al final. Nunca lo fuerces.
- Usa siempre el instalador oficial de Windows (.exe) o el .zip oficial. Deja el path por defecto.
- Reinicia OBS después de instalar plugins y comprueba que cada uno aparezca.
- Si algo te pide credenciales, pídemelas a mí; nunca las inventes.
- Si un paso falla, no sigas: dime qué pasó y propón solución.

================= PASO 1: VERIFICAR OBS =================
- Abre OBS. Ve a Help → About y anota la versión exacta (la usarás para elegir plugins).
- Ve a Settings → Stream y confirma que el servicio es Kick y la cuenta está conectada.
- Si no hay config de salida, corre Tools → Auto-Configuration Wizard → "Optimize for streaming".
- Cierra OBS antes de instalar plugins.

================= PASO 2: INSTALAR PLUGINS (gratis) =================
Descarga de estas fuentes oficiales la versión Windows compatible con mi OBS:
CORE (instalar sí o sí):
  - Move (Exeldro):                 https://github.com/exeldro/obs-move-transition/releases
  - Advanced Scene Switcher:        https://github.com/WarmUpTill/SceneSwitcher/releases
  - obs-backgroundremoval:          https://github.com/locaal-ai/obs-backgroundremoval/releases
  - Source Record (Exeldro):        https://github.com/exeldro/obs-source-record/releases
EXTRA (instalar solo si hay versión compatible):
  - obs-shaderfilter (Exeldro):     https://github.com/exeldro/obs-shaderfilter/releases
  - Audio Monitor (Exeldro):        https://github.com/exeldro/obs-audio-monitor/releases
NO instales StreamFX (rompe entre versiones de OBS).
Tras instalar todos: reinicia OBS y verifica que cada plugin aparezca
(Move en transiciones, Advanced Scene Switcher en menú Tools, background removal y
Source Record como filtros de un source). Reporta cuáles quedaron y cuáles omitiste.

================= PASO 3: LIMPIAR EL MICRÓFONO =================
En OBS, sobre el source del micrófono (Mic/Aux), abre Filters y añade en este orden:
  1) Noise Suppression → método RNNoise.
  2) Noise Gate → Close Threshold ~ -45 dB, Open Threshold ~ -35 dB.
  3) Compressor → valores por defecto.
Habla y confirma en el medidor que se oye limpio, sin ruido de fondo.

================= PASO 4: BOTRIX (bot + alerts + TTS + puntos, gratis) =================
Abre https://botrix.live en el navegador.
>>> PAUSA: pídeme iniciar sesión con mi cuenta de Kick y autorizar permisos. <<<
Luego configura/reactiva (todo en la capa GRATIS):
  - Comandos por defecto + crea 3-4 comandos custom de ejemplo (!redes, !discord, !uptime) y timers.
  - Moderación / auto-mod básico activado.
  - Sistema de PUNTOS de lealtad (ganar por ver y por chatear).
  - TTS activado, disparado por el comando !tts y/o por canje de puntos.
  - Alerts: follow / sub / gift / host. Y widget de Multi-chat.
Copia las URLs de cada widget (Alerts, TTS, Multi-chat, Goal) y en OBS añádelas como
Browser Source, cada una a 1920x1080. En las que tengan sonido, marca "Control audio via OBS".

================= PASO 5: PARTE VISUAL — AQUÍ PREGÚNTAME =================
Antes de crear nada, hazme estas preguntas y dame opciones para elegir:
  1) Qué escenas quiero (sugiere: Juego, Cámara full, BRB/Pausa, Intro). ¿Cuáles incluyo?
  2) Estilo/tema del overlay: minimalista / gamer-neón / retro-pixel / elegante-oscuro.
  3) Paleta de colores: muéstrame 2-3 opciones.
  4) Posición de cámara y del chat en pantalla: ofréceme 2-3 layouts.
  5) Tipo de transición con Move: slide / fade animado / stinger.
  6) ¿Uso background removal en la cámara (sin croma) o no?
Con MIS respuestas, crea las escenas elegidas con ese layout y estilo, pon Move como
transición, y (opcional) una macro de Advanced Scene Switcher (ej: ir a BRB si el juego
se minimiza). Muéstrame el resultado y déjame pedir ajustes.

================= PASO 6: TEST FINAL =================
Inicia un stream de prueba de ~1 minuto en Kick y verifica:
  - El chat se ve en pantalla.
  - Un follow de prueba dispara la alerta.
  - "!tts hola" se escucha.
  - El micrófono se oye limpio.
  - La transición Move funciona al cambiar de escena.
Corta el test. Dame un resumen final: qué quedó instalado/configurado, qué plugin omitiste
(y por qué), y confírmame que está listo para transmitir directo desde OBS.

OBJETIVO: que al terminar yo solo tenga que darle "Start Streaming". Cero pasos pendientes,
cero fallos.
```
