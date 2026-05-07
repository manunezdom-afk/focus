-- Migration 012: baseline de RLS endurecido para lanzamiento (TestFlight/beta).
--
-- Objetivo: que cada usuario lea/escriba SOLO sus propios datos. Hoy el
-- esquema vive con políticas FOR ALL USING (auth.uid() = user_id|id), lo
-- cual es correcto pero se apoya en el fallback implícito de WITH CHECK.
-- Esta migración:
--   1. Garantiza RLS habilitado en cada tabla privada (idempotente).
--   2. Reemplaza las políticas FOR ALL ... USING (...) por una variante
--      explícita FOR ALL ... USING (...) WITH CHECK (...) — así la
--      validación de fila NUEVA queda anclada al mismo predicado y no
--      depende del fallback del motor (más resistente a futuros parches
--      de PostgreSQL).
--   3. Refuerza la política existente de notification_deliveries y
--      ai_usage para que los usuarios sólo puedan leer (writes solo
--      service_role desde el cron / aiUsage).
--   4. Agrega política de SELECT explícita en push_subscriptions y
--      native_push_tokens para que el endpoint con anon key (sin Bearer)
--      no pueda enumerar tokens ajenos.
--   5. Verifica que device_pairings sigue SIN policies — toda lectura
--      pasa por endpoints con service_role.
--
-- Es seguro correr múltiples veces: cada CREATE POLICY se prefija con
-- DROP POLICY IF EXISTS y los ALTER TABLE ENABLE RLS son idempotentes.

-- ── 1. Habilitar RLS (no-op si ya estaba) ────────────────────────────────────

ALTER TABLE public.user_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggestions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notif_log                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_signals             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_behavior            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.native_push_tokens       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sent_notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_feeds           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kairos_links             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_pairings          ENABLE ROW LEVEL SECURITY;

-- ── 2. user_profiles ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own profile"      ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_owner_all"       ON public.user_profiles;
CREATE POLICY "user_profiles_owner_all"
  ON public.user_profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── 3. events ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own events"   ON public.events;
DROP POLICY IF EXISTS "events_owner_all"          ON public.events;
CREATE POLICY "events_owner_all"
  ON public.events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. tasks ─────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own tasks"    ON public.tasks;
DROP POLICY IF EXISTS "tasks_owner_all"           ON public.tasks;
CREATE POLICY "tasks_owner_all"
  ON public.tasks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. blocks ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own blocks"   ON public.blocks;
DROP POLICY IF EXISTS "blocks_owner_all"          ON public.blocks;
CREATE POLICY "blocks_owner_all"
  ON public.blocks
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 6. suggestions ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own suggestions"  ON public.suggestions;
DROP POLICY IF EXISTS "suggestions_owner_all"         ON public.suggestions;
CREATE POLICY "suggestions_owner_all"
  ON public.suggestions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 7. user_memories ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own memories"  ON public.user_memories;
DROP POLICY IF EXISTS "user_memories_owner_all"    ON public.user_memories;
CREATE POLICY "user_memories_owner_all"
  ON public.user_memories
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 8. notif_log ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own notifications"  ON public.notif_log;
DROP POLICY IF EXISTS "notif_log_owner_all"             ON public.notif_log;
CREATE POLICY "notif_log_owner_all"
  ON public.notif_log
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 9. user_signals ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own signals"  ON public.user_signals;
DROP POLICY IF EXISTS "user_signals_owner_all"    ON public.user_signals;
CREATE POLICY "user_signals_owner_all"
  ON public.user_signals
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 10. user_behavior ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own behavior"  ON public.user_behavior;
DROP POLICY IF EXISTS "user_behavior_owner_all"    ON public.user_behavior;
CREATE POLICY "user_behavior_owner_all"
  ON public.user_behavior
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 11. push_subscriptions ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_owner_all"        ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_owner_all"
  ON public.push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 12. native_push_tokens ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own native push tokens" ON public.native_push_tokens;
DROP POLICY IF EXISTS "native_push_tokens_owner_all"        ON public.native_push_tokens;
CREATE POLICY "native_push_tokens_owner_all"
  ON public.native_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 13. sent_notifications ───────────────────────────────────────────────────
-- El cron escribe con service_role (que bypasea RLS). El usuario solo lee.

DROP POLICY IF EXISTS "Users read own sent notifications"  ON public.sent_notifications;
DROP POLICY IF EXISTS "sent_notifications_owner_select"    ON public.sent_notifications;
CREATE POLICY "sent_notifications_owner_select"
  ON public.sent_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── 14. calendar_feeds ──────────────────────────────────────────────────────
-- /api/ics-feed lee con service_role (sin auth header — los calendar clients
-- no pueden mandar Bearer). El dueño usa Bearer para crear/listar/borrar feeds.

DROP POLICY IF EXISTS "Users manage own feeds"   ON public.calendar_feeds;
DROP POLICY IF EXISTS "calendar_feeds_owner_all" ON public.calendar_feeds;
CREATE POLICY "calendar_feeds_owner_all"
  ON public.calendar_feeds
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 15. notification_deliveries ─────────────────────────────────────────────
-- Solo SELECT para el dueño. Inserts del cron pasan por service_role.

DROP POLICY IF EXISTS "user reads own deliveries"        ON public.notification_deliveries;
DROP POLICY IF EXISTS "notification_deliveries_owner_select" ON public.notification_deliveries;
CREATE POLICY "notification_deliveries_owner_select"
  ON public.notification_deliveries
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── 16. ai_usage ────────────────────────────────────────────────────────────
-- Solo SELECT para el dueño. Inserts/updates pasan por service_role en aiUsage.js.

DROP POLICY IF EXISTS "Users read own ai_usage"     ON public.ai_usage;
DROP POLICY IF EXISTS "ai_usage_owner_select"       ON public.ai_usage;
CREATE POLICY "ai_usage_owner_select"
  ON public.ai_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- ── 17. kairos_links ────────────────────────────────────────────────────────
-- El usuario gestiona su propio enlace; el endpoint /api/kairos/inbox usa
-- service_role para resolver focus_code → user_id.

DROP POLICY IF EXISTS "Users manage own kairos link"  ON public.kairos_links;
DROP POLICY IF EXISTS "kairos_links_owner_all"        ON public.kairos_links;
CREATE POLICY "kairos_links_owner_all"
  ON public.kairos_links
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 18. device_pairings (deprecated, sin policies) ──────────────────────────
-- Tabla creada para vinculación entre dispositivos vía código corto. El flujo
-- fue removido del producto (ver commit e3fceb7). RLS permanece habilitado y
-- sin policies para que ningún role distinto a service_role pueda leer/escribir.
-- Si el flujo se restaura, los endpoints siguen usando service_role; no se
-- agrega policy aquí para no exponer la tabla a anon/authenticated por error.

-- ── 19. user_profiles INSERT explícito ──────────────────────────────────────
-- El trigger on_auth_user_created (si existe) inserta con service_role el
-- profile inicial. Si la app inserta su propio profile al registrarse, el
-- INSERT pasa porque WITH CHECK se aplica con auth.uid() = id.
--
-- Nota documental: si la cuenta se crea recién y aún no hay sesión pasada al
-- cliente cuando intenta upsertar el profile, el cliente debe esperar al
-- evento SIGNED_IN antes de escribir — auth.uid() solo retorna el UUID con
-- sesión activa.
