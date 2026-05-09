import { apiFetch } from '../lib/api';
import { todayISO, addDaysISO } from './today';

export type AmbientLevel = 'low' | 'medium' | 'high';

export type TodayContext = {
  ambient: AmbientLevel;
  summary: string;
  weather: string | null;
  flags: {
    urgentEvent: boolean;
    meetingsBackToBack: boolean;
    actionableInsight: boolean;
    freeHours: number;
  };
};

export type LocationCoords = { lat: number; lon: number; city?: string; country?: string };

export async function fetchTodayContext(opts: { location?: LocationCoords | null } = {}): Promise<TodayContext | null> {
  try {
    const today = todayISO();
    const tomorrow = addDaysISO(today, 1);
    const res = await apiFetch('/api/today-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        todayISO: today,
        tomorrowISO: tomorrow,
        location: opts.location ?? null,
        clientNow: Date.now(),
      }),
      timeoutMs: 10_000,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as TodayContext;
    return data;
  } catch {
    return null;
  }
}
