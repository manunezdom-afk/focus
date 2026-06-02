# stream/ — Setup de streaming para Kick (OBS, Windows)

Carpeta de trabajo para montar el setup de streaming en **Kick** desde **OBS** en Windows,
**gratis y a prueba de fallos**. Pensada para ejecutarse con **Claude Code computer use** o
**Cowork** apuntando a este repositorio.

## Cómo usarlo

1. Abre una sesión de **Cowork** o **Claude Code con computer use** en tu PC Windows (Pro/Max),
   con la función "Let Claude use your computer" activada.
2. Asegúrate de que OBS ya está instalado y logueado en tu cuenta de Kick.
3. Pásale el contenido de [`setup-kick-obs-prompt.md`](./setup-kick-obs-prompt.md) como tarea.
4. Claude hará lo técnico solo y se detendrá para: (a) tu login de Botrix y (b) elegir el estilo
   visual.

## Qué incluye el setup (todo gratis)

- **OBS** (ya instalado/logueado) + plugins: Move, Advanced Scene Switcher, obs-backgroundremoval,
  Source Record (core) + obs-shaderfilter, Audio Monitor (extra).
- **Botrix** (cloud, gratis): bot, comandos, moderación, **TTS**, **alerts**, **puntos de
  lealtad**, soundboard — montado en OBS como Browser Sources.
- **Micrófono limpio** con filtros nativos de OBS (Noise Suppression + Gate + Compressor).
- **Escenas** (Juego / Cámara / BRB) con transiciones animadas Move.

## Decisiones fijadas

- Plataforma: **Kick** · OS: **Windows** · Costo: **$0**.
- **Sin co-host de IA** (solo TTS de Botrix). Sin StreamFX (rompe entre versiones).
- Lo técnico se hace sin preguntar; **la parte visual siempre pregunta y da opciones**.

## Archivos

- [`setup-kick-obs-prompt.md`](./setup-kick-obs-prompt.md) — el prompt listo para pegar.
