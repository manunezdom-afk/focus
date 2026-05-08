-- ── 016_task_subtasks_and_links ─────────────────────────────────────────────
-- Agrega soporte para subtareas anidadas (parent_task_id) y para vincular
-- una tarea con un evento (linked_event_id).
--
-- Motivación: el legacy web hidrata estos campos desde localStorage, lo que
-- significa que se pierden al cambiar de device y no son visibles a Nova/IA.
-- Persistirlos en Supabase los hace cross-device y permite que Nova razone
-- sobre la jerarquía ("estas 3 tareas son subtareas de X, no de hoy").
--
-- Impacto:
--   - Tabla tasks gana 2 columnas nullables (default NULL → no rompe nada).
--   - Apps existentes que NO lean estos campos siguen funcionando idéntico.
--   - Nova podrá emitir add_task con parent_task_id / linked_event_id y el
--     cliente lo persistirá. La UI mobile/web mostrará subtareas indentadas.
--
-- Riesgo:
--   - Bajo. Las columnas son nullable. ON DELETE CASCADE en parent_task_id
--     asegura que borrar un padre limpia subtareas (comportamiento esperado).
--   - ON DELETE SET NULL en linked_event_id desliga la tarea sin borrarla
--     cuando el evento se borra (comportamiento esperado).
--
-- Tiempo estimado: <1s en producción (la tabla tasks es pequeña).
--
-- ── Aplicar via Supabase SQL Editor ──────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id  TEXT REFERENCES public.tasks(id)  ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS linked_event_id TEXT REFERENCES public.events(id) ON DELETE SET NULL;

-- Índices parciales — solo cuando la columna NO es null. Mantiene el índice
-- chico y el lookup rápido cuando Nova pide "subtareas de X".
CREATE INDEX IF NOT EXISTS tasks_parent_idx
  ON public.tasks (parent_task_id)
  WHERE parent_task_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_linked_event_idx
  ON public.tasks (linked_event_id)
  WHERE linked_event_id IS NOT NULL;

-- RLS no necesita cambios: la policy "tasks_owner_all" ya cubre cualquier
-- columna nueva porque filtra por user_id sin enumerar campos.

-- ── Rollback ────────────────────────────────────────────────────────────────
-- (correr solo si necesitás revertir; pierde los datos en estas columnas)
--
-- DROP INDEX IF EXISTS public.tasks_parent_idx;
-- DROP INDEX IF EXISTS public.tasks_linked_event_idx;
-- ALTER TABLE public.tasks
--   DROP COLUMN IF EXISTS parent_task_id,
--   DROP COLUMN IF EXISTS linked_event_id;
