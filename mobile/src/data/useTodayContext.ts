import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchTodayContext, type TodayContext } from './todayContext';

// Hook que fetcha /api/today-context cada vez que la pantalla gana foco.
// El backend cachea el clima 30min internamente; el cliente puede llamar
// libre sin preocuparse por el costo.
export function useTodayContext() {
  const [data, setData] = useState<TodayContext | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchTodayContext({ location: null });
    setData(result);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { data, loading, reload: load };
}
