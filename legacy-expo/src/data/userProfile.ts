import { supabase } from '../lib/supabase';

// Cliente para user_profiles. Por ahora solo manejamos nova_personality;
// el resto de campos (chronotype, role, timezone, quiet_hours) los irá
// agregando mobile cuando tengan UI dedicada.

export type NovaPersonality = 'focus' | 'cercana' | 'estrategica';

export type UserProfile = {
  id: string;
  novaPersonality: NovaPersonality;
};

type Row = {
  id: string;
  nova_personality: string | null;
};

function fromRow(row: Row): UserProfile {
  const np = row.nova_personality;
  const valid: NovaPersonality =
    np === 'cercana' || np === 'estrategica' ? np : 'focus';
  return { id: row.id, novaPersonality: valid };
}

export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, nova_personality')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    // Sin row aún (usuario nuevo): devolvemos default. La primera escritura
    // hará upsert con onConflict='id'.
    return { id: userId, novaPersonality: 'focus' };
  }
  return fromRow(data as Row);
}

export async function updateNovaPersonality(
  userId: string,
  personality: NovaPersonality,
): Promise<void> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { error } = await supabase
    .from('user_profiles')
    .upsert(
      { id: userId, nova_personality: personality },
      { onConflict: 'id' },
    );
  if (error) throw error;
}
