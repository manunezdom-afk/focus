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
    // Reusamos /api/focus-assistant con mode='today-context' para no exceder
    // el límite de 12 serverless functions del plan Hobby de Vercel.
    const res = await apiFetch('/api/focus-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'today-context',
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
