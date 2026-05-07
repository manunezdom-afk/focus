-- Migration 014: tabla notif_log para registro in-app de notificaciones
-- entregadas al usuario.
--
-- Esta tabla está documentada en supabase/schema.sql desde el inicio del
-- proyecto pero nunca fue extraída a una migración propia. La extraemos
-- ahora para que entornos donde el schema.sql no se aplicó completo
-- (típicamente: el primer setup) tengan la tabla disponible.
--
-- Uso: NotificationPanel.jsx lee de aquí el histórico que el usuario ve en
-- la campanita de la TopAppBar. El SW puede insertar al recibir push y la
-- propia app cuando dispara recordatorios locales.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.notif_log (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id    TEXT,
  title       TEXT,
  body        TEXT,
  icon        TEXT,
  timestamp   BIGINT,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notif_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own notifications" ON public.notif_log;
DROP POLICY IF EXISTS "notif_log_owner_all"            ON public.notif_log;
CREATE POLICY "notif_log_owner_all"
  ON public.notif_log FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS notif_log_user_created_idx
  ON public.notif_log (user_id, created_at DESC);
