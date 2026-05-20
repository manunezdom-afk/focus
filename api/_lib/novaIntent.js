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

const REMINDER_RE = /\b(recu[eé]rdame|recordarme|recordatorio|acu[eé]rdate|acu[eé]rdame|av[ií]same|no se me puede olvidar|que no se me olvide|no se me (?:quede|olvide))\b/i
const LINKED_RE = /\b(agrega(?:r)? abajo|pon(?:er)? debajo|debajo de|abajo de|para (?:la|el|mi|tu)?\s*.+\s+(?:recu[eé]rdame|acu[eé]rdame|agrega|pon)|en ese evento)\b/i
const TASK_ACTION_TYPES = new Set(['task', 'add_task', 'toggle_task', 'mark_task_done', 'delete_task'])

// "saca X (del bolso)", "lleva X", "echar X", "trae X" — son sub-recordatorios
// que cuelgan del último evento mencionado en el mismo mensaje. NO son eventos
// ni recordatorios sueltos. El usuario los escribe en imperativo dirigido a Nova:
// "Tengo fútbol en 30 min. Saca las zapatillas del bolso." → linked_reminder.
const SUB_REMINDER_VERB_RE = /\b(saca|sacar|llev[ao]|llevar|trae|traer|echa|echar|no\s+se\s+me\s+(?:quede|olvide)|que\s+no\s+se\s+me\s+(?:olvide|quede))\b/i

// "tengo que ir a + actividad" / "tengo + evento (fútbol/prueba/doctor)" son
// señales fuertes de EVENTO, no de recordatorio. Sirve para inferir intent
// cuando el usuario no usa verbos de agenda explícitos.
const EVENT_NOUN_RE = /\b(f[uú]tbol|tenis|p[aá]del|b[aá]squet|partido|gym|gimnasio|crossfit|pilates|yoga|prueba|examen|test|control|certamen|interrogaci[oó]n|presentaci[oó]n|reuni[oó]n|junta|llamada|clase|c[aá]tedra|sesi[oó]n|consulta|doctor|m[eé]dico|dentista|cita|entrevista|almuerzo|cena|desayuno|caf[eé]|brunch|conferencia|charla|seminario|taller)\b/i

const SPANISH_NUMBER_WORDS = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14,
  quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
}

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
  s = s.replace(/^["'“”«»]+|["'“”«»]+$/g, '')
  s = s.replace(/\b(hoy|mañana|manana|pasado mañana|pasado manana)\b/gi, ' ')
  s = s.replace(/\b(?:el\s+)?(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/gi, ' ')
  // Tiempos relativos: "en media hora", "en una hora", "en X minutos" — y la
  // coletilla coloquial "X más" ("en 30 minutos más", "en media hora más").
  s = s.replace(/\ben\s+(?:un[ao]?\s+)?(?:media|cuarto)\s+(?:de\s+)?hora(?:\s+m[aá]s)?\b/gi, ' ')
  s = s.replace(/\ben\s+(?:un[ao]?\s+|\d+\s+)?(?:hora|horas|minuto|minutos|min)(?:\s+m[aá]s)?\b/gi, ' ')
  s = s.replace(/\b(?:tipo|como a eso de|alrededor de|cerca de)\s+(?:las\s+)?(?:\d{1,2}(?::\d{2})?|un[ao]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s*(?:am|pm|a\.m\.|p\.m\.)?\b/gi, ' ')
  s = s.replace(/\b(?:a\s+las|las)\s+(?:\d{1,2}(?::\d{2})?|un[ao]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\s*(?:am|pm|a\.m\.|p\.m\.)?\b/gi, ' ')
  s = s.replace(/\b(?:en|por)\s+la\s+(?:mañana|manana|tarde|noche)\b/gi, ' ')
  s = s.replace(/\bdespu[eé]s\b|\bluego\b|\bantes\b|\btambi[eé]n\b/gi, ' ')
  s = s.replace(/\s+/g, ' ').trim()

  const leadPatterns = [
    /^(?:por favor\s+)?(?:recu[eé]rdame|recordarme|acu[eé]rdate|acu[eé]rdame|av[ií]same)(?:\s+de|\s+que|\s+para)?\s+/i,
    /^(?:que\s+)?no\s+se\s+me\s+(?:puede\s+)?(?:olvide|quede)(?:\s+de|\s+que)?\s+/i,
    /^recordatorio\s*:\s*/i,
    /^(?:ag[eé]ndame|agenda|agregar?|agr[eé]game|pon(?:me)?|crea(?:me)?)(?:\s+un[ao]?|\s+en\s+(?:mi\s+)?calendario|\s+en\s+(?:mi\s+)?agenda)?(?:\s+de|\s+para)?\s+/i,
    /^(?:tengo\s+que\s+ir\s+a)\s+/i,
    /^(?:tengo\s+que|hay\s+que|debo|necesito)\s+/i,
    /^tengo\s+/i,
    // "voy a", "voy al", "voy a la", "voy a los/las", "voy a el" — todas las
    // formas que llevan determinante. "voy a + verb infinitive" también: el
    // determinante opcional permite que no se exija.
    /^voy\s+a(?:l|\s+(?:la|los|las|el))?\s+/i,
  ]
  for (const re of leadPatterns) s = s.replace(re, '')

  // "dar una prueba de historia" → "Prueba de historia" (el verbo "dar" sobra).
  s = s.replace(/^dar\s+(?:una\s+|un\s+)?/i, '')
  // "jugar fútbol" → "Fútbol" (queremos el sustantivo, no el verbo genérico).
  s = s.replace(/^(?:jugar|practicar)\s+(?:al\s+|a\s+)?/i, '')

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

// Hora en palabras: "tipo cuatro", "a las cuatro", "como a las ocho". El
// parser numérico no las pesca porque trabaja con dígitos. Devuelve "HH:MM"
// 24h o null. Por defecto PREFIERE PM (uso conversacional): "a las cuatro"
// sin más contexto = 16:00. Para forzar AM, el usuario debe decir
// "de la mañana" o "am" explícito.
export function parseSpanishHourWord(text, opts = {}) {
  const value = String(text ?? '').toLowerCase()
  if (!value) return null
  const match = value.match(
    /\b(?:a\s+las|las|tipo|alrededor\s+de|cerca\s+de|como\s+a\s+(?:eso\s+de\s+)?(?:las\s+)?)\s*(un[ao]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)\b/i,
  )
  if (!match) return null
  const word = match[1].toLowerCase()
  const base = SPANISH_NUMBER_WORDS[word]
  if (base == null) return null

  let hour = base
  const isMorning = /\b(?:de\s+la\s+mañana|de\s+la\s+manana|\bam\b|a\.m\.)\b/i.test(value)
  const isAfternoon =
    /\b(?:tipo|de\s+la\s+tarde|de\s+la\s+noche|pm|p\.m\.)\b/i.test(value) ||
    opts.preferAM !== true

  if (isMorning) {
    if (hour === 12) hour = 0
  } else if (isAfternoon && hour >= 1 && hour <= 11) {
    hour += 12
  }
  if (hour === 24) hour = 12
  return `${String(hour).padStart(2, '0')}:00`
}

// Tiempo relativo: "en media hora", "en una hora", "en 30 minutos", "en un
// cuarto de hora". Suma a `nowHHMM` y devuelve "HH:MM" 24h. Null si no matchea
// o si la suma se sale del mismo día (caemos al fallback del caller).
export function parseRelativeTime(text, nowHHMM) {
  if (!nowHHMM) return null
  const nowMin = timeToMinutes(nowHHMM)
  if (nowMin == null) return null
  const value = String(text ?? '').toLowerCase()
  if (!/\ben\s+/.test(value)) return null

  let deltaMin = null
  if (/\ben\s+(?:un[ao]?\s+)?media\s+hora\b/.test(value)) deltaMin = 30
  else if (/\ben\s+(?:un\s+)?cuarto\s+(?:de\s+)?hora\b/.test(value)) deltaMin = 15
  else if (/\ben\s+(?:un[ao]?\s+)hora(?:\s+m[aá]s)?\b/.test(value)) deltaMin = 60
  else {
    const numMatch = value.match(/\ben\s+(\d{1,3})\s*(hora|horas|minuto|minutos|min)\b/)
    if (numMatch) {
      const qty = parseInt(numMatch[1], 10)
      const unit = numMatch[2]
      if (Number.isFinite(qty)) {
        deltaMin = /hora/.test(unit) ? qty * 60 : qty
      }
    } else {
      const wordMatch = value.match(/\ben\s+(un[ao]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(hora|horas|minuto|minutos|min)\b/)
      if (wordMatch) {
        const qty = SPANISH_NUMBER_WORDS[wordMatch[1]] ?? null
        const unit = wordMatch[2]
        if (qty != null) deltaMin = /hora/.test(unit) ? qty * 60 : qty
      }
    }
  }
  if (deltaMin == null) return null
  const total = nowMin + deltaMin
  if (total < 0 || total > 23 * 60 + 59) return null
  return minutesToTime(total)
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

function timeFromText(text, opts = {}) {
  const n = normalizeText(text)

  // Tiempo relativo: "en media hora", "en 30 min", "en una hora" — preferimos
  // este parse ANTES que números absolutos, porque "en 30 minutos" lleva un 30
  // que el regex de horas confundiría con "30:00".
  if (opts.nowHHMM) {
    const rel = parseRelativeTime(text, opts.nowHHMM)
    if (rel) return rel
  }

  const typeMatch = n.match(/\btipo\s+(?:las\s+)?(\d{1,2})(?::(\d{2}))?/)
  if (typeMatch) return normalizeTime24(typeMatch[0], { preferPM: true })

  const explicit = text.match(/\b(?:a\s+las|las)\s+\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)?\b/)
  if (explicit) return normalizeTime24(explicit[0], { preferPM: true })

  const bareMeridiem = text.match(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm|a\.m\.|p\.m\.)\b/)
  if (bareMeridiem) return normalizeTime24(bareMeridiem[0])

  // Hora en palabras: "tipo cuatro", "a las cinco", "como a las ocho".
  const word = parseSpanishHourWord(text)
  if (word) return word

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
  if (title.length > 70) return true
  const nt = normalizeText(title)
  const nm = normalizeText(message)
  if (nt && nm && nt === nm) return true
  // El LLM a veces concatena dos intents en un mismo título ("Sacar las
  // zapatillas y también tipo cuatro tengo que..."). Si vemos un conector
  // multi-intent dentro del título, lo marcamos como inseguro — el parser
  // determinístico (o un re-prompt) debería separarlo en dos acciones.
  if (/\s+y\s+tambi[eé]n\s+/i.test(title)) return true
  if (/\btengo\s+que\s+/i.test(title) && title.length > 30) return true
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
  const unsafe = titleLooksUnsafe(title, ctx.message)
  if (unsafe) issues.add('unsafe_title')

  if (!title || !date) {
    issues.add('incomplete_action')
    return null
  }
  // Si el título es inseguro (frase del usuario embebida, multi-intent
  // concatenado, etc), descartamos la acción para forzar escalación o
  // fallback determinístico. Dejar pasar un evento con título de 80+ chars
  // es peor que devolver vacío — el UI lo muestra horrible y el usuario
  // tiene que editarlo a mano.
  if (unsafe) return null

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
  const unsafe = titleLooksUnsafe(title, ctx.message)
  if (unsafe) issues.add('unsafe_title')
  if (!title || !date) {
    issues.add('incomplete_action')
    return null
  }
  // Igual que en normalizeEventAction: si el título quedó inseguro, no lo
  // devolvemos al cliente. La escalación se encarga del rescate.
  if (unsafe) return null

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

  // Defensa contra "¿lo creamos como evento o como tarea?" — el LLM filtra la
  // palabra "tarea" aun con prompt que lo prohíbe. Si la reply pregunta entre
  // evento y tarea, marcamos el issue para escalar (Sonnet con refuerzo) o
  // caer al parser determinístico. La palabra "tarea" no existe en esta app.
  const replyText = typeof parsed?.reply === 'string' ? parsed.reply : ''
  const lowerReply = replyText.toLowerCase()
  if (/\b(evento|agenda).{0,30}(o\s+(?:como\s+)?tarea|o\s+tarea)\b/i.test(lowerReply) || /\bcomo\s+tarea\b/i.test(lowerReply)) {
    issues.add('asked_event_or_task')
  }
  // Si el LLM devolvió 0 acciones pero el mensaje tiene señales fuertes de
  // intent (sustantivo de evento, verbo de recordatorio, o sub-recordatorio
  // ligado a un evento), también escalamos — significa que Nova está
  // "preguntando demasiado" en vez de actuar. Importante: NO disparamos en
  // "tengo X" genérico (ej: "tengo hambre"), solo en patrones donde podemos
  // ofrecer una acción concreta como fallback. El parser determinístico debe
  // poder construir algo razonable o no escalamos en falso.
  const messageHasStrongIntent =
    EVENT_NOUN_RE.test(ctx.message) ||
    REMINDER_RE.test(ctx.message) ||
    SUB_REMINDER_VERB_RE.test(ctx.message)
  if (actions.length === 0 && messageHasStrongIntent && ctx.message.length > 0) {
    issues.add('no_actions_for_clear_intent')
  }

  const issueList = Array.from(issues)
  const escalationIssues = new Set([
    'low_confidence',
    'task_action',
    'missing_linked_target',
    'unsupported_action',
    'incomplete_action',
    'unsafe_title',
    'asked_event_or_task',
    'no_actions_for_clear_intent',
  ])
  const needsEscalation =
    !options?.alreadyEscalated &&
    issueList.some((issue) => escalationIssues.has(issue))

  return {
    reply: replyText,
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

  // Sub-recordatorio embebido: "Tengo fútbol. Saca las zapatillas" o "Voy al
  // doctor a las 5 y tengo que llevar la receta". Haiku se confunde y mete
  // todo en un solo título gigante. Sonnet lo separa mejor.
  if (SUB_REMINDER_VERB_RE.test(text) && (hasEventVerb || EVENT_NOUN_RE.test(text))) return true

  // Multi-oración con punto. Si el usuario escribió dos o más oraciones,
  // probablemente son intents distintos y queremos que Sonnet los separe.
  const sentenceCount = (text.match(/[.!?]\s+\S/g) ?? []).length + 1
  if (sentenceCount >= 2 && (hasEventVerb || EVENT_NOUN_RE.test(text) || SUB_REMINDER_VERB_RE.test(text))) return true

  // "Tengo X (sustantivo de evento)" o "tengo que ir a + actividad" es señal
  // de evento aunque no haya conector. Si encima hay tiempo, vamos a Sonnet
  // por seguridad (Haiku se confunde con "tipo cuatro" o "en media hora").
  if (/\btengo\s+(?:que\s+)?(?:ir\s+a\s+)?\w+/i.test(text) && EVENT_NOUN_RE.test(text) && timeCount >= 1) return true

  return false
}

function splitSegments(message) {
  return compact(message)
    .replace(/\s+y\s+despu[eé]s\s+/gi, ' | después ')
    .replace(/\s*,\s*despu[eé]s\s+/gi, ' | después ')
    // Punto / signo final como separador de oraciones. "Tengo fútbol en 30 min.
    // Saca las zapatillas" debe dividirse en dos segmentos. Mantenemos el
    // punto fuera del segmento para que el cleanNovaTitle no tenga que pelearse.
    .replace(/\s*[.!?]+\s+/g, ' | ')
    // "y también" + "y además" = nuevo intent. Frecuente en habla espontánea
    // para encadenar dos eventos: "tengo fútbol y también prueba a las 4".
    .replace(/\s+y\s+(?:tambi[eé]n|adem[aá]s)\s+/gi, ' | ')
    .replace(/\s*,\s*/g, ' | ')
    .replace(/\s+y\s+(?=(?:en|por)\s+la\s+noche)/gi, ' | ')
    .replace(/\s+y\s+(?=(?:recu[eé]rdame|acu[eé]rdame|acu[eé]rdate|av[ií]same))/gi, ' | ')
    // "y tengo / y voy / y tipo X tengo" — el siguiente verbo de evento abre
    // un nuevo segmento. Sin esto, "fútbol y tipo cuatro tengo prueba" se
    // tomaba como un solo segmento ambiguo.
    .replace(/\s+y\s+(?=(?:tengo|voy|tipo\b))/gi, ' | ')
    // Sub-recordatorio inline: "fútbol en 30 min y saca las zapatillas" —
    // separamos para tratarlo como reminder propio.
    .replace(/\s+y\s+(?=(?:saca|sacar|llev[ao]|llevar|trae|traer|echa|echar|no\s+se\s+me\s+(?:quede|olvide)))/gi, ' | ')
    .replace(/\s+y\s+antes\s+/gi, ' | antes ')
    .split('|')
    .map((s) => compact(s))
    .filter(Boolean)
}

function isEventLike(segment) {
  return /\b(tengo|prueba|dentista|doctor|m[eé]dico|reuni[oó]n|junta|clase|entrenar|entrenamiento|estudiar|historia|cata|juntarme|almuerzo|cena|f[uú]tbol|tenis|partido|gym|gimnasio|examen|control|certamen|interrogaci[oó]n|presentaci[oó]n|consulta|cita|entrevista|charla|conferencia|seminario|taller)\b/i.test(segment) &&
    !REMINDER_RE.test(segment) &&
    !SUB_REMINDER_VERB_RE.test(segment)
}

function isStudyBlock(segment) {
  return /\b(tengo que|debo|necesito)\b/i.test(segment) && /\b(estudiar|repasar|preparar)\b/i.test(segment)
}

function parseDeterministicSegment(segment, state, options) {
  const date = dateFromText(segment, options.dateContext, state.currentDate ?? options.dateContext.todayISO)
  const explicitTime = timeFromText(segment, { nowHHMM: options.dateContext?.currentTime24 })

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

  // Sub-recordatorio imperativo ("saca/lleva/trae/echa X"). En un mensaje
  // multi-intent, viene típicamente después de un evento al que pertenece
  // ("Tengo fútbol en 30 min. Saca las zapatillas del bolso."). Lo guardamos
  // como reminder con la fecha del evento previo si existe, sin hora propia.
  if (SUB_REMINDER_VERB_RE.test(segment) && !REMINDER_RE.test(segment)) {
    // Mantenemos el verbo en imperativo del usuario pero limpiamos la frase.
    // "Saca las zapatillas del bolso" → "Sacar las zapatillas" (verbo en
    // infinitivo es más natural para un recordatorio).
    let title = cleanNovaTitle(segment)
      .replace(/^(?:saca|sacar|saco)\b/i, 'Sacar')
      .replace(/^(?:lleva|llevar|llevo)\b/i, 'Llevar')
      .replace(/^(?:trae|traer|traigo)\b/i, 'Traer')
      .replace(/^(?:echa|echar|echo)\b/i, 'Echar')
      .replace(/\s+que\s+las?\s+tengo\s+.*$/i, '')
      .replace(/\s+que\s+lo\s+tengo\s+.*$/i, '')
      .replace(/\s+del?\s+(bolso|mochila|cajón|cajon|auto|coche|escritorio)\s*$/i, '')
    title = sentenceCase(compact(title))
    if (!title) return null
    return {
      type: 'reminder',
      title,
      date: state.previousEventDate ?? date,
      reminder_time: explicitTime,
      end_time: null,
      confidence: 0.8,
      reason: 'deterministic_sub_reminder',
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
    previousEventDate: null,
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
      state.previousEventDate = action.date
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
