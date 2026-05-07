import { supabase } from '../lib/supabase';
import { todayISO } from './today';
import type { EventItem } from './types';

type EventRow = {
  id: string;
  user_id: string;
  title: string;
  time: string | null;
  description: string | null;
  section: string | null;
  icon: string | null;
  dot_color: string | null;
  date: string | null;
  featured: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function fromRow(row: EventRow): EventItem {
  return {
    id: row.id,
    title: row.title,
    time: row.time ?? '',
    description: row.description ?? '',
    section: row.section ?? 'focus',
    icon: row.icon ?? 'event',
    date: row.date,
    featured: !!row.featured,
    createdAt: row.created_at,
  };
}

// Fetch general — usado por Calendario para mostrar lista cronológica.
// Limitamos por seguridad: la tabla puede tener miles de eventos viejos del
// usuario web; no queremos descargar todo en mobile innecesariamente.
export async function fetchEvents(userId: string, opts: { limit?: number } = {}): Promise<EventItem[]> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { data, error } = await supabase
    .from('events')
    .select('id, user_id, title, time, description, section, icon, dot_color, date, featured, created_at, updated_at')
    .eq('user_id', userId)
    .order('date', { ascending: true, nullsFirst: false })
    .order('time', { ascending: true, nullsFirst: false })
    .limit(opts.limit ?? 200);
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as EventRow));
}

// Fetch acotado a un día concreto — usado por Mi Día. Filtramos en SQL en
// vez de en cliente porque la tabla puede tener mucho histórico.
export async function fetchEventsForDate(userId: string, dateISO: string): Promise<EventItem[]> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { data, error } = await supabase
    .from('events')
    .select('id, user_id, title, time, description, section, icon, dot_color, date, featured, created_at, updated_at')
    .eq('user_id', userId)
    .eq('date', dateISO)
    .order('time', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as EventRow));
}

export function fetchTodayEvents(userId: string): Promise<EventItem[]> {
  return fetchEventsForDate(userId, todayISO());
}

export type CreateEventInput = {
  title: string;
  date: string | null; // YYYY-MM-DD
  time: string | null; // "HH:MM" o "HH:MM-HH:MM"
  description?: string;
  section?: string;
  featured?: boolean;
};

// Crear evento — INSERT directo a la tabla. RLS exige user_id = auth.uid()
// así que también lo pasamos explícito (defensa en profundidad).
//
// Devolvemos el evento ya transformado a EventItem para que el caller pueda
// hacer optimistic update sin re-fetch.
export async function createEvent(userId: string, input: CreateEventInput): Promise<EventItem> {
  if (!supabase) throw new Error('supabase_not_configured');
  const insertRow = {
    user_id: userId,
    title: input.title.trim(),
    date: input.date,
    time: input.time,
    description: (input.description ?? '').trim() || null,
    section: input.section ?? 'focus',
    icon: 'event',
    featured: !!input.featured,
  };
  const { data, error } = await supabase
    .from('events')
    .insert(insertRow)
    .select('id, user_id, title, time, description, section, icon, dot_color, date, featured, created_at, updated_at')
    .single();
  if (error) throw error;
  return fromRow(data as EventRow);
}

// Borrar evento — solo si pertenece al usuario (RLS). El cliente filtra
// también por user_id como defensa en profundidad.
export async function deleteEvent(userId: string, id: string): Promise<void> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { error } = await supabase.from('events').delete().eq('user_id', userId).eq('id', id);
  if (error) throw error;
}
