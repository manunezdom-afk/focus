-- ── focus_events: subtitle + reminders ──────────────────────────────────────
--
-- Estos tres campos ya existían en el modelo iOS (`FocusEvent`) y se mostraban
-- al crear el evento, pero NO estaban en el DTO de sync (`RemoteFocusEvent`) ni
-- en el schema. Resultado: para usuarios con sesión se perdían en el round-trip
-- a la nube — el usuario veía el subtítulo/aviso al crear el evento (estado en
-- memoria) y desaparecía al reiniciar la app (recarga desde Supabase sin estas
-- columnas). El store local SÍ los persiste, así que sin sesión no había bug.
--
-- `subtitle`         = detalle/contexto bajo el título (ej. "Llevar la pelota").
-- `reminder_offsets` = minutos antes del inicio para avisar (ej. {40, 10}).
-- `reminder_notes`   = texto custom paralelo a cada offset (ej. {"Echar zapatillas"}).
--
-- Idempotente (IF NOT EXISTS) para poder re-aplicar sin error.

ALTER TABLE public.focus_events
  ADD COLUMN IF NOT EXISTS subtitle         TEXT,
  ADD COLUMN IF NOT EXISTS reminder_offsets INTEGER[],
  ADD COLUMN IF NOT EXISTS reminder_notes   TEXT[];
