# Prompt de computer use — QA de Nova en simulador iOS (pegar tal cual)

> **Dónde correr esto:** en un Mac con Xcode instalado, usando un agente con
> computer use (Claude con control de pantalla). NO se puede correr en
> contenedores Linux/cloud: el simulador de iOS solo existe en macOS.
>
> **Prerequisito:** repo en la rama `claude/focus-nova-qa-closure-ueso8h`
> (PR #16) o `main` si ya se mergeó. Backend con los cambios deployado
> (Vercel preview o producción) y sesión iniciada en la app.

---

Eres un QA tester operando macOS con control de pantalla. Tu tarea es probar
la app iOS "Focus" en el simulador con 20 frases críticas en el chat de Nova
y reportar los resultados UNO POR UNO. No improvises frases distintas: usa
las exactas. Si algo falla, captura screenshot y sigue con el siguiente caso.

## Setup (haz esto primero)

1. Abre Terminal y ejecuta:
   ```bash
   cd ~/Developer/focus   # ajustar a la ruta real del repo
   git fetch origin && git checkout claude/focus-nova-qa-closure-ueso8h && git pull
   open ios-native/Focus.xcodeproj
   ```
2. En Xcode: selecciona el scheme **Focus** y un simulador iPhone reciente.
   Presiona ⌘R y espera a que la app abra en el simulador.
3. (Opcional pero valioso) Con la app corriendo, pausa en el debugger y
   ejecuta en la consola LLDB: `po NovaActionNormalizerTests.runAll()`.
   Anota si dice "ALL TESTS PASSED ✓" o la lista de fallos. Continúa (⌘⌃Y).
4. En la app: inicia sesión si hace falta y ve a la pestaña **Nova** →
   segmento **Chat**.

## Ritual de teclado (ANTES y DESPUÉS de los 20 casos)

- Toca el input → el teclado abre y el composer queda VISIBLE encima del
  teclado (no tapado, sin hueco entre composer y teclado).
- Escribe algo y envíalo → el composer no se traba.
- **Arrastra el chat hacia abajo → el teclado DEBE cerrarse** (este es el
  fix nuevo: `.scrollDismissesKeyboard(.immediately)`). Al cerrarse, el
  composer baja sin dejar padding fantasma.
- Repite abrir/cerrar 5 veces. Activa el micrófono, cancélalo, vuelve a
  escribir. Cambia a otra pestaña y vuelve. Nada debe quedar pegado.
- Reporta: `TECLADO: PASS/FAIL + descripción`.

## Los 20 casos (enviar cada frase en el chat, esperar respuesta, verificar)

Para CADA caso reporta: `#N | frase | respuesta de Nova | qué se creó/editó
(título, subtítulo, fecha, hora, duración/término) | PASS o FAIL + motivo`.
Verifica lo creado en Mi Día / Calendario, no solo el texto de Nova.

| # | Frase exacta | Resultado esperado |
|---|---|---|
| 1 | `fútbol a las 5` | Evento "Fútbol" HOY 5:00 PM, SIN hora de término (punto, no bloque de 1 h). Respuesta natural, sin preguntar AM/PM. |
| 2 | `gym pierna a las 7` | Evento "Gym" con subtítulo "Pierna" visible bajo el título, 7 PM (o 7 AM aceptable), sin término. |
| 3 | `reunión a las 8 de mindfulness` | Evento "Reunión" + subtítulo "Mindfulness". Aceptable que confirme el periodo (8 AM/PM) en la respuesta. |
| 4 | `acuérdame comprar pan a las 6` | Recordatorio "Comprar pan" a las 6:00 PM — CON hora (no debe perderla), sin duración. |
| 5 | `tengo que llamar al médico` | TAREA (pestaña Tareas), NO evento, NO hora inventada. |
| 6 | `doctor a las 11` | Evento "Doctor" 11:00 AM, SIN término. No pregunta duración. |
| 7 | `clase publicidad a las 12` | Evento "Clase" + subtítulo "Publicidad" (o "Clase de publicidad" como título — anotar cuál), 12:00 PM. |
| 8 | `fútbol a las 5 acordarme de llevar la pelota` | UN evento "Fútbol" 5 PM con detalle "Llevar la pelota" (subtítulo o recordatorio asociado). NO dos eventos sueltos. |
| 9 | `ponme fútbol` → cuando pregunte la hora → `a las 5` | Mantiene contexto: crea Fútbol hoy 5 PM. JAMÁS "¿qué pasa a las 5?". |
| 10 | `acuérdame comprar pan` → cuando pregunte → `a las 6` | Recordatorio "Comprar pan" 6 PM, hilo conservado. |
| 11 | (sobre lo recién creado) `cámbialo a las 6` | Edita el evento existente a 6:00 PM. NO crea duplicado. |
| 12 | (sobre otro recién creado) `cambialo a las 6` (sin tilde) | Igual que #11. |
| 13 | (sobre lo recién creado) `muévelo a mañana` | Mismo evento movido a mañana, misma hora. |
| 14 | (otro) `muevelo a mañana` (sin tilde) | Igual que #13. |
| 15 | (sobre un evento con hora) `ponlo una hora antes` | Hora del evento − 60 min. |
| 16 | (recién creado hoy) `mejor mañana` | Lo mueve a mañana (edición, no evento nuevo). |
| 17 | (recién creado) `mejor no` | Lo elimina o pregunta UNA confirmación concreta. NO crea nada nuevo. |
| 18 | (con Fútbol existente) `borra lo de fútbol` | Elimina el evento Fútbol correcto. |
| 19 | (con una reunión existente) `elimina la reunión` | Elimina la reunión correcta. Si hay 2+ reuniones, pregunta cuál (una sola pregunta). |
| 20 | (con el recordatorio del caso 4/10) `quita el recordatorio de comprar pan` | Elimina ese recordatorio. |

## Casos de NO-acción (rápidos, al final)

- `quizás mañana vaya al gym` → NO crea nada, responde conversacional.
- `no sé cómo ordenar mi día` → consejo útil usando la agenda real, NO crea nada.
- `qué tengo mañana?` → lista real de eventos de mañana, NO crea nada.

## Criterios de FAIL automático

- Cualquier evento creado con término de 1 hora cuando el usuario no dio duración.
- Subtítulo metido dentro del título o perdido.
- Recordatorio que pierde la hora dada.
- Respuesta robótica ("Intención detectada", "Procediendo a…", "Necesito más
  información" sin pregunta concreta).
- Pérdida de contexto en los casos 9-17.
- Teclado pegado en cualquier punto del ritual.

## Entregable

Tabla completa de los 20 + ritual de teclado + 3 no-acción, con screenshot de
cada FAIL, y veredicto final: "listo para TestFlight" o lista de bloqueos.
Pega los resultados en el PR #16 o en `docs/NOVA_QA_CLOSURE.md` §7.
