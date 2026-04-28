// Inbox cross-app: Kairos envía aquí los eventos que el usuario crea allá
// para que aparezcan como sugerencias en Focus. Nova las propone al usuario,
// que aprueba o rechaza antes de que entren a su calendario.
//
// POST /api/kairos/inbox
//   body { focusCode, event: { title, date, time, description, section, icon } }
//
// Auth: NO requiere Bearer del usuario — basta con el focusCode (que es
// público por diseño y el usuario controla regenerándolo desde Ajustes). Las
// sugerencias quedan en estado pending: nada se aplica al calendario hasta
// que el dueño las apruebe.
//
// Cuando la sugerencia llega, se dispara una notificación push al usuario
// en todos sus dispositivos (web + iOS) si las tiene habilitadas.
//
// Para evitar abuso desde IPs maliciosas mantenemos rate limit estricto por
// IP + por focusCode. Si alguien spamea sugerencias falsas, basta con que el
// usuario regenere el código.

import webpush from 'web-push'
import { setCorsHeaders, rejectCrossSiteUnsafe } from '../_lib/security.js'
import { rateLimited, clientIp } from '../_lib/rateLimit.js'
import { getSupabaseAdmin } from '../_supabaseAdmin.js'
import { getApnsConfig, sendApnsNotification } from '../_lib/apns.js'

export const maxDuration = 10

const SECTIONS = new Set(['Mañana', 'Tarde', 'Noche'])
const ICONS = new Set([
  'auto_awesome', 'school', 'work', 'fitness_center', 'restaurant',
  'event', 'medical_services', 'flight', 'self_improvement', 'book',
])

function clampString(value, max) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function validateEvent(raw) {
  if (!raw || typeof raw !== 'object') return null
  const title = clampString(raw.title, 200)
  if (!title) return null
  const date = clampString(raw.date, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const time = clampString(raw.time, 32) || null
  const description = clampString(raw.description, 500) || null
  const section = SECTIONS.has(raw.section) ? raw.section : null
  const icon = ICONS.has(raw.icon) ? raw.icon : 'auto_awesome'
  return { title, date, time, description, section, icon }
}

function configureWebPush() {
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL || 'mailto:admin@focus.app'
  if (!pub || !priv) return false
  webpush.setVapidDetails(email, pub, priv)
  return true
}

// Envía notificaciones push (web + iOS) cuando Kairos envía una sugerencia.
// No falla si no hay subscripciones — solo intenta y continúa.
async function notifyUserAboutKairosSuggestion(admin, userId, suggestion) {
  try {
    const { preview_title, preview_body } = suggestion

    // Web Push — obtener suscripciones y enviar
    try {
      const { data: subs } = await admin
        .from('push_subscriptions')
        .select('endpoint, p256dh, auth')
        .eq('user_id', userId)

      if (subs && subs.length > 0 && configureWebPush()) {
        const payload = JSON.stringify({
          title: preview_title || 'Nueva sugerencia desde Kairos',
          body: preview_body || 'Revisa tu inbox en Focus',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/badge-72x72.png',
          data: {
            url: '/focus/inbox', // Ruta a Click
          },
        })

        for (const sub of subs) {
          try {
            await webpush.sendNotification(
              {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
              },
              payload
            )
          } catch (err) {
            if (err.statusCode === 410) {
              // Push subscription expirada — eliminar
              await admin
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint)
                .catch(() => {})
            }
          }
        }
      }
    } catch (webPushErr) {
      console.warn('[kairos/inbox] webpush error:', webPushErr?.message)
    }

    // iOS Push (APNs) — obtener tokens nativos y enviar
    try {
      const { data: nativeTokens } = await admin
        .from('native_push_tokens')
        .select('token, platform, environment, bundle_id')
        .eq('user_id', userId)
        .eq('platform', 'ios')

      if (nativeTokens && nativeTokens.length > 0) {
        const apnsConfig = getApnsConfig()
        if (apnsConfig.configured) {
          for (const row of nativeTokens) {
            try {
              await sendApnsNotification(
                {
                  token: row.token,
                  bundleId: row.bundle_id || apnsConfig.bundleId,
                  environment: row.environment || 'production',
                  jwt: null, // sendApnsNotification lo genera internamente
                },
                {
                  aps: {
                    alert: {
                      title: preview_title || 'Nueva sugerencia desde Kairos',
                      body: preview_body || 'Revisa tu inbox en Focus',
                    },
                    sound: 'default',
                    badge: 1,
                    'mutable-content': true,
                  },
                  data: {
                    url: '/focus/inbox',
                  },
                }
              )
            } catch (apnsErr) {
              console.warn('[kairos/inbox] apns error for token:', row.token, apnsErr?.message)
            }
          }
        }
      }
    } catch (nativeErr) {
      console.warn('[kairos/inbox] native push error:', nativeErr?.message)
    }
  } catch (err) {
    console.error('[kairos/inbox] notifyUserAboutKairosSuggestion:', err?.message)
    // No falla el endpoint — la notificación es best-effort
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res, { methods: 'POST, OPTIONS' })

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (rejectCrossSiteUnsafe(req, res)) return

  if (rateLimited(clientIp(req), { max: 60, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'rate_limit' })
  }

  const { focusCode, event } = req.body || {}
  const code = String(focusCode || '').trim().toUpperCase()
  if (!code || code.length < 4 || code.length > 32) {
    return res.status(400).json({ error: 'invalid_code' })
  }

  // Rate limit adicional por código: 30 sugerencias por hora por focusCode
  // protege al usuario aún si el atacante rota IPs.
  if (rateLimited(`kairos:${code}`, { max: 30, windowMs: 60 * 60_000 })) {
    return res.status(429).json({ error: 'rate_limit_code' })
  }

  const validated = validateEvent(event)
  if (!validated) return res.status(400).json({ error: 'invalid_event' })

  const admin = getSupabaseAdmin()
  if (!admin) return res.status(503).json({ error: 'no_supabase_admin' })

  try {
    const { data: link, error: linkErr } = await admin
      .from('kairos_links')
      .select('user_id')
      .eq('focus_code', code)
      .maybeSingle()
    if (linkErr || !link?.user_id) {
      // Devolvemos 404 sin pista del estado interno: si el código no existe
      // o nunca fue vinculado, la respuesta es la misma.
      return res.status(404).json({ error: 'unknown_code' })
    }

    const id = `kairos-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const previewParts = [validated.date]
    if (validated.time) previewParts.push(validated.time)
    previewParts.push('Kairos')

    const { error: insErr } = await admin.from('suggestions').insert({
      id,
      user_id:       link.user_id,
      kind:          'add_event',
      payload:       {
        title:       validated.title,
        date:        validated.date,
        time:        validated.time,
        description: validated.description,
        section:     validated.section,
        icon:        validated.icon,
        source:      'kairos',
      },
      preview_title: `Crear: ${validated.title}`,
      preview_body:  previewParts.join(' · '),
      preview_icon:  validated.icon,
      reason:        'Sugerencia recibida desde Kairos.',
      status:        'pending',
      batch_id:      `kairos-${validated.date}`,
    })
    if (insErr) {
      console.error('[kairos/inbox] insert failed:', insErr.message)
      return res.status(500).json({ error: 'insert_failed' })
    }

    // Dispara notificación push al usuario en paralelo (best-effort).
    // No bloquea la respuesta.
    const suggestion = {
      preview_title: `Crear: ${validated.title}`,
      preview_body: previewParts.join(' · '),
    }
    notifyUserAboutKairosSuggestion(admin, link.user_id, suggestion).catch(err => {
      console.error('[kairos/inbox] notification failed:', err?.message)
    })

    return res.status(200).json({ ok: true, suggestionId: id })
  } catch (err) {
    console.error('[kairos/inbox] unexpected:', err?.message || err)
    return res.status(500).json({ error: 'internal_error' })
  }
}
