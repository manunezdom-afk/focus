// Port directo de src/utils/expandRecurrence.js. Expande una acción
// add_recurring_event de Nova en N eventos concretos con date asignada.
//
// Mantenemos los mismos defaults y MAX_OCCURRENCES que la web para que el
// comportamiento sea idéntico entre plataformas (Nova entrenada con el
// mismo guardrail).

import type { CreateEventInput } from '@/src/data/events';

const MAX_OCCURRENCES = 31;

const DEFAULT_COUNT: Record<string, number> = {
  daily: 30,
  weekdays: 22,
  weekly: 12,
};

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isValidISO(s: any): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function expandRecurrence(action: any): CreateEventInput[] {
  if (!action || action.type !== 'add_recurring_event') return [];
  const base = action.event;
  const rec = action.recurrence;
  if (!base || !rec || typeof rec.pattern !== 'string') return [];
  if (typeof base.title !== 'string' || !base.title.trim()) return [];

  const startISO = isValidISO(rec.startDate) ? rec.startDate : toISO(new Date());
  const start = parseISO(startISO);

  const defCount = DEFAULT_COUNT[rec.pattern] ?? 0;
  const rawCount = Number.isFinite(rec.count) ? rec.count : defCount;
  const count = Math.max(0, Math.min(MAX_OCCURRENCES, Math.floor(rawCount)));
  if (!count) return [];

  function build(date: string): CreateEventInput {
    return {
      title: base.title,
      time: typeof base.time === 'string' ? base.time : null,
      date,
      description: typeof base.description === 'string' ? base.description : undefined,
      section: typeof base.section === 'string' ? base.section : undefined,
    };
  }

  const events: CreateEventInput[] = [];

  if (rec.pattern === 'daily') {
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      events.push(build(toISO(d)));
    }
    return events;
  }

  if (rec.pattern === 'weekdays') {
    const d = new Date(start);
    while (events.length < count) {
      const wd = d.getDay();
      if (wd >= 1 && wd <= 5) {
        events.push(build(toISO(d)));
      }
      d.setDate(d.getDate() + 1);
    }
    return events;
  }

  if (rec.pattern === 'weekly') {
    const target =
      Number.isInteger(rec.weekday) && rec.weekday >= 0 && rec.weekday <= 6
        ? rec.weekday
        : start.getDay();
    const first = new Date(start);
    const offset = (target - start.getDay() + 7) % 7;
    first.setDate(start.getDate() + offset);
    for (let i = 0; i < count; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() + i * 7);
      events.push(build(toISO(d)));
    }
    return events;
  }

  return [];
}
