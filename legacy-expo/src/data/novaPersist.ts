import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChatMessage } from './nova';

const KEY_PREFIX = 'nova_history_v1:';
const MAX_MESSAGES = 30;

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

// Sanitiza el array antes de persistir: descarta placeholders, errores y
// mensajes vacíos. Recortamos a los últimos N para no inflar AsyncStorage.
function sanitize(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.status !== 'sending' && m.content?.trim())
    .slice(-MAX_MESSAGES);
}

export async function loadNovaHistory(userId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m: any) =>
          m &&
          typeof m === 'object' &&
          typeof m.id === 'string' &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string',
      )
      .map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: typeof m.createdAt === 'number' ? m.createdAt : Date.now(),
        status: m.status === 'error' ? 'error' : 'sent',
        appliedActions: Array.isArray(m.appliedActions) ? m.appliedActions : undefined,
      })) as ChatMessage[];
  } catch {
    return [];
  }
}

export async function saveNovaHistory(userId: string, messages: ChatMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(sanitize(messages)));
  } catch {
    // Silencioso: si AsyncStorage falla, perdemos solo persistencia, no
    // funcionalidad. El usuario seguirá viendo el historial en memoria.
  }
}

export async function clearNovaHistory(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // ignore
  }
}
