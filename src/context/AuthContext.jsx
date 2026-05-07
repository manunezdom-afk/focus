import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { supabase } from '../lib/supabase'
import { dataService } from '../services/dataService'
import { setSignalsUserId, flushSignalsQueue } from '../services/signalsService'
import { fetchBehavior } from '../services/behaviorAnalysis'
import { apiFetch } from '../lib/apiClient'
import { flushPendingSubscription, subscribeToPush, getPushStatus } from '../lib/pushSubscription'
import { flushPendingNativeToken, getNativePushStatus, registerNativePush } from '../lib/nativePush'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [authModal, setAuthModal] = useState(false)
  // Cuando Supabase emite PASSWORD_RECOVERY (al abrir el link del correo),
  // marcamos el flag para que la UI muestre el form de "nueva contraseña"
  // antes que cualquier otra cosa. Se desmarca al hacer updatePassword
  // exitoso o al cerrar el modal explícitamente.
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    if (!supabase) { setLoading(false); return }

    // Sincroniza colas que pueden haber quedado pendientes entre sesiones:
    // escrituras offline, señales, suscripción push y modelo de behavior.
    // Se llama tanto al SIGNED_IN de un login nuevo como al hidratar una
    // sesión ya existente (getSession). Antes sólo corría en SIGNED_IN,
    // así que al abrir la app con sesión persistida las cosas quedaban
    // en la cola hasta que el usuario interactuara con la red.
    async function syncOnSession(u, { freshLogin }) {
      try {
        if (freshLogin) {
          // Al login nuevo limpiamos las claves globales (sin userId) para
          // que cualquier caché residual de una sesión anterior no se
          // muestre como datos del usuario recién entrado.
          dataService.clearGlobalCache()
        }
        await dataService.flushQueue()
        await flushSignalsQueue()
        await fetchBehavior(u.id).catch(() => {})
        await flushPendingSubscription().catch(() => {})
        await flushPendingNativeToken().catch(() => {})
        const native = await getNativePushStatus().catch(() => null)
        if (native?.supported && native.permission === 'granted') {
          await registerNativePush({ prompt: false }).catch(() => {})
        }
        const s = await getPushStatus()
        if (s.supported && s.permission === 'granted' && !s.subscribed) {
          await subscribeToPush().catch(() => {})
        }
      } catch (err) {
        console.warn('[Focus] session sync falló:', err)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const current = session?.user ?? null
      setUser(current)
      setSignalsUserId(current?.id ?? null)
      if (current) {
        fetchBehavior(current.id).catch(() => {})
        // Sesión ya existente al abrir la app: sincronizar colas.
        syncOnSession(current, { freshLogin: false })
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const newUser = session?.user ?? null
        setUser(newUser)
        setSignalsUserId(newUser?.id ?? null)
        if (event === 'PASSWORD_RECOVERY') {
          // Llegó al app desde un link de "olvidé mi contraseña". Forzamos
          // el modal abierto en el paso de "nueva contraseña" antes de hacer
          // sync de nada — el usuario debe setear su nueva password primero.
          setRecoveryMode(true)
          setAuthModal(true)
          return
        }
        if (event === 'SIGNED_IN' && newUser) {
          await syncOnSession(newUser, { freshLogin: true })
        }
        if (event === 'SIGNED_OUT') {
          setRecoveryMode(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Deep-link OAuth callback para Google en app nativa (Capacitor).
  // Escucha me.usefocus.app://login-callback?code=... y cierra la sesión.
  // Tras canjear el code por session, cerramos el Safari View Controller
  // que abrió signInWithGoogle — sin esto el usuario se quedaría con el
  // Safari encima de la app aunque ya hubiera vuelto autenticado.
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !supabase) return
    let handle
    CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith('me.usefocus.app://login-callback')) return
      const { data, error } = await supabase.auth.exchangeCodeForSession(url)
      if (!error && data?.session?.user) setUser(data.session.user)
      try {
        const { Browser } = await import('@capacitor/browser')
        await Browser.close()
      } catch {
        // Si el plugin no está disponible (escenario raro), seguimos: la
        // sesión ya está abierta y el usuario puede cerrar Safari manual.
      }
    }).then(h => { handle = h })
    return () => { handle?.remove() }
  }, [])

  // Sync cola offline al recuperar red
  useEffect(() => {
    const handleOnline = () => {
      if (user) dataService.flushQueue()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [user])

  const signInWithEmail = useCallback(async (email) => {
    // Flujo OTP-only via /api/auth/email/send-otp: el backend genera el
    // código con admin.generateLink y lo manda por Resend desde nuestro
    // dominio. No usamos supabase.auth.signInWithOtp porque el SMTP por
    // defecto de Supabase tiene rate-limit de ~3-4/h y cae a Spam.
    const clean = String(email || '').trim().toLowerCase()
    let r
    try {
      r = await apiFetch('/api/auth/email/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: clean }),
      })
    } catch {
      throw new Error('network')
    }
    if (r.status === 429) {
      const err = new Error('rate limit exceeded')
      err.status = 429
      throw err
    }
    if (!r.ok) {
      const body = await r.json().catch(() => ({}))
      throw new Error(body?.error || 'send_otp_failed')
    }
  }, [])

  const signInWithPassword = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Supabase no configurado')
    const clean = String(email || '').trim().toLowerCase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: clean,
      password: String(password ?? ''),
    })
    if (error) throw error
    return data?.user ?? null
  }, [])

  // Si Supabase tiene email confirmation activado, data.session viene null
  // y el usuario debe abrir el link del correo antes de poder loguearse.
  // Devolvemos {user, session} para que la UI pueda mostrar el mensaje
  // "Revisa tu correo" en ese caso.
  // El nombre se guarda en user_metadata.name (nullable). Si Supabase tiene
  // una tabla profiles con trigger on_auth_user_created, se puede leer ahí.
  const signUpWithPassword = useCallback(async (email, password, options = {}) => {
    if (!supabase) throw new Error('Supabase no configurado')
    const clean = String(email || '').trim().toLowerCase()
    const name = String(options?.name ?? '').trim()
    const emailRedirectTo = Capacitor.isNativePlatform()
      ? 'me.usefocus.app://login-callback'
      : (typeof window !== 'undefined' ? `${window.location.origin}/?confirmed=1` : undefined)
    const { data, error } = await supabase.auth.signUp({
      email: clean,
      password: String(password ?? ''),
      options: {
        emailRedirectTo,
        data: name ? { name } : undefined,
      },
    })
    if (error) throw error
    return { user: data?.user ?? null, session: data?.session ?? null }
  }, [])

  // Reset password: envía un email con link al endpoint /reset-password de la
  // app. El link abre la app con el token en URL hash que Supabase intercepta
  // automáticamente (detectSessionInUrl: true) y deja al usuario logueado en
  // estado "PASSWORD_RECOVERY", momento en el que la UI le pide setear nueva
  // contraseña. Para nativo (Capacitor) usamos el deep link de la app.
  const resetPasswordForEmail = useCallback(async (email) => {
    if (!supabase) throw new Error('Supabase no configurado')
    const clean = String(email || '').trim().toLowerCase()
    const redirectTo = Capacitor.isNativePlatform()
      ? 'me.usefocus.app://login-callback?recovery=1'
      : (typeof window !== 'undefined' ? `${window.location.origin}/?recovery=1` : undefined)
    const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo })
    if (error) throw error
  }, [])

  // Update password durante el flujo PASSWORD_RECOVERY o cualquier sesión
  // activa. Supabase requiere que el usuario esté autenticado (recovery token
  // counts) para llamar updateUser.
  const updatePassword = useCallback(async (newPassword) => {
    if (!supabase) throw new Error('Supabase no configurado')
    const { error } = await supabase.auth.updateUser({ password: String(newPassword ?? '') })
    if (error) throw error
  }, [])

  const verifyOtp = useCallback(async (email, token) => {
    if (!supabase) throw new Error('Supabase no configurado')
    const cleanEmail = String(email || '').trim().toLowerCase()
    // 10 dígitos de margen: Supabase puede estar configurado a 6 u 8.
    // Truncar a 6 acá invalidaba códigos de 8 dígitos antes de enviarlos.
    const cleanToken = String(token || '').replace(/\D/g, '').slice(0, 10)
    // La validación de longitud vive en el UI (AuthModal). Acá solo pasamos
    // a Supabase el valor limpio — si viniera corto, Supabase retorna su
    // propio error de token inválido, que humanizeAuthError ya mapea.
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    })
    if (error) throw error
    return data?.user || null
  }, [])

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Supabase no configurado')
    if (Capacitor.isNativePlatform()) {
      // Nativo iOS/Android: pedimos a Supabase el URL de OAuth con
      // skipBrowserRedirect=true (no queremos que el SDK toque el WebView
      // de Capacitor — eso sacaría al usuario de la app), y abrimos esa
      // URL con @capacitor/browser. Browser.open() es la API oficial de
      // Capacitor para abrir Safari View Controller (iOS) o Chrome Custom
      // Tabs (Android), que es donde DEBE vivir el flujo OAuth para que
      // Google reconozca al usuario y muestre su selector de cuenta.
      //
      // Antes usábamos window.open(url, '_system') que en Capacitor 8 sin
      // el plugin Browser instalado no abre nada de forma confiable — ese
      // era el bug "el botón se aprieta y no pasa nada en mobile". Con
      // Browser.open() + dismiss del callback, el flujo es atómico.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'me.usefocus.app://login-callback',
          skipBrowserRedirect: true,
        },
      })
      if (error) throw error
      if (!data?.url) throw new Error('OAuth URL no recibida del backend')
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: data.url, presentationStyle: 'popover' })
      // El cierre del Safari View Controller lo dispara appUrlOpen una vez
      // que Google redirige al deep link. Lo cerramos defensivamente acá
      // para que si algo en el flujo falla, el usuario no quede mirando
      // un Safari abierto sin volver a la app.
      // Browser.close() también lo llamamos desde appUrlOpen tras hacer
      // exchangeCodeForSession para garantizar el cierre.
    } else {
      // Web (incluye PWA mobile y desktop): NO usar skipBrowserRedirect.
      // Dejamos que Supabase haga `window.location.assign(url)` síncrono
      // al final de su flujo interno — eso preserva el user gesture y
      // evita que iOS Safari standalone bloquee la navegación. Antes la
      // implementación esperaba con await y luego intentaba window.open,
      // perdiendo el gesture y quedándose en blanco en mobile.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    // Limpiamos cualquier OTP pendiente: si quedó un code en sessionStorage
    // de una sesión anterior, al reabrir el login veríamos el paso 'code'
    // apuntando a un email que ya no corresponde. Limpiamos también el
    // cooldown por email para no heredarlo en el próximo login.
    try {
      sessionStorage.removeItem('focus_auth_pending')
      sessionStorage.removeItem('focus_auth_resend_until')
      sessionStorage.removeItem('focus_device_pairing')
    } catch {}
    // Borramos las claves globales (sin userId) de caché local. Los datos del
    // usuario que siguieron en estado React al salir ya no se persisten al
    // cierre y no pueden aparecer como "tareas pendientes" en el próximo login.
    dataService.clearGlobalCache()
  }, [])

  return (
    <AuthContext.Provider value={{
      user, loading, authModal, setAuthModal,
      recoveryMode, setRecoveryMode,
      signInWithEmail, verifyOtp, signOut,
      signInWithGoogle,
      signInWithPassword, signUpWithPassword,
      resetPasswordForEmail, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
