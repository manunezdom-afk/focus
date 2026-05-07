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
