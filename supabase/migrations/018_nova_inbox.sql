-- ── 018_nova_inbox ──────────────────────────────────────────────────────────
-- Bandeja de Nova V1: extiende `suggestions` con priorización, snooze, fuente
-- y expiración, y crea `nova_signals` (feedback loop para que Nova aprenda
-- qué clases de propuestas el usuario aprueba/rechaza).
--
-- Motivación:
--   La tabla `suggestions` ya existía (modo propuesta — Nova guarda acciones
--   antes de aplicarlas; el usuario aprueba/rechaza). Hasta ahora se usaba
--   solo desde Kairos (`api/kairos/inbox.js`) y con el hook web legacy. Para
--   convertirla en una bandeja real con sugerencias proactivas (overdue,
--   overload, conflictos) hace falta:
--     * relevance_score: ordenar las cards por importancia, no solo por fecha
--     * snoozed_until: posponer una sugerencia sin perderla
--     * source: distinguir Kairos / Nova chat / reglas determinísticas / usuario
--     * expires_at: algunas sugerencias caducan (ej. focus_block "para hoy")
--
-- Y para que Nova mejore con el uso, registramos cada interacción del
-- usuario con la bandeja en `nova_signals`. El system prompt podrá leer los
-- últimos N días de signals e inyectar "el usuario rechaza routine_proposal
-- (3/3 últimos)" — Nova deja de proponer ese tipo por 14 días.
--
-- Convenciones:
--   - relevance_score ∈ [0, 1]. Default 0.5. Mayor = más prioritaria.
--   - snoozed_until: TIMESTAMPTZ futuro. Mientras esté en futuro, la fila NO
--     debe aparecer en la bandeja. Cuando vence, vuelve a status='pending'.
--   - source: 'nova' (chat) | 'kairos' | 'rule' (cron) | 'user'. Default 'nova'
--     para no romper Kairos ni el hook web — ambos sobreescriben el campo
--     explícitamente.
--   - expires_at: TIMESTAMPTZ. Si pasa, la sugerencia queda 'expired' (lo
--     hacemos lazy: el endpoint la filtra; no necesitamos un cron para
--     marcar). NULL = no expira.
--   - status: agregamos 'snoozed' al vocabulario aceptado (no es un CHECK
--     constraint — la columna sigue siendo TEXT libre — pero documentamos
--     aquí que pending|approved|rejected|snoozed|expired son los 5 valores
--     que el código maneja).
--
-- Impacto:
--   - Filas existentes obtienen los defaults (relevance_score=0.5,
--     source='nova', expires_at=NULL, snoozed_until=NULL). El hook web
--     legacy y Kairos no leen estas columnas, así que nada se rompe.
--   - Nuevo índice parcial sobre (user_id, status, relevance_score) acelera
--     el query principal de la bandeja sin penalizar inserciones de
--     sugerencias resueltas.
--
-- Riesgo:
--   - Bajo. Migración aditiva. Cero cambios destructivos.
--
-- ── Aplicar via Supabase SQL Editor ──────────────────────────────────────────

-- 1) Extender suggestions
ALTER TABLE public.suggestions
  ADD COLUMN IF NOT EXISTS relevance_score REAL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS snoozed_until   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source          TEXT DEFAULT 'nova',
  ADD COLUMN IF NOT EXISTS expires_at      TIMESTAMPTZ;

-- Índice parcial para el query principal de la bandeja: pending del usuario
-- ordenadas por relevancia. Ignoramos resueltas para no inflar el índice.
CREATE INDEX IF NOT EXISTS suggestions_user_pending_priority_idx
  ON public.suggestions (user_id, relevance_score DESC, created_at DESC)
  WHERE status = 'pending';

-- 2) Tabla nova_signals — feedback loop
-- Cada vez que el usuario aprueba/rechaza/edita/pospone una sugerencia,
-- escribimos una fila aquí con el `kind` (overdue_batch, focus_block,...) y
-- contexto opcional (razones, edits). El system prompt de Nova lee los
-- últimos 30 días para evitar repetir tipos que el usuario rechaza.
CREATE TABLE IF NOT EXISTS public.nova_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type  TEXT NOT NULL,        -- suggestion_approved | suggestion_rejected | suggestion_edited | suggestion_snoozed | suggestion_dismissed_kind
  kind         TEXT NOT NULL,        -- el `kind` de la suggestion (overdue_batch, focus_block_suggestion, ...)
  context      JSONB DEFAULT '{}'::jsonb, -- razones del usuario, edits aplicados, snooze duration, etc.
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.nova_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nova_signals_owner_all"
  ON public.nova_signals FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Índice usado por el system prompt: traer los últimos N signals de un kind
-- concreto para un usuario.
CREATE INDEX IF NOT EXISTS nova_signals_user_kind_recent_idx
  ON public.nova_signals (user_id, kind, created_at DESC);

-- ── Rollback ────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS public.nova_signals_user_kind_recent_idx;
-- DROP TABLE IF EXISTS public.nova_signals;
-- DROP INDEX IF EXISTS public.suggestions_user_pending_priority_idx;
-- ALTER TABLE public.suggestions
--   DROP COLUMN IF EXISTS expires_at,
--   DROP COLUMN IF EXISTS source,
--   DROP COLUMN IF EXISTS snoozed_until,
--   DROP COLUMN IF EXISTS relevance_score;
