// IDs de tasks/events en formato compatible con la web.
// La web usa `tsk-${crypto.randomUUID()}` y `evt-${Date.now()}-${rand}`. En RN
// con Hermes `crypto.randomUUID()` puede no estar disponible — fallback a
// timestamp + random base36. La unicidad viene del timestamp en ms; el sufijo
// random cubre el caso de varios IDs en el mismo tick.

function randomSlug(len = 8): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

export function newTaskId(): string {
  // Mismo prefijo que la web para que sea evidente al inspeccionar la tabla
  // que la fila vino del cliente y no de un sistema externo.
  return `tsk-${Date.now()}-${randomSlug(8)}`;
}

export function newEventId(): string {
  return `evt-${Date.now()}-${randomSlug(8)}`;
}
