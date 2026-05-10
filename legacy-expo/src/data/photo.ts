import { apiFetch } from '@/src/lib/api';

// Cliente del endpoint /api/analyze-photo (web ya lo usa en NovaWidget).
//
// Body: { images: [{ base64, mediaType }] }
// Response: { events: [{ title, date, time, ... }] } | error tipado.
//
// Errores tipados que respeta el backend:
//   - auth_required, quota_exceeded, no_api_key, invalid_image, ...

export type DetectedEvent = {
  title: string;
  date?: string | null;
  time?: string | null;
  description?: string | null;
};

export type AnalyzePhotoError = Error & { code?: string };

const ERROR_HUMAN: Record<string, string> = {
  auth_required: 'Inicia sesión para analizar fotos.',
  quota_exceeded: 'Llegaste al límite diario de fotos analizadas. Vuelve mañana.',
  invalid_image: 'No pude leer esa foto. Intenta con otra más clara.',
  no_api_key: 'Servicio no disponible en este momento.',
  rate_limit: 'Demasiadas fotos seguidas. Espera unos segundos.',
};

export async function analyzePhoto(opts: {
  base64: string;
  mediaType?: string;
}): Promise<DetectedEvent[]> {
  const { base64, mediaType = 'image/jpeg' } = opts;
  const res = await apiFetch('/api/analyze-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: [{ base64, mediaType }] }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code: string = data?.error;
    const humanMsg =
      code === 'quota_exceeded' && data?.message
        ? data.message
        : ERROR_HUMAN[code] ?? data?.message ?? `Error ${res.status}`;
    const err = new Error(humanMsg) as AnalyzePhotoError;
    err.code = code;
    throw err;
  }
  const evs = Array.isArray(data?.events) ? data.events : [];
  return evs
    .filter((e: any) => e && typeof e.title === 'string' && e.title.trim())
    .map((e: any) => ({
      title: e.title,
      date: typeof e.date === 'string' ? e.date : null,
      time: typeof e.time === 'string' ? e.time : null,
      description: typeof e.description === 'string' ? e.description : null,
    }));
}
