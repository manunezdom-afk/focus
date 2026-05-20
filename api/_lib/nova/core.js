// Nova Core — orquestador del flujo OpenAI con routing + validación + fallback.
//
// Entry point único para todo el ecosistema Focus OS. Hoy solo Focus está
// implementado. Kairos y Spark devuelven 501 si se piden por ahora — sus
// adapters viven en `adapters/{kairos,spark}.js` como stubs intencionales.
//
// Flujo:
//   1. router.decideRoute(message) → 'local' | 'cheap' | 'strong'
//   2a. local → tryLocalParse (sin LLM) → contrato Nova Core directo
//   2b. cheap/strong → llama OpenAI con el adapter del app
//   3. expandToSemanticActions → validateSemanticActions
//   4. Si validator falla y FALLBACK_TO_STRONG=true → reintenta con strong
//   5. collapseSemanticToBackendActions → respuesta para iOS
//   6. Logging estructurado (sin secretos)
//
// El consumidor (focus-assistant.js rama OpenAI) recibe el resultado y
// lo devuelve al cliente iOS sin modificaciones adicionales.

import { decideRoute } from './router.js'
import { normalizeCorrections } from './intentNormalizer.js'
import { callOpenAI, extractResponsesText, resolveModelName } from './openaiClient.js'
import {
  validateSemanticActions,
  shouldRetryWithStrong,
  resolveCorrectionConflicts,
  inputHasCorrection,
} from './validator.js'
import {
  NOVA_OPENAI_SCHEMA as FOCUS_SCHEMA,
  buildOpenAISystemPrompt as buildFocusPrompt,
  expandToSemanticActions as focusExpand,
  collapseSemanticToBackendActions as focusCollapse,
} from './adapters/focus.js'

const SUPPORTED_APPS = new Set(['focus'])

/**
 * Logging estructurado por request. NO incluye API key ni contenido
 * sensible. Imprime una línea JSON por evento (Vercel + Datadog
 * indexan esto naturalmente).
 */
function logEvent(payload) {
  try {
    // eslint-disable-next-line no-console
    console.log(`[nova-core] ${JSON.stringify(payload)}`)
  } catch {
    // Si el payload tiene cycles raros, ignoramos — no es bloqueante.
  }
}

/**
 * Llama OpenAI con el modelo pedido, parsea JSON, expande a semantic.
 * Devuelve `{ semantic, raw, modelUsed }` o tira.
 */
async function runOpenAITier({
  tier,
  systemPrompt,
  schema,
  message,
  apiKey,
  reqId,
  expand,
}) {
  const model = resolveModelName(tier)
  const data = await callOpenAI({
    message,
    systemPrompt,
    model,
    schema,
    apiKey,
    reqId,
  })
  const text = extractResponsesText(data)
  let raw
  try {
    raw = JSON.parse(text)
  } catch (e) {
    const err = new Error(`OpenAI devolvió JSON inválido: ${e.message}`)
    err.status = 502
    err.bodyText = text.slice(0, 200)
    throw err
  }
  const semantic = expand(Array.isArray(raw.actions) ? raw.actions : [])
  return { semantic, raw, modelUsed: model }
}

/**
 * Pequeña abstracción del flow por-app. Hoy solo focus.
 */
function adapterFor(app) {
  if (app === 'focus') {
    return {
      schema: FOCUS_SCHEMA,
      buildPrompt: buildFocusPrompt,
      expand: focusExpand,
      collapse: focusCollapse,
    }
  }
  const err = new Error(`Nova Core: app "${app}" no soportada (solo focus por ahora)`)
  err.status = 501
  err.code = 'app_not_supported'
  throw err
}

/**
 * runNova — entry point principal.
 *
 * @param {object} args
 * @param {'focus'|'kairos'|'spark'} args.app    Hoy solo 'focus'.
 * @param {string} args.message                  Mensaje del usuario.
 * @param {object} args.dateContext              `{ tz, todayISO, tomorrow, currentTime24, weekDates }`
 * @param {string} args.reqId                    Request id para tracing.
 * @param {string} args.apiKey                   OPENAI_API_KEY (se inyecta, no se lee del env acá).
 * @param {boolean} [args.routingEnabled=true]   Si false, manda todo a strong (legacy).
 * @param {boolean} [args.fallbackToStrong=true] Si validator falla, reintenta con strong.
 *
 * @returns Promise<{
 *   reply: string,
 *   actions: BackendAction[],
 *   confidence: number,
 *   shouldAskUser: boolean,
 *   mode: 'chat_only'|'chat_with_action'|'clarification',
 *   requestId: string,
 *   _dropped: string[],
 *   // Metadata Nova Core (para logs y debugging — el cliente iOS ignora):
 *   _nova: {
 *     app: string,
 *     modelUsed: string|null,
 *     routingReason: string,
 *     fallbackUsed: boolean,
 *     validatorErrors: string[],
 *     intent: string,
 *   },
 * }>
 */
export async function runNova({
  app,
  message,
  dateContext,
  reqId,
  apiKey,
  routingEnabled = true,
  fallbackToStrong = true,
}) {
  if (!SUPPORTED_APPS.has(app)) {
    const err = new Error(`Nova Core: app "${app}" no soportada (solo focus por ahora)`)
    err.status = 501
    err.code = 'app_not_supported'
    throw err
  }
  if (typeof message !== 'string' || message.trim().length === 0) {
    const err = new Error('Nova Core: mensaje vacío')
    err.status = 400
    throw err
  }
  if (!dateContext || !dateContext.todayISO) {
    const err = new Error('Nova Core: dateContext requerido (tz, todayISO, tomorrow, ...)')
    err.status = 400
    throw err
  }

  const { schema, buildPrompt, expand, collapse } = adapterFor(app)
  const systemPrompt = buildPrompt(dateContext)

  // ─── 0. Human Intent Normalization (pre-LLM) ────────────────────────────
  // Si el usuario se corrigió en el mismo mensaje ("a las 4, no no mejor
  // a las 5"), reescribe el input para que el LLM solo vea la versión
  // final. Es defensa heurística: cubre los casos canónicos del QA del
  // usuario donde los modelos chico/grande ignoraban la regla 11 del
  // prompt. Si nada matchea, devuelve el input intacto.
  const normalization = normalizeCorrections(message, {
    currentTime24: dateContext.currentTime24,
  })
  if (normalization.applied.length > 0) {
    logEvent({
      reqId, app,
      intentNormalized: true,
      rulesApplied: normalization.applied,
      before: message,
      after: normalization.normalized,
    })
  }
  const effectiveMessage = normalization.normalized

  // ─── 1. Routing ─────────────────────────────────────────────────────────
  const routing = routingEnabled
    ? decideRoute({ message: effectiveMessage })
    : { route: 'strong', reason: 'routing-disabled', localResult: null }

  // ─── 2a. Local parser path ─────────────────────────────────────────────
  if (routing.route === 'local') {
    const local = routing.localResult
    const novaMeta = {
      app,
      modelUsed: null,
      routingReason: routing.reason,
      fallbackUsed: false,
      validatorErrors: [],
      intent: local.intent,
    }
    logEvent({ reqId, ...novaMeta, actionsCount: local.actions.length })

    // El cliente iOS solo entiende `actions: BackendAction[]` (add_event,
    // toggle_task, etc.). review_today/chat_only NO se materializan como
    // acciones para iOS — el usuario los ve como reply de chat. iOS ya
    // tiene Mi Día renderizada y no necesita un evento adicional.
    return {
      reply: local.userConfirmationText,
      actions: [],
      proposed_actions: [],
      smart_actions_blocked: false,
      smart_actions_message: null,
      confidence: 0.95,
      shouldAskUser: false,
      mode: 'chat_only',
      requestId: reqId || null,
      _dropped: [],
      _nova: novaMeta,
    }
  }

  // ─── 2b. OpenAI path: cheap (o strong directo) ──────────────────────────
  let firstTier = routing.route === 'strong' ? 'strong' : 'cheap'
  let modelUsed = null
  let routingReason = routing.reason
  let fallbackUsed = false
  let validatorErrors = []
  let semantic = null
  let raw = null

  try {
    const result = await runOpenAITier({
      tier: firstTier,
      systemPrompt, schema, message: effectiveMessage, apiKey, reqId,
      expand,
    })
    semantic = result.semantic
    raw = result.raw
    modelUsed = result.modelUsed
  } catch (firstErr) {
    // Si fue 404 (modelo inexistente) y el tier fue cheap → cae a strong.
    // Cualquier otro error y el tier fue strong → propagamos.
    if (firstTier === 'cheap' && (firstErr.status === 404 || firstErr.status === 400)) {
      logEvent({
        reqId, app, modelUsed: resolveModelName('cheap'), routingReason,
        fallbackUsed: true, errorBeforeFallback: firstErr.message,
      })
      const result = await runOpenAITier({
        tier: 'strong',
        systemPrompt, schema, message: effectiveMessage, apiKey, reqId,
        expand,
      })
      semantic = result.semantic
      raw = result.raw
      modelUsed = result.modelUsed
      fallbackUsed = true
      routingReason = `${routing.reason}+fallback:cheap-${firstErr.status}`
    } else {
      throw firstErr
    }
  }

  // Nota: el bump AM/PM mecánico post-LLM se removió 2026-05-20. Ahora
  // el intentNormalizer pre-LLM reescribe "a las N" → "a las (N+12):00"
  // de forma determinística antes de mandar al modelo, eliminando la
  // ambigüedad en origen. El sumar 12 sobre una hora equivocada del LLM
  // (ej. el LLM emite 09:00 → bump producía 21:00 incorrecto) era el bug
  // del caso 2 fresh QA. La regla pm-heuristic en intentNormalizer.js
  // captura el patrón correcto y el LLM recibe "a las 19:00" sin duda.

  // ─── 3a. Resolver correcciones humanas (defensa en profundidad) ────────
  // Si el input tiene "no, mejor", "espera", "perdón", etc. y el LLM emitió
  // duplicados con la misma cosa pero distintas horas/fechas, nos quedamos
  // con la última (post-corrección). Sucede más comúnmente con cheap; el
  // prompt actualizado (regla 11) reduce esto pero la defensa queda.
  const correctionResolution = resolveCorrectionConflicts(semantic, { userMessage: effectiveMessage })
  if (correctionResolution.conflicts > 0) {
    semantic = correctionResolution.resolved
    logEvent({
      reqId, app, modelUsed,
      correctionsRemoved: correctionResolution.removed,
      conflictsResolved: correctionResolution.conflicts,
    })
  }

  // ─── 3b. Validator + posible fallback semántico ──────────────────────────
  const validation = validateSemanticActions(semantic, {
    userMessage: effectiveMessage,
    todayISO: dateContext.todayISO,
    tomorrowISO: dateContext.tomorrow,
  })
  validatorErrors = validation.errors

  if (
    !validation.valid &&
    fallbackToStrong &&
    !fallbackUsed && // no double-fallback
    firstTier === 'cheap' &&
    shouldRetryWithStrong(validation.errors)
  ) {
    logEvent({
      reqId, app, modelUsed,
      routingReason, validatorErrors,
      retryingWith: 'strong',
    })
    try {
      const result = await runOpenAITier({
        tier: 'strong',
        systemPrompt, schema, message: effectiveMessage, apiKey, reqId,
        expand,
      })
      semantic = result.semantic
      raw = result.raw
      modelUsed = result.modelUsed
      fallbackUsed = true
      routingReason = `${routing.reason}+fallback:validator`
      // Re-resolver correcciones después del retry strong.
      const reResolution = resolveCorrectionConflicts(semantic, { userMessage: effectiveMessage })
      if (reResolution.conflicts > 0) {
        semantic = reResolution.resolved
      }
      const reValidation = validateSemanticActions(semantic, {
        userMessage: message,
        todayISO: dateContext.todayISO,
        tomorrowISO: dateContext.tomorrow,
      })
      validatorErrors = reValidation.errors
    } catch (retryErr) {
      // Si strong también falla, seguimos con el cheap result + lo loggeamos.
      logEvent({ reqId, app, modelUsed, retryError: retryErr.message })
    }
  }

  // ─── 4. Collapse a shape iOS ─────────────────────────────────────────────
  const { safeActions, droppedReasons, clarifications } = collapse(semantic, {
    reqId,
    inputMessage: effectiveMessage,
  })

  // Confidence numérica promedio.
  const CONFIDENCE_NUMERIC = { high: 0.9, medium: 0.65, low: 0.35 }
  let confNum = 1.0
  if (safeActions.length > 0) {
    const considered = semantic.filter(a =>
      a.type === 'create_event' || a.type === 'create_reminder',
    )
    if (considered.length > 0) {
      const total = considered.reduce((acc, a) => acc + (CONFIDENCE_NUMERIC[a.confidence] || 0.5), 0)
      confNum = total / considered.length
    }
  }

  const needsClarification = Boolean(raw?.needsClarification) || clarifications.length > 0
  const baseReply = typeof raw?.userConfirmationText === 'string' ? raw.userConfirmationText : ''
  let reply = baseReply
  if (needsClarification && clarifications.length > 0) {
    const q = (raw?.clarificationQuestion && raw.clarificationQuestion) || clarifications[0]
    reply = reply ? `${reply}\n\n${q}` : q
  }
  if (droppedReasons.length > 0 && safeActions.length === 0 && !needsClarification) {
    reply = reply || 'No pude armar la acción con seguridad. ¿Me das un poco más de detalle?'
  }

  const mode = (() => {
    if (safeActions.length === 0 && needsClarification) return 'clarification'
    if (safeActions.length === 0) return 'chat_only'
    return 'chat_with_action'
  })()

  const intent = (() => {
    if (semantic.some(a => a.type === 'create_event')) return 'create_events'
    if (semantic.some(a => a.type === 'create_reminder')) return 'create_reminder'
    if (needsClarification) return 'clarify'
    return 'chat'
  })()

  const novaMeta = {
    app,
    modelUsed,
    routingReason,
    fallbackUsed,
    validatorErrors,
    intent,
  }

  logEvent({ reqId, ...novaMeta, actionsCount: safeActions.length, droppedCount: droppedReasons.length })

  return {
    reply: reply || 'Listo.',
    actions: safeActions,
    proposed_actions: [],
    smart_actions_blocked: false,
    smart_actions_message: null,
    confidence: confNum,
    shouldAskUser: needsClarification && safeActions.length === 0,
    mode,
    requestId: reqId || null,
    _dropped: droppedReasons,
    _nova: novaMeta,
  }
}
