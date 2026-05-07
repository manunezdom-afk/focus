import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import { fetchMemories, type Memory } from './memories';

// Port simplificado de src/hooks/useUserMemories.js. Solo lectura por ahora
// — Nova las consume para enriquecer su prompt. Mutaciones (addMemory /
// togglePin / etc.) las dejamos para fase posterior cuando agreguemos un
// MemoryView mobile.
export function useUserMemories() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setMemories([]);
      setLoaded(true);
      return;
    }
    let mounted = true;
    fetchMemories(userId)
      .then((mems) => {
        if (!mounted) return;
        setMemories(mems);
        setLoaded(true);
      })
      .catch((err) => {
        if (!mounted) return;
        console.warn('[Focus] no se pudo cargar memorias:', err?.message);
        setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [userId]);

  return { memories, loaded };
}
