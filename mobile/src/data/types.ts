// Forma "app" de los datos en mobile. Espejo simplificado de los converters
// `taskFromDb` / `eventFromDb` de src/services/dataService.js de la web — pero
// solo los campos que la Fase 2 mobile usa. Cuando agreguemos features
// (linkedEventId, parentTaskId, reminders, etc.) extender estos tipos antes
// de tocar las queries.

export type TaskPriority = 'Alta' | 'Media' | 'Baja';

export type Task = {
  id: string;
  label: string;
  done: boolean;
  priority: TaskPriority;
  category: string;
  doneAt: number | null;
  createdAt: string | null;
};

export type EventItem = {
  id: string;
  title: string;
  // Hora en formato "HH:MM" o rango "HH:MM - HH:MM" (24h). '' si no tiene hora.
  // Mismo string que escribe la web — no convertir a Date acá para no perder
  // el formato cuando el evento es solo de fecha o all-day.
  time: string;
  description: string;
  // 'focus' | 'rest' | 'personal' | etc. La web usa estos como buckets de
  // sección visual; en mobile lo dejamos pasar tal cual hasta que diseñemos
  // chips o filtros propios.
  section: string;
  icon: string;
  // 'YYYY-MM-DD' o null si el evento es flotante (no debería pasar — ver
  // useEvents.js de la web que defaultea a hoy).
  date: string | null;
  featured: boolean;
  createdAt: string | null;
};
