// Helpers de fecha en zona local. La tabla `events` usa `date` como string
// 'YYYY-MM-DD' (no timestamp), así que comparamos siempre como string en la
// misma zona del usuario — evita el bug clásico de "el evento de hoy aparece
// como ayer porque el server convirtió a UTC".

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function todayISO(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "lunes 4 de marzo" — para el header de Mi Día.
// Localizado en es-CO; si el sistema no soporta esa locale, Intl cae a la
// más cercana automáticamente (por eso no envolvemos en try/catch).
export function todayLabelLong(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

// "lun 4 mar" — para listas densas (ej. agrupador de Calendario).
export function dateLabelShort(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map((s) => parseInt(s, 10));
  if (!y || !m || !d) return dateISO;
  // Construir como hora local (mediodía evita líos de DST en bordes de día).
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dt);
}

export function isToday(dateISO: string | null): boolean {
  return !!dateISO && dateISO === todayISO();
}

// Suma `days` días a `dateISO`, devolviendo nuevo string ISO. Útil para
// generar "hoy + 7" en Calendario.
export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map((s) => parseInt(s, 10));
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  dt.setDate(dt.getDate() + days);
  return todayISO(dt);
}

// "JUEVES, 7 DE MAYO" — para el eyebrow del header de Mi Día (paridad legacy).
// Devuelve UPPERCASE sin diacríticos forzados (Intl ya respeta el locale).
export function dateEyebrow(date: Date = new Date()): string {
  const long = new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  // Convertir "jueves, 7 de mayo" → "JUEVES, 7 DE MAYO"
  // Algunos locales no añaden la coma — la insertamos manual entre weekday y day.
  const parts = long.split(' ');
  if (parts.length >= 2 && !long.includes(',')) {
    return `${parts[0]}, ${parts.slice(1).join(' ')}`.toUpperCase();
  }
  return long.toUpperCase();
}

// Devuelve { hours, minutes } restantes hasta `targetTime` (HH:MM 24h) hoy.
// Si la hora ya pasó, devuelve null. Útil para el countdown de "Próximo Bloque".
export function timeUntil(targetTime: string, now: Date = new Date()): { hours: number; minutes: number } | null {
  const m = targetTime.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const targetH = parseInt(m[1], 10);
  const targetM = parseInt(m[2], 10);
  const target = new Date(now);
  target.setHours(targetH, targetM, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const totalMin = Math.floor(diffMs / 60000);
  return { hours: Math.floor(totalMin / 60), minutes: totalMin % 60 };
}
