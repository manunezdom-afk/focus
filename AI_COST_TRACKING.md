# AI cost tracking — Focus

Sistema de medición granular de tokens y costo por cada llamada a Anthropic.
Implementado el 2026-05-07. Owner: Martín.

---

## Qué mide el sistema

Cada vez que un endpoint de Focus llama a Anthropic, registramos una fila
en `ai_usage_events` con:
- usuario que originó la llamada
- action_type del flujo (nova_message, photo_analysis, etc.)
- endpoint que sirvió la request
- modelo usado (Haiku 4.5, Sonnet 4.6, etc.)
- input_tokens + output_tokens reales que cobró Anthropic
- estimated_cost_usd calculado contra la tabla de precios local
- metadata neutral (plan, success, duration_ms, error_type, cache tokens)

Esto permite responder preguntas como:
- ¿Cuánto cuesta Focus por usuario / día / mes?
- ¿Qué modelo nos sale más caro y por qué?
- ¿Qué endpoints son los más activos?
- ¿Hay un usuario con costo desproporcionado?
- ¿Sonnet justifica su precio en planificación semanal vs Haiku?

---

## `ai_usage` vs `ai_usage_events`

| Aspecto | `ai_usage` | `ai_usage_events` |
| --- | --- | --- |
| Granularidad | 1 fila por (user, día, action) | 1 fila por LLAMADA real al modelo |
| Para qué sirve | Enforcement de cuotas (punto 2) | Costos / reportes (punto 3) |
| Datos clave | count | input_tokens, output_tokens, cost_usd |
| Reset | Al cambiar de día UTC | Histórico, no se resetea |
| RLS | SELECT al owner | SELECT al owner |
| Escritura | service_role (vía recordUsage) | service_role (vía trackAIUsageEvent) |

**Importante:** son tablas independientes. Una llamada a Nova hoy puede:
- incrementar `ai_usage` en 1 fila (counter+1 para hoy)
- insertar 1 o 2 filas en `ai_usage_events` (1 por cada call al modelo, ej.
  retry de JSON parse)

Esta diferencia es intencional: el contador de límites es barato y simple;
el log de eventos es la fuente de verdad para reportes.

---

## Modelos detectados

Definidos en [api/_lib/aiPricing.js](api/_lib/aiPricing.js).

| Modelo | Familia | Uso actual |
| --- | --- | --- |
| `claude-haiku-4-5` | Haiku 4.5 | **Activo** — focus-assistant + analyze-photo |
| `claude-haiku-3-5` | Haiku 3.5 | Legacy, por si rollback |
| `claude-sonnet-4-5` | Sonnet 4.5 | Reservado para escalación inteligente |
| `claude-sonnet-4-6` | Sonnet 4.6 | Reservado |
| `claude-opus-4-7` | Opus 4.7 | Improbable por costo |

El id que llega de Anthropic incluye sufijo de fecha
(`claude-haiku-4-5-20251001`); `normalizeModelName()` lo recorta para hacer
match contra la tabla de precios.

---

## Precios configurados

Última revisión manual: **2026-05-07**. Fuente: <https://www.anthropic.com/pricing>.

| Modelo | Input ($/M) | Output ($/M) |
| --- | --- | --- |
| Haiku 4.5 | $1.00 | $5.00 |
| Haiku 3.5 | $0.80 | $4.00 |
| Sonnet 4.5 | $3.00 | $15.00 |
| Sonnet 4.6 | $3.00 | $15.00 |
| Opus 4.7 | $15.00 | $75.00 |

**Fallback** (modelo desconocido): $3 / $15 (precio Sonnet, conservador).
Esto evita que un modelo nuevo y caro se registre con costo cero.

**Cuándo actualizar**: cuando Anthropic anuncie cambio, cuando se introduzca
un modelo nuevo en el código, o trimestralmente como recordatorio. Editar
[api/_lib/aiPricing.js](api/_lib/aiPricing.js) y bumpear la fecha de revisión.

---

## Cómo se calcula el costo

```
cost_usd = input_tokens  * pricing.input  / 1_000_000
         + output_tokens * pricing.output / 1_000_000
```

Redondeado a 6 decimales (la columna `estimated_cost_usd` es `NUMERIC(12,6)`).

Si Anthropic devuelve `cache_read_input_tokens` o `cache_creation_input_tokens`,
los guardamos en `metadata` pero **no los descontamos del input** todavía: el
SDK ya reporta `input_tokens` con el ajuste correcto cuando hay cache. Si en
el futuro vemos discrepancia, ajustar acá.

---

## Endpoints que registran costo

| Endpoint | Action types | Modelo |
| --- | --- | --- |
| `/api/focus-assistant` | `nova_message` (1 fila por call al modelo, hasta 2 si hay retry de parse) | Haiku 4.5 |
| `/api/analyze-photo`   | `photo_analysis` | Haiku 4.5 |

Cada llamada al modelo (incluida la del retry) se registra como evento
independiente, con `metadata.retry_attempt` ∈ {1, 2}.

Endpoints con tracking pendiente (no existen aún): `organize_day`,
`weekly_planning`, `voice_ai`. Cuando se implementen, deben pasar por
`trackAIUsageEvent()` con su `action_type` correspondiente.

---

## Action types

Definidos en [api/_lib/usageLimits.js](api/_lib/usageLimits.js):

- `nova_message` — turno de chat con Nova
- `nova_smart_action` — turno donde Nova devuelve acciones (no genera fila
  separada en `ai_usage_events`; comparte la del `nova_message`)
- `photo_analysis` — analyze-photo
- `organize_day`, `weekly_planning`, `voice_ai` — futuros

---

## Metadata guardada (whitelist)

Solo estas keys se aceptan; todo lo demás se descarta silenciosamente:

| Key | Tipo | Significado |
| --- | --- | --- |
| `endpoint` | string | nombre lógico del endpoint |
| `plan` | string | plan del usuario al momento del call |
| `success` | boolean | si el call al modelo fue OK |
| `error_type` | string ≤120 | nombre del error si success=false |
| `duration_ms` | number | latencia del call al modelo |
| `request_id` | string | id externo si se pasa |
| `usage_source` | string | `anthropic_usage` \| `estimated` \| `unavailable` |
| `pricing_source` | string | `configured` \| `fallback` \| `zero` |
| `pricing_model` | string | modelo normalizado |
| `cache_read_tokens` | number | tokens leídos de prompt cache |
| `cache_creation_tokens` | number | tokens escritos a prompt cache |
| `had_actions` | boolean | si la respuesta trajo actions[] |
| `limit_status` | string | `within` \| `near_cap` (futuro) |
| `retry_attempt` | number | 1 = primer intento, 2 = retry |

## Datos que NO se guardan

Por privacidad y minimalismo:
- prompts completos
- respuestas completas
- mensajes a Nova
- títulos de eventos / tareas / memorias
- emails u otros PII
- IPs (van a logs Vercel pero no a DB)
- tokens de auth, API keys
- datos del calendario

`sanitizeMetadata()` en [api/_lib/aiUsageTracking.js](api/_lib/aiUsageTracking.js)
implementa la whitelist y recorta strings a 120 chars como cinturón extra.

---

## Consultas SQL útiles

### Costo total del día

```sql
SELECT
  SUM(estimated_cost_usd)::numeric(12,4) AS cost_usd,
  COUNT(*) AS calls,
  SUM(total_tokens) AS tokens
FROM public.ai_usage_events
WHERE created_at >= CURRENT_DATE;
```

### Costo total por usuario (últimos 30 días)

```sql
SELECT
  u.email,
  SUM(e.estimated_cost_usd)::numeric(12,4) AS cost_usd,
  COUNT(*) AS calls
FROM public.ai_usage_events e
JOIN auth.users u ON u.id = e.user_id
WHERE e.created_at >= now() - interval '30 days'
GROUP BY u.email
ORDER BY cost_usd DESC
LIMIT 50;
```

### Costo por modelo (últimos 30 días)

```sql
SELECT
  model_used,
  SUM(estimated_cost_usd)::numeric(12,4) AS cost_usd,
  SUM(input_tokens)  AS in_tokens,
  SUM(output_tokens) AS out_tokens,
  COUNT(*) AS calls
FROM public.ai_usage_events
WHERE created_at >= now() - interval '30 days'
GROUP BY model_used
ORDER BY cost_usd DESC;
```

### Costo por action_type (hoy)

```sql
SELECT
  action_type,
  SUM(estimated_cost_usd)::numeric(12,4) AS cost_usd,
  AVG(total_tokens)::int AS avg_tokens,
  COUNT(*) AS calls
FROM public.ai_usage_events
WHERE created_at >= CURRENT_DATE
GROUP BY action_type
ORDER BY cost_usd DESC;
```

### Top usuarios por gasto del mes

```sql
SELECT
  u.email,
  SUM(e.estimated_cost_usd)::numeric(12,4) AS cost_usd,
  COUNT(*) AS calls,
  COALESCE(p.plan, 'free') AS plan
FROM public.ai_usage_events e
JOIN auth.users u ON u.id = e.user_id
LEFT JOIN public.user_plans p ON p.user_id = e.user_id
WHERE e.created_at >= date_trunc('month', now())
GROUP BY u.email, p.plan
ORDER BY cost_usd DESC
LIMIT 20;
```

### Top endpoints por gasto

```sql
SELECT
  metadata->>'endpoint' AS endpoint,
  SUM(estimated_cost_usd)::numeric(12,4) AS cost_usd,
  COUNT(*) AS calls
FROM public.ai_usage_events
WHERE created_at >= now() - interval '30 days'
GROUP BY metadata->>'endpoint'
ORDER BY cost_usd DESC;
```

### Uso de Sonnet vs Haiku

```sql
SELECT
  CASE
    WHEN model_used LIKE 'claude-haiku%'  THEN 'haiku'
    WHEN model_used LIKE 'claude-sonnet%' THEN 'sonnet'
    WHEN model_used LIKE 'claude-opus%'   THEN 'opus'
    ELSE 'other'
  END AS family,
  COUNT(*) AS calls,
  SUM(estimated_cost_usd)::numeric(12,4) AS cost_usd
FROM public.ai_usage_events
WHERE created_at >= now() - interval '30 days'
GROUP BY family
ORDER BY cost_usd DESC;
```

### Promedio de costo por mensaje de Nova

```sql
SELECT
  AVG(estimated_cost_usd)::numeric(12,6) AS avg_cost_per_call,
  AVG(input_tokens)::int  AS avg_input_tokens,
  AVG(output_tokens)::int AS avg_output_tokens
FROM public.ai_usage_events
WHERE action_type = 'nova_message'
  AND created_at >= now() - interval '7 days'
  AND (metadata->>'success')::boolean IS NOT FALSE;
```

### Costo mensual estimado (extrapolado del mes en curso)

```sql
WITH ranged AS (
  SELECT
    SUM(estimated_cost_usd) AS so_far,
    EXTRACT(DAY FROM date_trunc('day', now()))::int AS days_so_far,
    EXTRACT(DAY FROM (date_trunc('month', now()) + interval '1 month - 1 day'))::int AS days_in_month
  FROM public.ai_usage_events
  WHERE created_at >= date_trunc('month', now())
)
SELECT
  so_far::numeric(12,4) AS cost_so_far_month,
  ((so_far / days_so_far) * days_in_month)::numeric(12,4) AS projected_month
FROM ranged;
```

### Tasa de éxito por endpoint (últimos 7 días)

```sql
SELECT
  metadata->>'endpoint' AS endpoint,
  COUNT(*) FILTER (WHERE (metadata->>'success')::boolean = true)  AS ok,
  COUNT(*) FILTER (WHERE (metadata->>'success')::boolean = false) AS fail,
  ROUND(100.0 * COUNT(*) FILTER (WHERE (metadata->>'success')::boolean = false) / COUNT(*), 2) AS fail_pct
FROM public.ai_usage_events
WHERE created_at >= now() - interval '7 days'
GROUP BY metadata->>'endpoint';
```

### Costo de un usuario específico

```sql
SELECT
  date_trunc('day', created_at)::date AS day,
  SUM(estimated_cost_usd)::numeric(12,4) AS cost_usd,
  COUNT(*) AS calls
FROM public.ai_usage_events
WHERE user_id = '<uuid>'
  AND created_at >= now() - interval '30 days'
GROUP BY day
ORDER BY day DESC;
```

---

## Estrategia de modelos: quality-first con control de costos

Esta es la regla a aplicar en el routing futuro (no implementado todavía):

1. **Haiku por defecto** para acciones simples y rutinarias:
   - chat conversacional típico con Nova
   - extracción de eventos de fotos
   - acciones de calendario directas

2. **Sonnet para acciones complejas, ambiguas o delicadas**:
   - planificación semanal o reorganización profunda
   - cambios delicados al calendario (mover varias cosas, conflictos)
   - razonamiento con mucho contexto (historial largo + memorias + behavior)
   - cuando una acción puede afectar la confianza del usuario en Nova

3. **Escalación condicional** cuando se implemente:
   - primer intento con Haiku
   - validación de calidad (confianza del modelo, completitud del JSON,
     coherencia con el contexto)
   - segundo intento con Sonnet si el resultado es ambiguo, inseguro o
     insuficiente
   - registrar ambos calls en `ai_usage_events` con metadata distintiva

4. **Métricas que decidirán esto**:
   - costo / mensaje por modelo
   - tasa de retry por familia
   - tasa de "user pidió lo mismo de nuevo" (proxy de mala respuesta)

Hoy todo va a Haiku 4.5 — el tracking que acabamos de instalar nos dará
datos para tomar la decisión con información real.

---

## Caps internos por costo (futuro)

**Por implementar cuando tengamos datos**:
- Cap diario por usuario por plan (ej. free=$0.10/día)
- Cap mensual por usuario por plan (ej. free=$2/mes)
- Cap global de la app (kill-switch en `$X/día`)
- Notificación push al usuario cuando llegue al 80% del cap

Hoy NO bloqueamos por costo — solo medimos. Los límites del punto 2
(cuotas por número de calls) ya bastan para contener un usuario en loop.

Cuando se implemente, el chequeo iría al lado de `checkLimit()` en cada
endpoint, sumando `estimated_cost_usd` de las últimas 24h o del mes y
comparando contra el cap del plan.

---

## Seguridad y privacidad

- `ai_usage_events` tiene RLS activo. Solo SELECT por owner
  (`auth.uid() = user_id`). Sin policies INSERT/UPDATE/DELETE → solo
  service_role escribe.
- El cliente **no** puede falsificar tokens, model_used o costo. La
  inserción ocurre 100% en backend con `service_role_key`.
- `ANTHROPIC_API_KEY` solo está en env vars del backend (Vercel),
  nunca con prefijo `VITE_`.
- Los prompts y respuestas del modelo NO se guardan.
- La metadata pasa por `sanitizeMetadata()` que aplica una whitelist de
  keys permitidas y recorta strings a 120 chars.

---

## Pendientes para futuro

1. **Routing inteligente Haiku ↔ Sonnet** con fallback al detectar baja
   confianza o JSON inválido en primer intento.
2. **Caps de gasto por plan** (ver sección anterior).
3. **Dashboard de admin** con cards: cost today, cost this month, top users,
   top endpoints, model split. Probablemente como página interna en
   `/admin/costs` con guard de plan='admin'.
4. **Alertas de spike** — push o email a Martín si en una hora el gasto
   supera N veces el promedio.
5. **Limpieza histórica** — cron mensual que borre filas de
   `ai_usage_events` con >180 días para evitar crecimiento sin límite.
6. **Cache de prompt** — si Anthropic ofrece descuento por
   `cache_creation_input_tokens` y `cache_read_input_tokens`, considerar
   ajustar el cálculo para reflejarlo (ahora se trata el input como uniforme).

---

## Cómo se conecta con `USAGE_LIMITS.md`

- Los **límites** del punto 2 cuentan llamadas (counts), no costo.
- Los **costos** del punto 3 cuentan tokens y dólares por llamada.
- Cuando el límite bloquea una request → NO se llama al modelo → NO se
  inserta evento en `ai_usage_events`.
- Cuando el modelo falla (timeout, 5xx upstream) → se inserta evento con
  `success=false` y tokens en 0/0 (porque Anthropic no los reportó), para
  poder distinguir "modelo cayó" de "no hubo intento".
