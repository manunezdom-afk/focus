// Port de src/services/dataService.js (profileToDb/profileFromDb +
// fetchProfile/upsertProfile) para mobile. Tabla `user_profiles` en Supabase.
//
// Misma columna `id` que el user.id (no separa por user_id), por eso se filtra
// por id directamente.

import { supabase } from '../lib/supabase';

export type UserProfile = {
  chronotype: string | null;
  role: string | null;
  setupDone: boolean;
  snoozedUntil: number | null;
  timezone: string;
};

type ProfileRow = {
  id: string;
  chronotype: string | null;
  role: string | null;
  setup_done: boolean | null;
  snoozed_until: number | null;
  timezone: string | null;
};

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export const DEFAULT_PROFILE: UserProfile = {
  chronotype: null,
  role: null,
  setupDone: false,
  snoozedUntil: null,
  timezone: detectTimezone(),
};

function fromRow(row: ProfileRow): UserProfile {
  return {
    chronotype: row.chronotype,
    role: row.role,
    setupDone: !!row.setup_done,
    snoozedUntil: row.snoozed_until,
    timezone: row.timezone || 'UTC',
  };
}

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, chronotype, role, setup_done, snoozed_until, timezone')
    .eq('id', userId)
    .maybeSingle();
  // PGRST116 = no rows found, no es error real
  if (error && (error as any).code !== 'PGRST116') throw error;
  if (!data) return null;
  return fromRow(data as ProfileRow);
}

export async function upsertProfile(profile: UserProfile, userId: string): Promise<void> {
  if (!supabase) return;
  const row = {
    id: userId,
    chronotype: profile.chronotype,
    role: profile.role,
    setup_done: profile.setupDone,
    snoozed_until: profile.snoozedUntil,
    timezone: profile.timezone || 'UTC',
  };
  const { error } = await supabase.from('user_profiles').upsert(row);
  if (error) throw error;
}
