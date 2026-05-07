-- Migration 013: tracking granular per-call de uso de IA para futuro sistema de
-- límites y costos.
--
-- Por qué una tabla nueva (no extender ai_usage):
--   * `ai_usage` (migración 010) es un contador agregado por (user_id, day,
--     endpoint) → count. Lo usa /api/_lib/aiUsage.js para enforcement de
--     cuota diaria por endpoint. Cambiar su shape rompe ese flujo.
--   * `ai_usage_events` guarda UNA fila por cada llamada al modelo, con tokens
--     y costo estimado. Permite construir gráficos, alertas, top-users por
--     costo y futuros tiers (free/pro) sin perder la granularidad.
--   * El contador diario puede derivarse via SELECT count(*) FROM
--     ai_usage_events WHERE user_id = X AND created_at::date = today si
--     llegamos a unificar; mientras tanto los dos coexisten sin pisarse.
--
-- Esquema definido por el spec del usuario (paso 3 de la auditoría de seguridad):
--   user_id           — dueño del evento (FK a auth.users con CASCADE)
--   action_type       — 'focus-assistant' | 'analyze-photo' | … etiqueta del endpoint
--   model_used        — id exacto del modelo Anthropic (ej. 'claude-haiku-4-5-20251001')
--   input_tokens      — tokens del prompt (puede ser 0 hasta que el SDK los reporte)
--   output_tokens     — tokens de la respuesta
--   total_tokens      — generated columns: input + output (lo calcula Postgres)
--   estimated_cost_usd— costo estimado al precio del modelo en el momento del call
--   metadata          — JSONB libre: latency_ms, finish_reason, request_id, etc.
--   created_at        — timestamp del call
--
-- Seguridad:
--   * RLS activado.
--   * El backend (vía service_role) inserta. El usuario solo puede leer SUS
--     propios eventos (FOR SELECT WITH auth.uid()=user_id).
--   * Sin policies de INSERT/UPDATE/DELETE para usuarios → solo service_role
--     escribe → un atacante con sesión válida no puede inflar contadores ajenos
--     ni mentir sobre tokens consumidos.
--   * Las inserts del backend NO confían en datos del cliente: tokens y costo
--     se calculan en el handler con la respuesta real del modelo.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type         TEXT    NOT NULL,
  model_used          TEXT    NOT NULL,
  input_tokens        INTEGER NOT NULL DEFAULT 0 CHECK (input_tokens  >= 0),
  output_tokens       INTEGER NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  total_tokens        INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  estimated_cost_usd  NUMERIC(12, 6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  metadata            JSONB   NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_usage_events IS
  'Log granular de cada llamada a IA. Una fila por call. Para futuro sistema de límites/costos.';

CREATE INDEX IF NOT EXISTS ai_usage_events_user_created_idx
  ON public.ai_usage_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_usage_events_action_idx
  ON public.ai_usage_events (action_type, created_at DESC);

-- Nota: para "uso de hoy del usuario" se usa
--   WHERE user_id = $1 AND created_at >= now() - interval '1 day'
-- que ya aprovecha ai_usage_events_user_created_idx. Evitamos un índice
-- expression sobre (created_at::date) porque ese cast no es IMMUTABLE en
-- Postgres (depende de timezone) y bloquea CREATE INDEX.

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_events_owner_select" ON public.ai_usage_events;
CREATE POLICY "ai_usage_events_owner_select"
  ON public.ai_usage_events
  FOR SELECT
  USING (auth.uid() = user_id);

-- Sin policies de INSERT/UPDATE/DELETE: solo service_role escribe.
