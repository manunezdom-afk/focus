const WEEKDAY_ALIASES = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miércoles',
  miércoles: 'miércoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sábado',
  sábado: 'sábado',
  domingo: 'domingo',
}

const STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'de', 'del', 'a', 'al', 'para',
  'por', 'con', 'mi', 'mis', 'tu', 'tus', 'que', 'tengo', 'reunion', 'reunión',
])

const REMINDER_RE = /\b(recu[eé]rdame|recordarme|recordatorio|acu[eé]rdate|acu[eé]rdame|av[ií]same|no se me puede olvidar|que no se me olvide)\b/i
const LINKED_RE = /\b(agrega(?:r)? abajo|pon(?:er)? debajo|debajo de|abajo de|para (?:la|el|mi|tu)?\s*.+\s+(?:recu[eé]rdame|acu[eé]rdame|agrega|pon)|en ese evento)\b/i
const TASK_ACTION_TYPES = new Set(['task', 'add_task', 'toggle_task', 'mark_task_done', 'delete_task'])

function stripDiacritics(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

export function normalizeText(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compact(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function sentenceCase(value) {
  const s = compact(value)
  if (!s) return ''
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function cleanNovaTitle(input) {
  let s = compact(input)
  if (!s) return ''

  s = s.replace(/^\[[^\]]+\]\s*/g, '')
  s = s.replace(/^["'“”]+|["'“”]+$/g, '')
  s = s.replace(/\b(hoy|mañana|manana|pasado mañana|pasado manana)\b/gi, ' ')
  s = s.replace(/\b(?:el\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, ' ')
  s = s.replace(/\b(?:tipo|como a eso de|alrededor de|cerca de)\s+(?:las\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\b/gi, ' ')
  s = s.replace(/\b(?:a\s+las|las)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?\b/gi, ' ')
  s = s.replace(/\b(?:en|por)\s+la\s+(?:mañana|manana|tarde|noche)\b/gi, ' ')
  s = s.replace(/\bdespu[eé]s\b|\bluego\b|\bantes\b/gi, ' ')
  s = s.replace(/\s+/g, ' ').trim()

  const leadPatterns = [
    /^(?:por favor\s+)?(?:recu[eé]rdame|recordarme|acu[eé]rdate|acu[eé]rdame|av[ií]same)(?:\s+de|\s+que|\s+para)?\s+/i,
    /^(?:que\s+)?no\s+se\s+me\s+(?:puede\s+)?olvide(?:\s+de|\s+que)?\s+/i,
    /^recordatorio\s*:\s*/i,
    /^(?:ag[eé]ndame|agenda|agregar?|agr[eé]game|pon(?:me)?|crea(?:me)?)(?:\s+un[ao]?|\s+en\s+(?:mi\s+)?calendario|\s+en\s+(?:mi\s+)?agenda)?(?:\s+de|\s+para)?\s+/i,
    /^(?:tengo\s+que|hay\s+que|debo|necesito)\s+/i,
    /^tengo\s+/i,
  ]
  for (const re of leadPatterns) s = s.replace(re, '')

  s = s.replace(/\s*,\s*/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/\bbuscar\s+a\s+la\s+/i, 'buscar a ')
  s = s.replace(/\bllamar\s+a\s+la\s+/i, 'llamar a ')
  s = s.replace(/\bmandar\s+a\s+la\s+/i, 'mandar a ')
  s = s.replace(/[.?!,;:]+$/g, '').trim()

  return sentenceCase(s)
}

function parseHourMinute(raw, preferPM = false) {
  // NO usamos normalizeText acá: strippea el ':' (lo trata como puntuación),
  // y "10:30" quedaba como "10 30", lo que hacía que el regex capturara solo
  // "10" y devolviera "10:00" — perdiendo los minutos. Bug silencioso: todos
  // los eventos con minutos exactos (10:30, 14:45, 9:15) quedaban en la hora
  // redonda. Hacemos lowercasing simple y normalizamos a.m./a m → am sin
  // tocar los dos puntos.
  const value = String(raw ?? '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\ba m\b/g, 'am')
    .replace(/\bp m\b/g, 'pm')
    .trim()
  const match = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/)
  if (!match) return null

  let hour = parseInt(match[1], 10)
  const minute = match[2] ? parseInt(match[2], 10) : 0
  const meridiem = match[3]
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null

  if (meridiem === 'pm' && hour < 12) hour += 12
  if (meridiem === 'am' && hour === 12) hour = 0
  if (!meridiem && hour <= 7 && preferPM) hour += 12

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function normalizeTime24(raw, opts = {}) {
  if (raw == null || raw === '') return null
  const value = String(raw).trim()
  if (!value) return null
  if (/\bnoche\b/i.test(value)) return '20:00'
  if (/\btarde\b/i.test(value)) return '16:00'
  if (/\bmañana\b|\bmanana\b/i.test(value)) return '09:00'

  const preferPM =
    opts.preferPM === true ||
    /\b(tipo|alrededor|cerca|como a eso)\b/i.test(value) ||
    /\bpm|p\.m\./i.test(value)
  return parseHourMinute(value, preferPM)
}

function minutesToTime(total) {
  const mins = Math.max(0, Math.min(23 * 60 + 59, total))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function timeToMinutes(value) {
  const m = String(value ?? '').match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10)
}

function dateFromText(text, dateContext, fallback = null) {
  const n = normalizeText(text)
  if (/\bpasado manana\b/.test(n)) return dateContext.dayAfter
  if (/\bmanana\b/.test(n)) return dateContext.tomorrow
  if (/\bhoy\b/.test(n)) return dateContext.todayISO

  for (const [alias, canonical] of Object.entries(WEEKDAY_ALIASES)) {
    if (new RegExp(`\\b(?:el\\s+)?${alias}\\b`, 'i').test(n)) {
      return dateContext.weekDates?.[canonical] ?? fallback
    }
  }
  return fallback
}

function timeFromText(text) {
  const n = normalizeText(text)
  const typeMatch = n.match(/\btipo\s+(?:las\s+)?(\d{1,2})(?::(\d{2}))?/)
  if (typeMatch) return normalizeTime24(typeMatch[0], { preferPM: true })

  const explicit = text.match(/\b(?:a\s+las|las)\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?\b/)
  if (explicit) return normalizeTime24(explicit[0], { preferPM: true })

  const bareMeridiem = text.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)\b/)
  if (bareMeridiem) return normalizeTime24(bareMeridiem[0])

  if (/\bnoche\b/i.test(text)) return '20:00'
  if (/\btarde\b/i.test(text)) return '16:00'
  if (/\bmañana\b|\bmanana\b/i.test(text) && !/\bpasado\b/i.test(text)) return null
  return null
}

function extractDate(raw, dateContext, fallback) {
  return raw?.date ?? raw?.event?.date ?? raw?.task?.dueDate ?? dateFromText(raw?.title ?? '', dateContext, fallback)
}

function extractTitle(raw) {
  return raw?.title ?? raw?.event?.title ?? raw?.task?.label ?? raw?.payload?.title ?? raw?.payload?.event?.title ?? ''
}

function extractStart(raw, isReminder) {
  const val =
    raw?.start_time ?? raw?.startTime ?? raw?.reminder_time ?? raw?.reminderTime ??
    raw?.time ?? raw?.event?.start_time ?? raw?.event?.startTime ?? raw?.event?.time ??
    raw?.task?.dueTime ?? raw?.payload?.start_time ?? raw?.payload?.time ?? raw?.payload?.event?.time
  return normalizeTime24(val, { preferPM: isReminder })
}

function extractEnd(raw) {
  const val = raw?.end_time ?? raw?.endTime ?? raw?.event?.end_time ?? raw?.event?.endTime ?? raw?.payload?.end_time
  return normalizeTime24(val)
}

function confidenceOf(raw) {
  const v = raw?.confidence ?? raw?.event?.confidence ?? raw?.task?.confidence
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0.8
}

function titleLooksUnsafe(title, message) {
  if (!title || title.length < 2) return true
  if (title.length > 90) return true
  const nt = normalizeText(title)
  const nm = normalizeText(message)
  if (nt && nm && nt === nm) return true
  return /\b(recu[eé]rdame|acu[eé]rdate|mañana|manana|a las|tipo)\b/i.test(title)
}

function strongWords(value) {
  return normalizeText(value)
    .split(' ')
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

function scoreEventReference(event, message) {
  const msgWords = new Set(strongWords(message))
  if (msgWords.size === 0) return 0
  const eventWords = strongWords(event.title)
  let score = 0
  for (const w of eventWords) {
    if (msgWords.has(w)) score += 1
  }
  const nt = normalizeText(event.title)
  const nm = normalizeText(message)
  if (nt && nm.includes(nt)) score += 3
  return score
}

export function findReferencedEvent(message, events = []) {
  let best = null
  let bestScore = 0
  for (const event of events) {
    const score = scoreEventReference(event, message)
    if (score > bestScore) {
      best = event
      bestScore = score
    }
  }
  return bestScore > 0 ? best : null
}

function normalizeEventAction(raw, ctx, issues) {
  const rawTitle = extractTitle(raw)
  const title = cleanNovaTitle(rawTitle)
  const date = extractDate(raw, ctx.dateContext, ctx.dateContext.todayISO) ?? ctx.dateContext.todayISO
  const start = extractStart(raw, false)
  const end = extractEnd(raw)
  const confidence = confidenceOf(raw)

  if (confidence < 0.65) issues.add('low_confidence')
  if (titleLooksUnsafe(title, ctx.message)) issues.add('unsafe_title')

  if (!title || !date) {
    issues.add('incomplete_action')
    return null
  }

  return {
    type: 'event',
    title,
    date,
    start_time: start,
    end_time: end ?? null,
    icon: raw?.icon ?? raw?.event?.icon ?? 'event',
    confidence,
    reason: raw?.reason ?? raw?.debug ?? null,
  }
}

function normalizeReminderAction(raw, ctx, issues) {
  const rawTitle = extractTitle(raw)
  const title = cleanNovaTitle(rawTitle)
  const date = extractDate(raw, ctx.dateContext, ctx.dateContext.todayISO) ?? ctx.dateContext.todayISO
  // Si la IA emitió reminder_time explícito lo respetamos. Si no, queda null
  // y el recordatorio se guarda sin hora. NO escaneamos ctx.message porque eso
  // pescaba horas de OTROS intents (ej: usuario pide evento 10:30 + reminder
  // sin hora → el reminder terminaba con 10:30 prestado del evento).
  const reminderTime = extractStart(raw, true)
  const confidence = confidenceOf(raw)

  if (confidence < 0.65) issues.add('low_confidence')
  if (titleLooksUnsafe(title, ctx.message)) issues.add('unsafe_title')
  if (!title || !date) {
    issues.add('incomplete_action')
    return null
  }

  return {
    type: 'reminder',
    title,
    date,
    reminder_time: reminderTime,
    end_time: null,
    icon: 'alarm',
    confidence,
    reason: raw?.reason ?? raw?.debug ?? null,
  }
}

function normalizeLinkedReminderAction(raw, ctx, issues) {
  const title = cleanNovaTitle(extractTitle(raw))
  const targetFromRaw =
    raw?.target_event_id ?? raw?.targetEventId ?? raw?.event_id ?? raw?.payload?.target_event_id
  const target = ctx.events.find((e) => e.id === targetFromRaw) ?? findReferencedEvent(ctx.message, ctx.events)
  const confidence = confidenceOf(raw)

  if (confidence < 0.65) issues.add('low_confidence')
  if (!target) issues.add('missing_linked_target')
  if (titleLooksUnsafe(title, ctx.message)) issues.add('unsafe_title')
  if (!title || !target) return null

  return {
    type: 'linked_reminder',
    title,
    target_event_id: target.id,
    confidence,
    reason: raw?.reason ?? raw?.debug ?? null,
  }
}

function normalizeUpdateEventAction(raw, ctx, issues) {
  const id = raw?.id ?? raw?.target_event_id ?? raw?.targetEventId ?? raw?.payload?.id
  if (!id) {
    issues.add('incomplete_action')
    return null
  }
  const src = raw?.updates ?? raw?.payload?.updates ?? {}
  const updates = {}
  if (typeof src.title === 'string' && src.title.trim()) updates.title = cleanNovaTitle(src.title)
  const date = src.date ?? null
  if (typeof date === 'string' || date === null) updates.date = date
  const start = normalizeTime24(src.start_time ?? src.startTime ?? src.time)
  const end = normalizeTime24(src.end_time ?? src.endTime)
  if (start && end) updates.time = `${start}-${end}`
  else if (start) updates.time = start
  if (typeof src.description === 'string' || src.description === null) updates.description = src.description
  if (typeof src.section === 'string') updates.section = src.section

  if (Object.keys(updates).length === 0) {
    issues.add('incomplete_action')
    return null
  }
  return { type: 'update_event', id, updates, confidence: confidenceOf(raw), reason: raw?.reason ?? null }
}

function dedupeActions(actions) {
  const seen = new Set()
  const out = []
  for (const action of actions) {
    const key = JSON.stringify({
      type: action.type,
      title: action.title ?? '',
      date: action.date ?? '',
      time: action.start_time ?? action.reminder_time ?? '',
      target: action.target_event_id ?? action.id ?? '',
    })
    if (seen.has(key)) continue
    seen.add(key)
    out.push(action)
  }
  return out
}

export function normalizeNovaResponse(parsed, options) {
  const ctx = {
    message: options?.message ?? '',
    dateContext: options?.dateContext ?? {},
    events: Array.isArray(options?.events) ? options.events : [],
  }
  const issues = new Set()
  const inputActions = Array.isArray(parsed?.actions) ? parsed.actions : []
  const actions = []

  for (const raw of inputActions) {
    if (!raw || typeof raw !== 'object') continue
    const type = String(raw.type ?? '').trim()
    if (!type) {
      issues.add('incomplete_action')
      continue
    }

    if (type === 'remember') {
      actions.push(raw)
      continue
    }
    if (type === 'delete_event') {
      actions.push(raw)
      continue
    }
    if (type === 'edit_event' || type === 'update_event') {
      const normalized = normalizeUpdateEventAction(raw, ctx, issues)
      if (normalized) actions.push(normalized)
      continue
    }
    if (type === 'linked_reminder') {
      const normalized = normalizeLinkedReminderAction(raw, ctx, issues)
      if (normalized) actions.push(normalized)
      continue
    }
    if (type === 'reminder') {
      const normalized = normalizeReminderAction(raw, ctx, issues)
      if (normalized) actions.push(normalized)
      continue
    }
    if (type === 'event') {
      const normalized = normalizeEventAction(raw, ctx, issues)
      if (normalized) actions.push(normalized)
      continue
    }
    if (type === 'add_event') {
      const title = extractTitle(raw)
      const isReminder = /^recordatorio\s*:/i.test(title) || raw?.event?.icon === 'alarm' || raw?.event?.section === 'reminder'
      const normalized = isReminder
        ? normalizeReminderAction(raw, ctx, issues)
        : normalizeEventAction(raw, ctx, issues)
      if (normalized) actions.push(normalized)
      continue
    }
    if (TASK_ACTION_TYPES.has(type)) {
      issues.add('task_action')
      if (type === 'add_task' || type === 'task') {
        const normalized = normalizeReminderAction(raw, ctx, issues)
        if (normalized) actions.push(normalized)
      }
      continue
    }

    issues.add('unsupported_action')
  }

  const issueList = Array.from(issues)
  const escalationIssues = new Set([
    'low_confidence',
    'task_action',
    'missing_linked_target',
    'unsupported_action',
    'incomplete_action',
    'unsafe_title',
  ])
  const needsEscalation =
    !options?.alreadyEscalated &&
    issueList.some((issue) => escalationIssues.has(issue))

  return {
    reply: typeof parsed?.reply === 'string' ? parsed.reply : '',
    actions: dedupeActions(actions),
    issues: issueList,
    needsEscalation,
  }
}

export function shouldRouteToSonnetFirst(message, events = []) {
  const text = String(message ?? '').trim()
  const n = normalizeText(text)
  if (!text) return false
  if (text.length > 140) return true
  if (LINKED_RE.test(text)) return true
  if (events.length > 0 && /\bpara\s+(?:la|el)\s+.+\b(recu[eé]rdame|acu[eé]rdame|agrega|pon)\b/i.test(text)) return true

  const hasMultiConnector = /\b(despu[eé]s|luego|antes)\b|,|\s+y\s+/i.test(text)
  const intentCount = (n.match(/\b(recuerdame|recuerdate|recordarme|acuerdame|acuerdate|avisame|agenda|agendame|tengo|comprar|pagar|estudiar|entrenar)\b/g) ?? []).length
  const timeCount = (n.match(/\b(?:a las|tipo|noche|tarde|\d{1,2}:\d{2})\b/g) ?? []).length
  if (hasMultiConnector && (intentCount >= 2 || timeCount >= 2)) return true

  // Multi-intent SIN conector explícito: "tengo X a las Y acuérdame Z" o
  // "agendá A acuérdame B" — Haiku tiende a perder el sujeto o robarle la
  // hora al reminder. Si vemos un verbo de evento (tengo/agenda/agéndame) +
  // un verbo de reminder (recu/acu/avísame) en la misma frase, vamos a Sonnet
  // directo. Cubre el caso del usuario en mayo 2026 (prueba de artes + aviso al profe).
  const hasEventVerb = /\b(tengo|agenda|agendame|agéndame)\b/i.test(n)
  const hasReminderVerb = /\b(recuerdame|recuerdate|recordarme|acuerdame|acuerdate|avisame)\b/i.test(n)
  if (hasEventVerb && hasReminderVerb) return true

  return false
}

function splitSegments(message) {
  return compact(message)
    .replace(/\s+y\s+despu[eé]s\s+/gi, ' | después ')
    .replace(/\s*,\s*despu[eé]s\s+/gi, ' | después ')
    .replace(/\s*,\s*/g, ' | ')
    .replace(/\s+y\s+(?=(?:en|por)\s+la\s+noche)/gi, ' | ')
    .replace(/\s+y\s+(?=(?:recu[eé]rdame|acu[eé]rdame|acu[eé]rdate|av[ií]same))/gi, ' | ')
    .replace(/\s+y\s+antes\s+/gi, ' | antes ')
    .split('|')
    .map((s) => compact(s))
    .filter(Boolean)
}

function isEventLike(segment) {
  return /\b(tengo|prueba|dentista|doctor|reuni[oó]n|junta|clase|entrenar|entrenamiento|estudiar|historia|cata|juntarme|almuerzo|cena)\b/i.test(segment) &&
    !REMINDER_RE.test(segment)
}

function isStudyBlock(segment) {
  return /\b(tengo que|debo|necesito)\b/i.test(segment) && /\b(estudiar|repasar|preparar)\b/i.test(segment)
}

function parseDeterministicSegment(segment, state, options) {
  const date = dateFromText(segment, options.dateContext, state.currentDate ?? options.dateContext.todayISO)
  const explicitTime = timeFromText(segment)

  if (LINKED_RE.test(segment)) {
    const target = findReferencedEvent(segment, options.events)
    if (!target) return null
    return {
      type: 'linked_reminder',
      title: cleanNovaTitle(segment.replace(/^.*?\b(?:recu[eé]rdame|acu[eé]rdame|agrega(?:r)?|pon(?:er)?)\b/i, '')),
      target_event_id: target.id,
      confidence: 0.86,
      reason: 'deterministic_linked_reminder',
    }
  }

  if (REMINDER_RE.test(segment)) {
    const beforeTime = /^\s*antes\b/i.test(segment) && state.previousEventTime
      ? minutesToTime(timeToMinutes(state.previousEventTime) - 30)
      : null
    let title = cleanNovaTitle(segment)
    if (/^Estudiar$/i.test(title) && /\bhistoria\b/i.test(state.previousEventTitle ?? '')) {
      title = 'Estudiar historia'
    }
    return {
      type: 'reminder',
      title,
      date,
      reminder_time: explicitTime ?? beforeTime,
      end_time: null,
      confidence: 0.86,
      reason: 'deterministic_reminder',
    }
  }

  if (/^\s*antes\b/i.test(segment) && state.previousEventTime) {
    return {
      type: 'reminder',
      title: cleanNovaTitle(segment),
      date,
      reminder_time: minutesToTime(timeToMinutes(state.previousEventTime) - 30),
      end_time: null,
      confidence: 0.74,
      reason: 'deterministic_before_previous_event',
    }
  }

  const treatAsEvent = isEventLike(segment) || isStudyBlock(segment) || /\bag[eé]ndame\b/i.test(segment)
  if (treatAsEvent) {
    return {
      type: 'event',
      title: cleanNovaTitle(segment),
      date,
      start_time: explicitTime,
      end_time: null,
      confidence: 0.82,
      reason: 'deterministic_event',
    }
  }

  if (/\b(comprar|pagar|mandar|enviar|ordenar|buscar|llamar|llevar)\b/i.test(segment)) {
    return {
      type: 'reminder',
      title: cleanNovaTitle(segment),
      date,
      reminder_time: explicitTime,
      end_time: null,
      confidence: 0.78,
      reason: 'deterministic_todo_as_reminder',
    }
  }

  return null
}

export function tryParseDeterministicCalendarRequest(message, options = {}) {
  const dateContext = options.dateContext
  if (!dateContext?.todayISO) return null
  const segments = splitSegments(message)
  if (segments.length === 0) return null

  const state = {
    currentDate: dateFromText(message, dateContext, dateContext.todayISO),
    previousEventTime: null,
    previousEventTitle: null,
  }
  const actions = []
  for (const segment of segments) {
    const action = parseDeterministicSegment(segment, state, {
      dateContext,
      events: Array.isArray(options.events) ? options.events : [],
    })
    if (!action || !action.title) return null
    if (action.type === 'event') {
      if (action.start_time) state.previousEventTime = action.start_time
      state.previousEventTitle = action.title
    }
    if (action.date) state.currentDate = action.date
    actions.push(action)
  }
  if (actions.length === 0) return null
  return {
    reply: actions.length === 1 ? 'Listo.' : `Listo, separé ${actions.length} acciones.`,
    actions,
  }
}
