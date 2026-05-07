-- Migration 015: user_plans — plan comercial del usuario (free/early_access/admin)
--
-- Por qué tabla aparte y no columna en user_profiles:
--   La policy user_profiles_owner_all permite UPDATE al dueño. Si el plan
--   viviera ahí, cualquier usuario logueado podría auto-promoverse a
--   early_access desde el cliente con un upsert. Aquí mantenemos la tabla
--   con RLS de solo-lectura para el dueño y sin policies de escritura, así
--   solo el service_role (backend) puede asignar planes.
--
-- Reglas:
--   * Si no hay fila para un user_id → tratarlo como free (default implícito).
--   * Si expires_at < now() → tratarlo como free (el backend resuelve esto).
--   * granted_by sirve para auditoría: 'manual', 'invite', 'system', etc.
--   * notes es texto libre para dejar contexto al asignar (ej. "primer beta").
--
-- Cómo asignar early_access manualmente desde el SQL Editor de Supabase:
--   INSERT INTO public.user_plans (user_id, plan, granted_by, expires_at, notes)
--   VALUES ('<uuid>', 'early_access', 'manual', NOW() + INTERVAL '90 days', 'beta cohort 1')
--   ON CONFLICT (user_id) DO UPDATE
--     SET plan       = EXCLUDED.plan,
--         expires_at = EXCLUDED.expires_at,
--         granted_by = EXCLUDED.granted_by,
--         notes      = EXCLUDED.notes,
--         updated_at = NOW();
--
-- Cómo volver a free:
--   DELETE FROM public.user_plans WHERE user_id = '<uuid>';
--   -- o: UPDATE public.user_plans SET plan='free', expires_at=NULL WHERE user_id='<uuid>';
--
-- Cómo marcar admin (sin vencimiento):
--   INSERT INTO public.user_plans (user_id, plan, granted_by)
--   VALUES ('<uuid>', 'admin', 'manual')
--   ON CONFLICT (user_id) DO UPDATE SET plan='admin', expires_at=NULL, updated_at=NOW();
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.user_plans (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan       TEXT NOT NULL DEFAULT 'free'
             CHECK (plan IN ('free', 'early_access', 'plus', 'pro', 'admin')),
  granted_by TEXT NOT NULL DEFAULT 'system',
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_plans IS
  'Plan comercial del usuario. Sin fila = free implícito. Sólo service_role escribe.';

CREATE INDEX IF NOT EXISTS user_plans_plan_idx
  ON public.user_plans (plan)
  WHERE plan <> 'free';

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

-- El usuario puede LEER su plan (para que la UI muestre badge/copy correcto).
DROP POLICY IF EXISTS "user_plans_owner_select" ON public.user_plans;
CREATE POLICY "user_plans_owner_select"
  ON public.user_plans
  FOR SELECT
  USING (auth.uid() = user_id);

-- Sin policies de INSERT/UPDATE/DELETE: solo service_role escribe. Esto
-- impide que un usuario con sesión válida se auto-promueva a early_access
-- enviando un upsert desde el cliente.

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.user_plans;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.user_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
