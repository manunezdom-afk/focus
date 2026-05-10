import { supabase } from './supabase';

// Detecta errores de auth que se pueden recuperar refrescando el token.
// Caso típico: la app estuvo en background >1h, el access_token expiró,
// y la primera llamada a Supabase tira 401 antes de que startAutoRefresh
// haya tenido chance de correr. Refrescamos manualmente y reintentamos.
function isAuthError(err: any): boolean {
  if (!err) return false;
  const status: number | undefined = err.status ?? err?.response?.status;
  if (status === 401 || status === 403) return true;
  const code: string | undefined = err.code ?? err?.error_code;
  if (code === 'PGRST301' || code === 'PGRST302' || code === 'invalid_token') {
    return true;
  }
  const msg: string = String(err?.message ?? '');
  return /jwt|invalid_token|token.*expir|JWT expired|Invalid JWT/i.test(msg);
}

// Si el error es de auth, intenta refresh; devuelve true si refrescó OK.
async function tryRefreshSession(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.auth.refreshSession();
    if (error) {
      if (__DEV__) console.warn('[authRetry] refreshSession failed:', error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    if (__DEV__) console.warn('[authRetry] refreshSession threw:', e?.message);
    return false;
  }
}

// Wrapper genérico: corre `fn`. Si falla con auth error, refresca y retry una vez.
// Si la segunda intentona también falla, propaga ese error.
export async function withAuthRetry<T>(fn: () => Promise<T>, label = 'request'): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (!isAuthError(err)) {
      if (__DEV__) console.warn(`[${label}] failed:`, err?.message ?? err);
      throw err;
    }
    if (__DEV__) console.warn(`[${label}] auth error → trying refresh + retry`);
    const ok = await tryRefreshSession();
    if (!ok) throw err;
    return await fn();
  }
}
