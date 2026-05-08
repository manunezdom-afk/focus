# Nova mobile + Tareas mobile — pendientes que requieren deps nativas o schema

Este doc cataloga el trabajo que NO se hizo en la fase actual porque requiere
agregar dependencias nativas (con su correspondiente `pod install` / build
nativo) o cambiar el schema de Supabase. Todo lo que se podía hacer en
JS/TS puro ya está implementado.

> Última actualización: 2026-05-07 (commit que cierra Phase 2/3 de los pendientes Nova).

---

## 1. Voz / dictado en Nova/FocusBar

**Estado:** no implementado.

**Por qué requiere dep nativa:** ni `expo-speech` ni `expo-av` cubren STT
(speech-to-text) en device. Las opciones reales son:

- `@react-native-voice/voice` — wrapper sobre `SFSpeechRecognizer` (iOS) y
  `SpeechRecognizer` (Android). **Requiere `pod install`** y crea
  acoplamiento al ciclo nativo del speech recognizer (delegate, lifecycle).
- Grabar con `expo-av` y enviar el audio a un endpoint backend que lo pase
  por Whisper/Deepgram. **Requiere endpoint nuevo** (`/api/transcribe`) y
  cuota/límites en `ai_usage_events` igual que Nova.

**Permisos:** `NSSpeechRecognitionUsageDescription` y
`NSMicrophoneUsageDescription` en `mobile/ios/Focus/Info.plist`.

**Plan recomendado** (cuando se decida implementar):
1. Backend: crear `/api/transcribe` con OpenAI Whisper (o Deepgram). Reusar
   `getUserIdFromAuth`, `checkLimit` con un nuevo `ACTION_TYPES.NOVA_VOICE`,
   `recordUsage` y `trackAIUsageEvent`.
2. Mobile: añadir `expo-av` (ya viene con SDK 54 — confirmar que está
   en `package.json`). Usar `Audio.Recording` para capturar 16kHz mono.
3. Componente `<MicButton />` reutilizable — tap para grabar, tap de nuevo
   para parar. Animar scale + pulse mientras graba.
4. Al parar: `FileSystem.readAsStringAsync(uri, { encoding: 'base64' })`,
   POST al endpoint, recibir transcripción, meterla en el composer (no
   auto-enviar — el usuario revisa).
5. Tests: micro de iOS pide permiso solo la primera vez; mock del recorder
   en jest si hace falta.

**Riesgo si se hace mal:** background recording sin parar = drena batería;
endpoint sin rate-limit = costo Whisper ilimitado.

---

## 2. Cámara / foto agenda en Nova

**Estado:** no implementado.

**Backend ya soporta:** `/api/analyze-photo` existe (web lo usa). Acepta
`{ images: [{ base64, mediaType }] }`, devuelve `{ events: [...] }`.

**Por qué requiere dep nativa:** subir foto en mobile necesita o
`expo-image-picker` (galería + cámara) o `expo-camera` (custom UI).
**Requiere `pod install`**.

**Permisos:** `NSCameraUsageDescription` y `NSPhotoLibraryUsageDescription`
en `Info.plist`.

**Plan recomendado:**
1. Añadir `expo-image-picker`. Run `pod install` en `mobile/ios`.
2. Botón cámara en composer Nova (ícono `camera`). Tap → ActionSheet con
   "Tomar foto" / "Elegir de galería".
3. `ImagePicker.launchCameraAsync({ base64: true, mediaType: 'photo' })`.
4. POST a `/api/analyze-photo` con el base64. Manejar `auth_required`,
   `quota_exceeded` igual que el cliente web.
5. Cuando llega `events: [...]`, mostrar bubble propuesta con chips por
   evento detectado y CTA "Agregar todos" / "Descartar". El comportamiento
   es similar al de NovaWidget legacy (`confirmPhotoEvents`).

**Riesgo:** mandar la foto sin compresión = MB grandes. Comprimir antes con
`ImageManipulator.manipulateAsync({ compress: 0.7, format: 'jpeg' })`.

---

## 3. Subtareas anidadas (`parentTaskId`, `linkedEventId`)

**Estado:** no implementado.

**Por qué requiere schema:** la tabla `tasks` actual no tiene columnas
`parent_task_id` ni `linked_event_id`. El legacy web hidrata estos campos
desde `localStorage` (no son persistentes ni sincronizados entre devices).

**Plan recomendado:**
1. Migración Supabase:
   ```sql
   ALTER TABLE tasks
     ADD COLUMN parent_task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
     ADD COLUMN linked_event_id uuid REFERENCES events(id) ON DELETE SET NULL;
   CREATE INDEX tasks_parent_idx ON tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
   CREATE INDEX tasks_linked_event_idx ON tasks(linked_event_id) WHERE linked_event_id IS NOT NULL;
   ```
2. Update RLS: permitir SELECT/UPDATE/DELETE sobre estas columnas iguales
   al patrón existente (`auth.uid() = user_id`).
3. Mobile: extender `Task` type con `parentTaskId?: string | null` y
   `linkedEventId?: string | null`. Actualizar `taskFromDb` / `createTask`
   para hidratar/persistir.
4. UI: indentar subtareas dentro de un `<Card>` bajo la tarea/evento padre.
5. Nova: ya emite `parentTaskId` en `add_task` (system prompt lo soporta);
   solo falta que el cliente mobile lo pase a `createTask`.

**Riesgo:** sin `ON DELETE CASCADE` el delete de un padre dejaría huérfanas
las subtareas. Confirmar que la migración corre en producción sin lock
prolongado de la tabla (la tabla `tasks` es pequeña, debería ser
instantáneo).

---

## 4. Tareas con fecha/hora propia (sección "Próximas")

**Estado:** no implementado.

**Por qué requiere schema:** `tasks` solo tiene `category` (hoy/semana/algún
día). Para mostrar una sección "Próximas con fecha futura" necesitamos
columnas `due_date` y opcionalmente `due_time`.

**Plan recomendado:**
1. Migración:
   ```sql
   ALTER TABLE tasks
     ADD COLUMN due_date date,
     ADD COLUMN due_time text; -- HH:MM en local user TZ, igual a events.time
   CREATE INDEX tasks_due_date_idx ON tasks(user_id, due_date) WHERE due_date IS NOT NULL;
   ```
2. Mobile: extender `Task` type con `dueDate?: string | null` y
   `dueTime?: string | null`. Update converters.
3. UI Tareas: nuevo bucket "Próximas" antes de "Algún día". Ordenar por
   `due_date ASC, due_time ASC NULLS LAST`.
4. TaskDetailSheet: añadir DatePicker + TimePicker opcionales.
5. Nova: extender system prompt para que `add_task` acepte
   `task.dueDate` / `task.dueTime`. El cliente al recibirlo, lo INSERTA tal
   cual.
6. Notificaciones: aprovechar `expo-notifications` para alertas a la hora
   `dueTime` del día `dueDate` (futuro).

**Riesgo:** confusión semántica entre `category` y `due_date`. Una regla
clara: si tiene `due_date`, va al bucket "Próximas" sin importar
`category`. Documentar en system prompt.

---

## 5. Acción `remember` (memorias persistidas)

**Estado:** no aplicada en mobile (el handler la ignora).

**Por qué requiere backend/schema:** la web persiste memorias en la tabla
`user_memories` vía el hook `useUserMemories`. Mobile aún no tiene cliente
ni para escribir ni para leer esa tabla.

**Plan recomendado:**
1. Confirmar que la tabla `user_memories` ya existe en producción
   (probablemente sí — la web la usa). Schema esperado:
   ```
   id uuid, user_id uuid, content text, category text, subject text,
   confidence text, created_at timestamptz
   ```
2. Mobile: crear `mobile/src/data/memories.ts` con `fetchMemories(userId)`
   y `createMemory(userId, input)` siguiendo el patrón de `tasks.ts`.
3. Hook `useMemories()` con cache 60s — las memorias son relativamente
   estables.
4. En `nova.tsx` → `applyActions`: cuando `a.type === 'remember'` llamar
   `createMemory(userId, a.memory)`. Es transparente — sin chip de
   confirmación al usuario.
5. Pasar `memories` en el body del POST a `/api/focus-assistant` para que
   Nova use el contexto en próximas conversaciones.

**Riesgo:** memorias acumulándose sin tope. Limitar a las últimas N=100 al
enviar al backend (igual que web).

---

## 6. Shortcut ⌘K

**Estado:** no implementado, baja prioridad.

**Por qué:** detectar atajos de teclado externo en RN no es trivial —
requiere `KeyboardEvent` listeners nativos vía `react-native-keyboard-controller`
o iOS-only `UIKeyCommand`. Casi nadie usa teclado externo con iPhone.

**Plan recomendado:** dejar para una fase posterior. Si hay demanda real:
añadir `react-native-keyboard-controller`, registrar `UIKeyCommand` con
`input: "k"` y `modifierFlags: .command` que dispare `router.push(/(tabs)/nova)`.

---

## Resumen ejecutivo

| Pendiente | Bloqueador | Esfuerzo | Prioridad |
|-----------|-----------|----------|-----------|
| Voz Nova | Dep nativa + endpoint | Alto | Media |
| Cámara Nova | Dep nativa | Medio | Alta |
| Subtareas | Schema | Medio | Media |
| Tareas con fecha | Schema | Alto | Alta |
| `remember` action | API client + schema | Bajo | Media |
| ⌘K | Dep nativa | Bajo | Baja |

Las prioridades reflejan el valor para el usuario asumiendo el flujo actual
(Nova como organizador del día). Antes de tocar schema, validar con el
usuario que el feature se va a usar — los cambios de schema en producción
no se pueden tomar a la ligera.
