import { supabase } from '../lib/supabase';
import { newClientId } from './ids';

// User memories — datos persistentes que Nova aprende del usuario y reusa
// en futuras conversaciones. Mismo shape que la web (src/services/dataService.js).
//
// Tabla: user_memories
//   id, user_id, category, subject, content, confidence, source,
//   expires_at, pinned, last_seen_at, created_at
//
// RLS: SELECT/INSERT/UPDATE/DELETE solo sobre auth.uid() = user_id.

export type MemoryCategory =
  | 'fact'
  | 'relationship'
  | 'preference'
  | 'goal'
  | 'pain'
  | 'routine'
  | 'context';

export type MemoryConfidence = 'high' | 'medium' | 'low';

export type Memory = {
  id: string;
  category: MemoryCategory | string;
  subject: string | null;
  content: string;
  confidence: MemoryConfidence | string;
  source: string;
  expiresAt: string | null; // 'YYYY-MM-DD' o null
  pinned: boolean;
  createdAt: string | null;
  lastSeenAt: string;
};

type MemoryRow = {
  id: string;
  user_id: string;
  category: string;
  subject: string | null;
  content: string;
  confidence: string;
  source: string;
  expires_at: string | null;
  pinned: boolean | null;
  last_seen_at: string;
  created_at: string | null;
};

function fromRow(row: MemoryRow): Memory {
  return {
    id: row.id,
    category: row.category,
    subject: row.subject,
    content: row.content,
    confidence: row.confidence ?? 'medium',
    source: row.source ?? 'conversation',
    expiresAt: row.expires_at,
    pinned: !!row.pinned,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function fetchMemories(userId: string): Promise<Memory[]> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { data, error } = await supabase
    .from('user_memories')
    .select(
      'id, user_id, category, subject, content, confidence, source, expires_at, pinned, last_seen_at, created_at',
    )
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('last_seen_at', { ascending: false });
  if (error) throw error;
  const today = new Date().toISOString().slice(0, 10);
  return (data ?? [])
    .filter((r) => !r.expires_at || r.expires_at >= today)
    .map((r) => fromRow(r as MemoryRow));
}

export type CreateMemoryInput = {
  category: MemoryCategory | string;
  subject?: string | null;
  content: string;
  confidence?: MemoryConfidence | string;
  source?: string;
  expiresAt?: string | null;
  pinned?: boolean;
};

export async function upsertMemory(
  userId: string,
  input: CreateMemoryInput,
): Promise<Memory | null> {
  if (!supabase) throw new Error('supabase_not_configured');
  const id = newClientId();
  const row = {
    id,
    user_id: userId,
    category: input.category,
    subject: input.subject ?? null,
    content: input.content.trim(),
    confidence: input.confidence ?? 'medium',
    source: input.source ?? 'conversation',
    expires_at: input.expiresAt ?? null,
    pinned: !!input.pinned,
    last_seen_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('user_memories').upsert(row);
  if (error) throw error;
  return fromRow(row as unknown as MemoryRow);
}

export async function deleteMemory(userId: string, id: string): Promise<void> {
  if (!supabase) throw new Error('supabase_not_configured');
  const { error } = await supabase
    .from('user_memories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}
