import { supabase } from './supabase';

// Origen por defecto: producción Vercel. Sobreescribible con
// EXPO_PUBLIC_API_ORIGIN para apuntar a un deployment de preview o a
// localhost cuando se desarrolla la API en paralelo.
const DEFAULT_API_ORIGIN = 'https://www.usefocus.me';

function apiOrigin(): string {
  return String(process.env.EXPO_PUBLIC_API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/$/, '');
}

export function apiUrl(path: string): string {
  const value = String(path || '');
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith('/api/')) return value;
  return `${apiOrigin()}${value}`;
}

// Mismo timeout que el cliente web — focus-assistant puede tardar ~45s con
// maxDuration=60 en Vercel. 55s deja margen sin colgar al usuario para
// siempre si la red se cae.
const DEFAULT_TIMEOUT_MS = 55_000;

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
};

// apiFetch es el wrapper que se debe usar para hablar con los endpoints de
// Vercel. Inyecta automáticamente el Bearer token de la sesión Supabase
// actual cuando el caller no setea Authorization manualmente. Espejo del
// patrón de src/lib/apiClient.js de la app web — si cambia el contrato del
// backend, actualizar ambos.
export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs, signal: callerSignal, headers: callerHeaders, ...rest } = options;
  const headers = new Headers(callerHeaders || {});

  if (!headers.has('Authorization') && !headers.has('authorization')) {
    try {
      const session = (await supabase?.auth.getSession())?.data?.session;
      const token = session?.access_token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch {
      // Sin sesión válida: el endpoint responderá 401 si requiere auth.
      // Para endpoints públicos (auth/email/send-otp) no pasa nada.
    }
  }

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);
  if (callerSignal) {
    if (callerSignal.aborted) ctrl.abort();
    else callerSignal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }

  try {
    return await fetch(apiUrl(path), { ...rest, headers, signal: ctrl.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export type SendOtpResponse = { ok: true } | { error: string };

export async function sendOtp(email: string): Promise<SendOtpResponse> {
  const resp = await apiFetch('/api/auth/email/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  let body: any = null;
  try {
    body = await resp.json();
  } catch {
    body = null;
  }
  if (!resp.ok) {
    return { error: body?.error || `http_${resp.status}` };
  }
  return body || { ok: true };
}
