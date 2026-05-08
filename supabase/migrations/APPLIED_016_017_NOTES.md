# Migraciones 016 y 017 — APLICADAS en producción

> Estado: **✅ APLICADAS** en el proyecto Supabase de producción
> (`hvwqeemtfoyvfmongwzo`) vía SQL Editor del Dashboard.
> Verificado contra `information_schema.columns`, `pg_indexes` y
> `pg_policies` antes y después de aplicar.

## Qué se aplicó

### 016 — subtareas y links a eventos
- `tasks.parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE`
- `tasks.linked_event_id TEXT REFERENCES events(id) ON DELETE SET NULL`
- Índice parcial `tasks_parent_idx` ON `(parent_task_id)` WHERE NOT NULL
- Índice parcial `tasks_linked_event_idx` ON `(linked_event_id)` WHERE NOT NULL

### 017 — fechas propias de tareas
- `tasks.due_date TEXT` (formato `YYYY-MM-DD` en zona local del usuario)
- `tasks.due_time TEXT` (formato `HH:MM` o `HH:MM-HH:MM`)
- Índice parcial compuesto `tasks_due_date_idx` ON `(user_id, due_date)`
  WHERE due_date IS NOT NULL

## RLS verificada

La policy `tasks_owner_all` (definida en migración 012 baseline) usa
`auth.uid() = user_id` para `qual` y `with_check`. Como filtra por fila
y no por columna, las 4 columnas nuevas heredan automáticamente la
restricción owner-only. **No hace falta nueva policy.**

Verificado con:

```sql
SELECT policyname, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename='tasks';
```

## Resultados de verificación post-aplicación

```
col:due_date          → text
col:due_time          → text
col:linked_event_id   → text
col:parent_task_id    → text
idx:tasks_due_date_idx       → CREATE INDEX ... USING btree (user_id, due_date) WHERE ...
idx:tasks_linked_event_idx   → CREATE INDEX ... USING btree (linked_event_id) WHERE ...
idx:tasks_parent_idx         → CREATE INDEX ... USING btree (parent_task_id) WHERE ...
rls:tasks_owner_all          → with_check=(auth.uid() = user_id)
```

## Rollback (solo si hace falta revertir)

> ⚠️ Pierde los datos persistidos en estas columnas. No correr en prod
> sin backup explícito.

```sql
-- 017 rollback
DROP INDEX IF EXISTS public.tasks_due_date_idx;
ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS due_date,
  DROP COLUMN IF EXISTS due_time;

-- 016 rollback
DROP INDEX IF EXISTS public.tasks_parent_idx;
DROP INDEX IF EXISTS public.tasks_linked_event_idx;
ALTER TABLE public.tasks
  DROP COLUMN IF EXISTS parent_task_id,
  DROP COLUMN IF EXISTS linked_event_id;
```

## Qué cliente queda activo con esto

- Mobile (`/mobile`): el commit `fef5bf5` ya tenía los `Task` types
  extendidos, los converters listos (SELECT '*' tolerante a columna
  faltante), TaskDetailSheet con chips y validación de fecha/hora,
  bucket "Próximas" y bulk defer. Con las migraciones aplicadas, todo
  ese flow ya persiste correctamente en server.

- Web legacy (`/src`): aún usa `localStorage` para `parentTaskId` y
  `linkedEventId`. Migrar la web a Supabase para estos campos es un
  trabajo aparte (el schema ya soporta ambas, no hace falta migración
  adicional). Documentado para FASE futura.

- Nova: el system prompt todavía no menciona `parent_task_id` /
  `linked_event_id` / `due_date` / `due_time` en el JSON schema de
  acciones. Cuando agreguemos eso, Nova podrá emitir directamente
  `add_task` con esos campos. Documentado para FASE futura.
