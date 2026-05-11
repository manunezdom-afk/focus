-- 018_focus_native_v1.sql
-- Tablas paralelas para la app iOS nativa (Swift/SwiftUI).
--
-- Por qué nuevas tablas en vez de extender `events`/`tasks` legacy:
--   1. Las legacy usan `TEXT` para fecha y hora; iOS necesita `TIMESTAMPTZ`
--      para que ordenar/filtrar/sync sea limpio.
--   2. El shape legacy lo consume el web actual; cambiarlo rompe producción.
--   3. La app nativa necesita campos nuevos (is_reminder, source, external_*).
--
-- Las tablas `public.events` y `public.tasks` legacy quedan **intactas** y
-- siguen siendo la fuente de verdad para la app web. iOS lee y escribe contra
-- `focus_events` / `focus_tasks`.
--
-- Eventualmente (cuando web migre o se retire) podríamos consolidar, pero
-- hoy lo importante es no romper nada.

-- ── focus_events ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.focus_events (
  id                   UUID PRIMARY KEY,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  notes                TEXT,
  start_time           TIMESTAMPTZ,
  end_time             TIMESTAMPTZ,
  is_reminder          BOOLEAN NOT NULL DEFAULT FALSE,
  inferred_duration    BOOLEAN NOT NULL DEFAULT FALSE,
  section              TEXT,
  location             TEXT,
  source               TEXT NOT NULL DEFAULT 'local',
  external_calendar_id TEXT,
  external_event_id    TEXT,
  url                  TEXT,
  last_synced_at       TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

ALTER TABLE public.focus_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "focus_events_owner_select"
  ON public.focus_events FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "focus_events_owner_insert"
  ON public.focus_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_events_owner_update"
  ON public.focus_events FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_events_owner_delete"
  ON public.focus_events FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS focus_events_user_start_idx
  ON public.focus_events (user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS focus_events_user_deleted_idx
  ON public.focus_events (user_id, deleted_at);

-- ── focus_tasks ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.focus_tasks (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  notes           TEXT,
  category        TEXT,
  priority        TEXT,
  is_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  done_at         TIMESTAMPTZ,
  due_date        DATE,
  due_time        TIME,
  linked_event_id UUID,
  subtasks        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ
);

ALTER TABLE public.focus_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "focus_tasks_owner_select"
  ON public.focus_tasks FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "focus_tasks_owner_insert"
  ON public.focus_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_tasks_owner_update"
  ON public.focus_tasks FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_tasks_owner_delete"
  ON public.focus_tasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS focus_tasks_user_due_idx
  ON public.focus_tasks (user_id, due_date NULLS LAST);
CREATE INDEX IF NOT EXISTS focus_tasks_user_completed_idx
  ON public.focus_tasks (user_id, is_completed);

-- ── triggers para auto-actualizar updated_at ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.focus_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS focus_events_set_updated_at ON public.focus_events;
CREATE TRIGGER focus_events_set_updated_at
  BEFORE UPDATE ON public.focus_events
  FOR EACH ROW EXECUTE FUNCTION public.focus_set_updated_at();

DROP TRIGGER IF EXISTS focus_tasks_set_updated_at ON public.focus_tasks;
CREATE TRIGGER focus_tasks_set_updated_at
  BEFORE UPDATE ON public.focus_tasks
  FOR EACH ROW EXECUTE FUNCTION public.focus_set_updated_at();
