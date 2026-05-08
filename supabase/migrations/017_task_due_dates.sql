-- ── 017_task_due_dates ──────────────────────────────────────────────────────
-- Agrega due_date / due_time a la tabla tasks para soportar tareas con
-- fecha y hora propias (sección "Próximas" en mobile y web).
--
-- Motivación: hoy una tarea solo tiene `category` (hoy/semana/algún día).
-- Si el usuario dice "recuérdame llamar al dentista el viernes", no hay
-- forma de mostrarla en la fecha correcta — termina como "esta semana"
-- y el contexto se pierde. due_date soluciona esto sin duplicar el modelo
-- de eventos (eventos tienen una hora obligatoria de bloque; tareas con
-- due_time son más informales — solo aviso opcional).
--
-- Convenciones (mismo formato que la tabla events):
--   - due_date: 'YYYY-MM-DD' en zona local del usuario, o NULL.
--   - due_time: 'HH:MM' o 'HH:MM-HH:MM' en zona local del usuario, o NULL.
--   - Si due_date está seteado pero category no, mostrar en bucket "Próximas".
--   - Si ambos están seteados, prevalece due_date para ordenar.
--
-- Impacto:
--   - 2 columnas TEXT nullable. Apps que no lean los campos siguen igual.
--   - Una vista o índice nuevo no se necesita; el query existente filtra
--     ya por user_id.
--
-- Riesgo:
--   - Bajo. Cero impacto en runtime. Migración instantánea.
--
-- ── Aplicar via Supabase SQL Editor ──────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS due_date TEXT,
  ADD COLUMN IF NOT EXISTS due_time TEXT;

-- Índice parcial sobre (user_id, due_date) cuando due_date NO es null —
-- acelera el query "dame todas las tareas próximas ordenadas por fecha"
-- sin pesar en escrituras de tareas sin due_date (la mayoría).
CREATE INDEX IF NOT EXISTS tasks_due_date_idx
  ON public.tasks (user_id, due_date)
  WHERE due_date IS NOT NULL;

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.tasks_due_date_idx;
-- ALTER TABLE public.tasks
--   DROP COLUMN IF EXISTS due_date,
--   DROP COLUMN IF EXISTS due_time;
