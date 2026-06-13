#!/usr/bin/env node
// 30 peticiones COMPLEJAS/ENREDADAS para HOY, modo SOLO-EVENTOS — validación
// local contra Anthropic real (ruteo Haiku→Sonnet de producción). Verifica:
// títulos con sentido (no solo el nombre: "juntarme con Mateo" ≠ "Mateo"),
// multi-intent (2-3 cosas), categoría/icono, subtítulos, horas, recordatorios,
// y que NUNCA se cree una tarea (add_task) — todo evento; lo sin hora pregunta.
// Uso: node scripts/validate-complex-30.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'
import { buildDateContext } from '../api/_lib/dateContext.js'
import { buildSystemPrompt } from '../api/_lib/systemPrompt.js'
import { safeParseAssistantJSON } from '../api/_lib/neutralize.js'
import { filterCalendarEditActions } from '../api/_lib/calendarIntent.js'
import { __detectComplexInput, __isClarificationReply } from '../api/focus-assistant.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
let apiKey = process.env.ANTHROPIC_API_KEY?.trim()
if (!apiKey) {
  try { const env = readFileSync(join(ROOT, '.env.local'), 'utf8'); const m = env.split('\n').find(l => l.startsWith('ANTHROPIC_API_KEY=')); if (m) apiKey = m.slice(18).trim().replace(/^["']|["']$/g, '') } catch {}
}
if (!apiKey) { console.error('✗ Falta ANTHROPIC_API_KEY'); process.exit(2) }
const client = new Anthropic({ apiKey })
const HAIKU = 'claude-haiku-4-5-20251001', SONNET = 'claude-sonnet-4-6'
const dc = buildDateContext(Date.now(), 'America/Santiago')
const norm = s => (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const resolveDate = t => t === 'today' ? dc.todayISO : t === 'tomorrow' ? dc.tomorrow : t
const SPORT = new Set(['fitness_center', 'directions_run', 'directions_bike', 'directions_walk', 'pool', 'hiking', 'sports'])
const isSport = ic => SPORT.has((ic || '').toLowerCase()) || (ic || '').toLowerCase().startsWith('sports_')

async function callC({ system, history, message, model, extra = '' }) {
  return client.messages.create({ model, max_tokens: 2048, system, messages: [...history, { role: 'user', content: message }, ...(extra ? [{ role: 'user', content: extra }] : [])] })
}
async function run(c) {
  const events = (c.events || []).map(e => ({ ...e, date: resolveDate(e.date) || e.date }))
  const system = buildSystemPrompt({ dateContext: dc, weatherContext: 'Ubicación no disponible.', contacts: [], profile: null, behavior: null, memories: [], events, tasks: [], novaPersonality: 'focus', discussedEventIds: c.discussed || [] })
  const history = c.history || []
  const scope = `${[...history].reverse().find(h => h.role === 'user')?.content || ''}\n${c.input}`
  const isComplex = __detectComplexInput(c.input) || __isClarificationReply(history)
  let parsed = null
  if (isComplex) { const d = await callC({ system, history, message: c.input, model: SONNET }); parsed = safeParseAssistantJSON((d.content?.[0]?.text ?? '').trim()) }
  else {
    const d1 = await callC({ system, history, message: c.input, model: HAIKU }); let hp = null; try { hp = safeParseAssistantJSON((d1.content?.[0]?.text ?? '').trim()) } catch {}
    const pre = filterCalendarEditActions(Array.isArray(hp?.actions) ? hp.actions : [], scope)
    const esc = !hp || d1.stop_reason === 'max_tokens' || (d1.usage?.output_tokens || 0) > 1780 || pre.stripped.length > 0 || (typeof hp?.confidence === 'number' ? hp.confidence : 1) < 0.55
    if (esc) { const d2 = await callC({ system, history, message: c.input, model: SONNET, extra: 'Devuelve SOLO el JSON.' }); try { parsed = safeParseAssistantJSON((d2.content?.[0]?.text ?? '').trim()) } catch { parsed = hp } } else parsed = hp
  }
  const out = { mode: parsed.mode, reply: parsed.reply || '', shouldAskUser: !!parsed.shouldAskUser, actions: Array.isArray(parsed.actions) ? parsed.actions : [] }
  const ef = filterCalendarEditActions(out.actions, scope); if (ef.stripped.length > 0) out.actions = ef.actions
  return out
}
const ev = (out, n) => out.actions.find(a => (a.type === 'add_event' || a.type === 'add_recurring_event') && norm(a.event?.title).includes(norm(n)))
function evaluate(c, out) {
  const e = c.expect, f = []
  // SOLO-EVENTOS: jamás add_task.
  if (out.actions.some(a => a.type === 'add_task')) f.push('creó add_task (modo solo-eventos lo prohíbe)')
  if (e.minActions != null && out.actions.length < e.minActions) f.push(`acciones ${out.actions.length}<${e.minActions}`)
  const evs = out.actions.filter(a => a.type === 'add_event' || a.type === 'add_recurring_event')
  if (e.today) for (const a of evs) { const d = a.event?.date ?? dc.todayISO; if (d !== dc.todayISO) f.push(`${a.event?.title}: date=${d} no es HOY`) }
  for (const [n, ic] of Object.entries(e.iconFor || {})) { const a = ev(out, n); if (!a) { f.push(`falta evento ~${n}`); continue } const ok = ic === 'fitness_center' ? isSport(a.event?.icon) : a.event?.icon === ic; if (!ok) f.push(`${n}: icon=${a.event?.icon}`) }
  for (const [n, sub] of Object.entries(e.subtitleFor || {})) { const a = ev(out, n); if (!a) f.push(`falta evento ~${n}`); else if (!norm(a.event?.subtitle).includes(norm(sub))) f.push(`${n}: subtitle="${a.event?.subtitle}" (esperaba ~${sub})`) }
  for (const [n, t] of Object.entries(e.timeFor || {})) { const a = ev(out, n); if (!a) f.push(`falta evento ~${n}`); else if (norm(a.event?.time) !== norm(t)) f.push(`${n}: time=${a.event?.time} (esperaba ${t})`) }
  for (const [n, off] of Object.entries(e.reminderFor || {})) { const a = ev(out, n); if (!(a?.event?.reminderOffsets || []).includes(off)) f.push(`${n}: reminderOffsets=${JSON.stringify(a?.event?.reminderOffsets)} (esperaba ${off})`) }
  // richTitle: el evento que matchea `needle` debe tener título con SENTIDO
  // (≥2 palabras), no solo el nombre de la persona ("Mateo").
  for (const n of e.richTitleFor || []) { const a = ev(out, n); if (!a) { f.push(`falta evento ~${n}`); continue } const words = norm(a.event?.title).trim().split(/\s+/).filter(Boolean); if (words.length < 2) f.push(`título pobre "${a.event?.title}" (esperaba acción + ${n}, no solo el nombre)`) }
  // asksTime: sin hora → debe preguntar (clarification / reply con "?"), NO crear.
  if (e.asksTime) { const asked = out.mode === 'clarification' || out.shouldAskUser || /\?|hora/i.test(out.reply); if (!asked) f.push(`no pidió la hora (mode=${out.mode}, acts=${out.actions.length})`); if (out.actions.some(a => a.type === 'add_event' && !a.event?.time)) f.push('creó evento sin hora') }
  return f
}

const C = [
  // ── título con sentido (bug "juntarme con Mateo" → "Mateo") ──
  { input: 'hoy júntate con Mateo a las 6 para ver el proyecto', expect: { today: true, richTitleFor: ['mateo'], timeFor: { mateo: '6:00 PM' } } },
  { input: 'hoy almuerzo con Pedro a la 1 para hablar del negocio', expect: { today: true, richTitleFor: ['pedro'], subtitleFor: { pedro: 'negocio' }, timeFor: { pedro: '1:00 PM' } } },
  { input: 'reunión con Sofía hoy a las 3 sobre el contrato', expect: { today: true, richTitleFor: ['sofia'], subtitleFor: { sofia: 'contrato' } } },
  { input: 'hoy café con Javier a las 5 en Starbucks', expect: { today: true, richTitleFor: ['javier'], timeFor: { javier: '5:00 PM' } } },
  { input: 'hoy me junto con los del equipo a las 4 para el cierre de mes', expect: { today: true, minActions: 1, subtitleFor: { equipo: 'cierre' } } },
  // ── multi-intent enredado (2-3 cosas) ──
  { input: 'hoy tengo que pasar al banco a las 11, después almuerzo con mi mamá a la 1, y a las 6 gym de espalda', expect: { today: true, minActions: 3, iconFor: { gym: 'fitness_center' }, subtitleFor: { gym: 'espalda' } } },
  { input: 'agéndame hoy dentista a las 9 llevar la radiografía, reunión a las 11 para el presupuesto, y a las 8 cena con Ana para su cumpleaños', expect: { today: true, minActions: 3, iconFor: { dentista: 'local_hospital', reuni: 'groups' }, subtitleFor: { dentista: 'radiograf', reuni: 'presupuesto' } } },
  { input: 'hoy: reunión con el equipo a las 4 para cerrar el trimestre, gym a las 7 de pierna, y llamar al proveedor a las 9', expect: { today: true, minActions: 3, iconFor: { gym: 'fitness_center' }, subtitleFor: { gym: 'pierna' } } },
  { input: 'hoy a las 10 junta con marketing por la campaña, a la 1 almuerzo con el cliente, y a las 7 entreno hombro', expect: { today: true, minActions: 3, iconFor: { entren: 'fitness_center' }, subtitleFor: { entren: 'hombro' } } },
  { input: 'para hoy: yoga a las 7 de la mañana, terapia a las 5 de la tarde, y cena romántica a las 9', expect: { today: true, minActions: 3, iconFor: { yoga: 'fitness_center' }, timeFor: { yoga: '7:00 AM', terapia: '5:00 PM' } } },
  { input: 'hoy clase de inglés a las 5 para el examen, fútbol a las 7 con los amigos llevar la pelota, y llamar a mi hermana a las 9', expect: { today: true, minActions: 3, iconFor: { ingl: 'menu_book', fut: 'fitness_center' }, subtitleFor: { fut: 'pelota' } } },
  { input: 'hoy reunión a las 2 para revisar el código, gym a las 6 enfocado en piernas, y a las 8 cena con Ana', expect: { today: true, minActions: 3, iconFor: { gym: 'fitness_center' }, subtitleFor: { reuni: 'codigo', gym: 'pierna' } } },
  { input: 'hoy paso por la farmacia a las 12, almuerzo con mi jefe a las 2 para pedir el aumento, y a las 7 natación', expect: { today: true, minActions: 3, iconFor: { nataci: 'fitness_center' }, subtitleFor: { almuerzo: 'aumento' } } },
  { input: 'hoy junta con Diego a las 3 sobre el diseño, y a las 6 corro en el parque', expect: { today: true, minActions: 2, richTitleFor: ['diego'], iconFor: { corr: 'fitness_center' }, subtitleFor: { diego: 'diseño' } } },
  { input: 'hoy a las 9 reunión con recursos humanos por el contrato, a la 1 almuerzo, y a las 8 cumpleaños de mi tía', expect: { today: true, minActions: 3, subtitleFor: { reuni: 'contrato' } } },
  // ── recordatorios + multi ──
  { input: 'hoy reunión con Mateo a las 4 y recuérdame 30 minutos antes, y gym a las 7 de pierna recuérdame una hora antes', expect: { today: true, minActions: 2, richTitleFor: ['mateo'], reminderFor: { mateo: 30, gym: 60 }, iconFor: { gym: 'fitness_center' } } },
  { input: 'hoy a las 3 llamada con el banco por el préstamo, recuérdame 15 minutos antes', expect: { today: true, reminderFor: { llamada: 15 }, subtitleFor: { llamada: 'prestamo' } } },
  { input: 'hoy presentación a las 5 llevar el laptop y las notas, recuérdame una hora antes', expect: { today: true, reminderFor: { present: 60 }, subtitleFor: { present: 'laptop' } } },
  // ── ediciones / memoria (events + history) ──
  { events: [{ id: 'm1', title: 'Reunión con Mateo', time: '6:00 PM', date: 'today' }], discussed: ['m1'], history: [{ role: 'user', content: 'reunión con Mateo hoy a las 6' }, { role: 'assistant', content: 'Listo, Reunión con Mateo hoy a las 6:00 PM.' }], input: 'muévela media hora antes', expect: {} },
  { events: [{ id: 'g1', title: 'Gimnasio', time: '7:00 PM', date: 'today' }], discussed: ['g1'], history: [{ role: 'user', content: 'gym hoy a las 7' }, { role: 'assistant', content: 'Listo, Gimnasio hoy a las 7:00 PM.' }], input: 'ponle que es de pierna', expect: {} },
  // ── SOLO-EVENTOS: sin hora → pregunta, NO tarea ──
  { input: 'hoy comprar pan y leche', expect: { asksTime: true } },
  { input: 'anota llamar al plomero', expect: { asksTime: true } },
  { input: 'hoy tengo que estudiar para el examen', expect: { asksTime: true } },
  { input: 'recuérdame pagar la cuenta de la luz', expect: { asksTime: true } },
  // ── "como evento" explícito ──
  { input: 'anota juntarme con Mateo como evento a las 6', expect: { today: true, richTitleFor: ['mateo'], timeFor: { mateo: '6:00 PM' } } },
  { input: 'apunta comprar el regalo como evento a las 4', expect: { today: true, timeFor: { regalo: '4:00 PM' } } },
  // ── ambigüedad AM/PM por contexto + multi ──
  { input: 'hoy desayuno con Pedro a las 8 y cena con Ana a las 8', expect: { today: true, minActions: 2, iconFor: { desayun: 'restaurant' }, timeFor: { desayun: '8:00 AM', cena: '8:00 PM' } } },
  { input: 'hoy reunión a las 9, almuerzo a la 1 y gym a las 8 de espalda', expect: { today: true, minActions: 3, iconFor: { gym: 'fitness_center' }, subtitleFor: { gym: 'espalda' }, timeFor: { reuni: '9:00 AM' } } },
  // ── conversacional / consejo (no crear nada) ──
  { input: 'hoy ando con poca energía, ¿cómo aprovecho la tarde?', expect: { minActions: 0 } },
  { input: 'tengo el día lleno, ¿qué me recomiendas priorizar?', expect: { minActions: 0 } },
]

let pass = 0, fail = 0
for (let i = 0; i < C.length; i++) {
  const c = C[i]
  try {
    const out = await run(c)
    const fails = evaluate(c, out)
    if (fails.length === 0) { pass++; console.log(`✅ [${i + 1}/30] ${c.input.slice(0, 58)}`) }
    else { fail++; console.log(`❌ [${i + 1}/30] ${c.input.slice(0, 58)}`); console.log(`     reply: ${out.reply.replace(/\n/g, ' ').slice(0, 90)}`); console.log(`     acts: ${JSON.stringify(out.actions.map(a => ({ t: a.type, ti: a.event?.title || a.task?.label, ic: a.event?.icon, sub: a.event?.subtitle, tm: a.event?.time || a.updates?.time, ro: a.event?.reminderOffsets })))}`); console.log('     ' + fails.join('\n     ')) }
  } catch (e) { fail++; console.log(`❌ [${i + 1}/30] ERROR: ${e?.message || e}`) }
}
console.log(`\n═══ RESULTADO: ${pass}/${C.length} PASS (${fail} FAIL) ═══`)
process.exit(fail === 0 ? 0 : 1)
