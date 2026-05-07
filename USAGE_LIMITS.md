# Sistema de límites de uso — Focus

Documentación del sistema de planes y cuotas para Nova / IA.
Implementado el 2026-05-07. Owner: Martín.

---

## Objetivo

Controlar el uso gratuito de Nova y acciones inteligentes para que un único
usuario no consuma todo el presupuesto de Anthropic — sin implementar pagos
todavía. Pensado para sostener una cohort de Early Access de 60-90 días.

Las acciones **manuales** (crear tarea, evento, notificación local) son
ilimitadas porque no consumen tokens. Solo limitamos lo que cuesta plata
(Nova, vision, futuras planificaciones IA).

---

## Planes disponibles

| Plan            | Estado actual | Descripción                                 |
| --------------- | ------------- | ------------------------------------------- |
| `free`          | ✅ activo     | Default para todo usuario nuevo             |
| `early_access`  | ✅ activo     | Cohort beta — manual, ~3× free, 60-90 días  |
| `plus`          | 🚧 reservado  | Sin pagos todavía                           |
| `pro`           | 🚧 reservado  | Sin pagos todavía                           |
| `admin`         | ✅ activo     | Pruebas internas, techo muy alto            |

`plus` y `pro` están definidos en código pero no se asignan automáticamente
a nadie. Cuando se conecten pagos, Stripe webhooks llamarán a la misma tabla
`user_plans`.

---

## Límites por plan

### `free`

| Acción              | Límite       | action_type           |
| ------------------- | ------------ | --------------------- |
| Mensaje a Nova      | **20 / día** | `nova_message`        |
| Acción inteligente  | **10 / día** | `nova_smart_action`   |
| Organizar Mi Día    | 3 / día      | `organize_day` (1)    |
| Planificación semanal | 1 / semana | `weekly_planning` (1) |
| Voz / dictado IA    | 10 / día     | `voice_ai` (1)        |
| Análisis de foto    | **5 / día**  | `photo_analysis`      |

### `early_access`

| Acción              | Límite       |
| ------------------- | ------------ |
| Mensaje a Nova      | 60 / día     |
| Acción inteligente  | 30 / día     |
| Organizar Mi Día    | 10 / día     |
| Planificación semanal | 3 / semana |
| Voz / dictado IA    | 30 / día     |
| Análisis de foto    | 15 / día     |

### `admin`

Techo muy alto (~100k/día) para pruebas internas sin gastar la cuota real.
Sigue habiendo enforcement: si un bug en cliente envía 100k requests en
loop, igual cortamos.

(1) `organize_day`, `weekly_planning`, `voice_ai` ya tienen los limites
definidos pero **no hay endpoint todavía**. Quedan listos para cuando se
implemente la feature.

---

## Acciones que NO cuentan (ilimitadas)

- Crear/editar/eliminar tareas manualmente
- Crear/editar/eliminar eventos manualmente
- Notificaciones locales (cron-notifications, push del backend)
- Lectura de calendario, exportar ICS
- Memoria persistente (`user_memories`) — operaciones CRUD
- Voz por Web Speech API (browser nativo, no cobra a backend)
- Modo demo offline

---

## Arquitectura

```
┌─────────────┐  Bearer ┌──────────────────┐
│  Frontend   │ ──────► │ /api/focus-       │
│  Nova UI    │         │  assistant.js     │
└─────────────┘         └────────┬─────────┘
                                 │
                                 ▼
                  ┌──────────────────────────┐
                  │ getUserPlan(userId)      │  → user_plans
                  │ checkLimit(plan, action) │  → ai_usage (lectura)
                  │ Anthropic call           │
                  │ recordUsage(action)      │  → ai_usage (upsert)
                  └──────────────────────────┘
```

### Tablas Supabase

- **`public.user_plans`** — plan comercial del usuario.
  - Sin fila → `free` implícito.
  - RLS: SELECT al owner. INSERT/UPDATE/DELETE solo service_role.
  - Migración: [supabase/migrations/015_user_plans.sql](supabase/migrations/015_user_plans.sql)

- **`public.ai_usage`** — contador (user_id, day, endpoint=action_type, count).
  - Reutilizada de la migración 010. Cambia el valor de `endpoint` para usar
    los nuevos `action_type` (`nova_message` en lugar de `focus-assistant`).
  - RLS: SELECT al owner. INSERT/UPDATE solo service_role.

### Código

- **[api/_lib/usageLimits.js](api/_lib/usageLimits.js)** — config + helpers:
  - `PLANS`, `ACTION_TYPES`, `LIMITS`, `MESSAGES`
  - `getUserPlan(admin, userId)` → string del plan
  - `checkLimit(admin, userId, plan, actionType)` → no escribe
  - `recordUsage(admin, userId, actionType)` → upsert +1
  - `enforceLimit(admin, userId, plan, actionType)` → check + record
  - `getUsageSnapshot(admin, userId, plan)` → para UI / debug

---

## Endpoints protegidos

| Endpoint                  | action_types                                    |
| ------------------------- | ----------------------------------------------- |
| `/api/focus-assistant`    | `nova_message` + `nova_smart_action` (si actions) |
| `/api/analyze-photo`      | `photo_analysis`                                |

### Cómo se cuenta `nova_smart_action`

`/api/focus-assistant` siempre cuenta `nova_message`. Si el modelo devuelve
acciones reales (excluyendo `remember`, que es transparente), también cuenta
`nova_smart_action`.

Si el usuario llegó al límite de `nova_smart_action` pero NO al de
`nova_message`: Nova sigue conversando pero las acciones se strippean del
response y se le avisa amablemente. No bloquea el chat.

---

## Asignación manual de planes

### Ver el plan de un usuario

```sql
SELECT plan, expires_at, granted_by, notes
FROM public.user_plans
WHERE user_id = '<uuid>';
```

Sin fila → es `free` implícito.

### Asignar Early Access (90 días)

```sql
INSERT INTO public.user_plans (user_id, plan, granted_by, expires_at, notes)
VALUES ('<uuid>', 'early_access', 'manual', NOW() + INTERVAL '90 days', 'beta cohort 1')
ON CONFLICT (user_id) DO UPDATE
  SET plan       = EXCLUDED.plan,
      expires_at = EXCLUDED.expires_at,
      granted_by = EXCLUDED.granted_by,
      notes      = EXCLUDED.notes,
      updated_at = NOW();
```

### Asignar Admin (sin vencimiento)

```sql
INSERT INTO public.user_plans (user_id, plan, granted_by)
VALUES ('<uuid>', 'admin', 'manual')
ON CONFLICT (user_id) DO UPDATE
  SET plan = 'admin', expires_at = NULL, updated_at = NOW();
```

### Volver a Free

```sql
DELETE FROM public.user_plans WHERE user_id = '<uuid>';
-- o equivalente:
-- UPDATE public.user_plans SET plan='free', expires_at=NULL WHERE user_id='<uuid>';
```

### Buscar email → user_id

```sql
SELECT id, email FROM auth.users WHERE email = 'foo@bar.com';
```

---

## Revisar uso de un usuario

### Uso de hoy por acción

```sql
SELECT endpoint AS action_type, count
FROM public.ai_usage
WHERE user_id = '<uuid>'
  AND day = CURRENT_DATE
ORDER BY count DESC;
```

### Uso de los últimos 7 días (para weekly_planning)

```sql
SELECT endpoint AS action_type, SUM(count) AS uses_7d
FROM public.ai_usage
WHERE user_id = '<uuid>'
  AND day >= (CURRENT_DATE - INTERVAL '7 days')
GROUP BY endpoint
ORDER BY uses_7d DESC;
```

### Top usuarios por consumo de IA hoy

```sql
SELECT user_id, endpoint, count
FROM public.ai_usage
WHERE day = CURRENT_DATE
ORDER BY count DESC
LIMIT 20;
```

---

## Reset de cuotas

- **Diario:** UTC midnight. El `day` en `ai_usage` cambia → la fila vieja
  queda histórica, la nueva arranca en 0.
- **Semanal:** rolling 7 días (no calendario). Suma `count` de los últimos
  7 días en cada chequeo.
- **Mensual:** rolling 30 días. Idéntico al semanal pero con 30.

---

## Modificar límites en el futuro

1. Editar la constante `LIMITS` en [api/_lib/usageLimits.js](api/_lib/usageLimits.js).
2. Editar los textos en `MESSAGES` si cambia la copy.
3. Build + deploy.

Si en el futuro queremos editar sin deploy: migrar `LIMITS` a una tabla
`app_plan_limits (plan, action_type, period, limit)` con caché de 60s en
backend. La API de `getLimit()` ya está aislada para ese cambio.

---

## Mensajes al usuario

- **Plan free al límite:**
  > Llegaste al límite diario de Nova en el plan gratis. Puedes seguir
  > usando tareas, eventos y notificaciones manualmente. Tu límite se
  > reinicia mañana.

- **Smart actions bloqueadas (nova_message OK):** Nova responde con texto
  + nota:
  > _Llegaste al límite diario de acciones inteligentes de Nova. Puedes
  > seguir conversando, pero las acciones automáticas se reanudan mañana._

- **Plan early_access al límite:**
  > Llegaste al límite ampliado de Early Access por hoy. Tu acceso se
  > reinicia mañana.

- **Planificación semanal al límite (free):**
  > Ya usaste tu planificación semanal disponible en el plan gratis.
  > Puedes seguir organizando tu día o crear tareas manualmente.

Toda la copy vive en `MESSAGES` dentro de [api/_lib/usageLimits.js](api/_lib/usageLimits.js).

---

## Modo demo

El modo demo de la app NO usa la cuenta real:
- `Capacitor.isNativePlatform()` con sesión nula → usuario navega como guest.
- Endpoints `/api/focus-assistant` y `/api/analyze-photo` rechazan con 401
  cuando no hay Bearer válido (auth obligatoria desde la auditoría).
- Por lo tanto, demo NO consume cuota IA y NO se contabiliza. Quien quiera
  usar Nova de verdad debe iniciar sesión.

---

## Seguridad

- Plan del usuario vive **server-side** en `user_plans`. Sin policy de UPDATE
  → un usuario no se puede auto-promover.
- `getUserPlan()` se llama dentro del handler con el JWT verificado.
- El cliente puede LEER su plan (para que Ajustes muestre badge correcto)
  pero no escribirlo.
- Cuotas se calculan server-side con `service_role` (bypasea RLS).
- LocalStorage / sessionStorage NO se usa para enforcement — solo para UI.

---

## Tests

- **Unitarios:** [tests/usage-limits.test.js](tests/usage-limits.test.js) —
  17 tests con fake admin (sin tocar Supabase real).
- **Auth:** [tests/auth-required.test.js](tests/auth-required.test.js) —
  garantiza que sin Bearer no se llega al check.

```bash
node --test tests/usage-limits.test.js tests/auth-required.test.js
```

### Pruebas manuales recomendadas

1. **Free dentro del límite:** mandar 5 mensajes a Nova, verificar respuesta normal.
2. **Free al límite:** llegar a 20 mensajes, verificar 429 con copy plan-aware.
3. **Smart actions stripeadas:** llegar a 10 acciones, mandar mensaje 11 que pida
   crear evento → Nova responde con texto + nota, evento NO se crea.
4. **Early access:** asignar plan manualmente en SQL, verificar techo nuevo.
5. **Admin:** asignar admin, hacer 100 mensajes seguidos, verificar que pasan.
6. **Logout/login:** cerrar sesión y volver, verificar que el contador
   persiste por user_id (no se pierde al cerrar app).
7. **Modo demo:** sin sesión, intentar abrir Nova → 401 / "Inicia sesión".

---

## Pendiente para futuro

### Tracking de tokens / costos (Punto 3 del roadmap)

Ya existe la tabla `ai_usage_events` (migración 013) con columnas para
input_tokens, output_tokens, estimated_cost_usd. **No la estamos escribiendo
todavía.** Cuando lo hagamos:
- Cada call a Anthropic registra una fila ahí con tokens reales del response.
- Permite gráficos de costo por usuario, alertas de spike, billing real.
- No reemplaza `ai_usage` (rate limit), la complementa para tracking fino.

### Planes Plus / Pro / Stripe (Puntos 4-5 del roadmap)

- Conectar Stripe webhooks que escriban a `user_plans` con `granted_by='stripe'`.
- UI de Ajustes con badge de plan + botón "Mejorar".
- Pricing page (no implementada todavía).

### Mejoras posibles

- Mover `LIMITS` a tabla DB para edición en caliente.
- UI en Ajustes con barras de progreso "12/20 hoy" (función ya existe en
  `getUsageSnapshot`).
- Cron mensual para borrar filas viejas de `ai_usage` (>90 días).
- Notificación push cuando el usuario está cerca del límite (80%).
