# Migraciones 016 y 017 — propuestas pendientes de aprobación

> Estado: **NO APLICADAS**. Esperando OK del usuario antes de correr en
> producción (CLAUDE.md regla: "No cambiar schema Supabase sin explicar
> antes").

## ¿Por qué hace falta cada una?

### 016 — subtareas y links a eventos

Hoy el legacy web maneja `parentTaskId` y `linkedEventId` en localStorage.
Al cambiar de device se pierden, y Nova no los ve cuando razona.

**Después de aplicar 016:**
- Nova podrá emitir `add_task` con `parent_task_id` o `linked_event_id` y
  el cliente lo persistirá.
- La UI mobile/web podrá indentar subtareas bajo su padre (igual que la
  app legacy hacía localmente).
- Cross-device: si creás una subtarea desde web, aparece en mobile y
  viceversa.

### 017 — due_date / due_time en tareas

Hoy una tarea solo tiene `category` (hoy/semana/algún día). Si el usuario
dice "recuérdame llamar al dentista el viernes", la tarea cae en "esta
semana" y el viernes en sí mismo no se ve resaltado.

**Después de aplicar 017:**
- Bucket "Próximas" en Tareas con tareas ordenadas por `due_date`.
- Notificaciones programables a la hora `due_time` (futuro).
- Nova puede agendar tareas con fecha sin convertirlas en eventos
  (eventos = bloques de tiempo obligatorios; tareas con fecha = pendientes
  flexibles).

## Cómo aplicar (cuando vos digas que sí)

1. Abrí Supabase Dashboard → SQL Editor del proyecto de producción.
2. Pegá el contenido de `016_task_subtasks_and_links.sql`. Run. Confirmá
   que dice "Success".
3. Pegá el contenido de `017_task_due_dates.sql`. Run. Confirmá.
4. Avisame y yo agrego los converters y la UI mobile/web en un commit
   siguiente.

**Tiempo estimado:** <1s cada una. La tabla `tasks` es pequeña y los
ALTER COLUMN son metadatos.

**Riesgo de aplicación:** muy bajo. Las columnas son nullables; clientes
que no las lean (como mobile actual) siguen funcionando idéntico.

## Plan de rollout post-migración

Si aprobás y aplicás:
1. Mobile: extender `Task` type con `parentTaskId`, `linkedEventId`,
   `dueDate`, `dueTime`. Update converters `taskFromDb` / `createTask`.
2. Mobile: TaskDetailSheet añade DatePicker opcional.
3. Mobile: Nuevo bucket "Próximas" en Tareas, ordenado por `due_date ASC,
   due_time ASC NULLS LAST`.
4. Web (legacy): migrar de localStorage a Supabase via `dataService`.
5. Nova: extender system prompt para que `add_task` acepte estos campos.

Cada paso es un commit independiente. Yo voy haciéndolos cuando confirmes
que la migración corrió.

## Si NO querés aplicar todavía

No hay penalidad. Las apps siguen funcionando como ahora. Las migraciones
quedan en este folder como referencia. Borrarlas es seguro si decidís
descartarlas (`rm 016_*.sql 017_*.sql PROPOSED_016_017_README.md`).
