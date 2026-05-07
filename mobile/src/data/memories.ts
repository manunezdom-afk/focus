// Port de src/services/dataService.js (memoryToDb/memoryFromDb +
// fetchMemories/upsertMemory/deleteMemory) para mobile. Tabla `user_memories`
// en Supabase, RLS por user_id = auth.uid().

import { supabase } from '../lib/supabase';

const VALID_CATEGORIES = new Set([
  'fact',
  'relationship',
  'preference',
  'goal',
  'pain',
  'routine',
  'context',
] as const);

export type MemoryCategory =
  | 'fact'
  | 'relationship'
  | 'preference'
  | 'goal'
  | 'pain'
  | 'routine'
  | 'context';

export type Memory = {
  id: string;
  category: MemoryCategory;
  subject: string | null;
  content: string;
  confidence: 'high' | 'medium' | 'low';
  source: 'conversation' | 'inferred' | 'user_edited';
  expiresAt: string | null;
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
  confidence: string | null;
  source: string | null;
  expires_at: string | null;
  pinned: boolean | null;
  created_at: string | null;
  last_seen_at: string | null;
};

function fromRow(row: MemoryRow): Memory {
  const cat = VALID_CATEGORIES.has(row.category as MemoryCategory)
    ? (row.category as MemoryCategory)
    : 'fact';
  const conf = ['high', 'medium', 'low'].includes(row.confidence ?? '')
    ? (row.confidence as Memory['confidence'])
    : 'medium';
  const src = ['conversation', 'inferred', 'user_edited'].includes(row.source ?? '')
    ? (row.source as Memory['source'])
    : 'conversation';
  return {
    id: row.id,
    category: cat,
    subject: row.subject,
    content: row.content,
    confidence: conf,
    source: src,
    expiresAt: row.expires_at,
    pinned: !!row.pinned,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at ?? new Date().toISOString(),
  };
}

// Filtro de expiración: si expires_at < hoy, ya no aplica.
function isExpired(m: MemoryRow): boolean {
  if (!m.expires_at) return false;
  const today = new Date().toISOString().slice(0, 10);
  return m.expires_at < today;
}

export async function fetchMemories(userId: string): Promise<Memory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('user_memories')
    .select(
      'id, user_id, category, subject, content, confidence, source, expires_at, pinned, created_at, last_seen_at',
    )
    .eq('user_id', userId)
    .order('pinned', { ascending: false })
    .order('last_seen_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).filter((r) => !isExpired(r as MemoryRow)).map((r) => fromRow(r as MemoryRow));
}
