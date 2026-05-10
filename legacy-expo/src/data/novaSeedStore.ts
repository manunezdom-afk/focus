// Prefill cross-tab para Nova. Cualquier pantalla puede setear un texto
// pendiente y al ganar foco la pantalla Nova lo consume y lo deja en el
// composer (no se auto-envía: el usuario revisa y manda).
//
// Patrón legacy: la web usaba sessionStorage. En mobile usamos un módulo
// in-memory con counter — más predecible que AsyncStorage para algo que se
// consume una sola vez y no necesita sobrevivir a reinicios.

type Listener = (seed: string | null) => void;

let _pending: string | null = null;
const _listeners = new Set<Listener>();

export function setNovaSeed(text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  _pending = trimmed;
  for (const l of _listeners) l(_pending);
}

// Lee y consume el seed pendiente. Devuelve null si no hay nada.
export function consumeNovaSeed(): string | null {
  if (_pending == null) return null;
  const text = _pending;
  _pending = null;
  for (const l of _listeners) l(null);
  return text;
}

export function peekNovaSeed(): string | null {
  return _pending;
}

export function subscribeNovaSeed(listener: Listener): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}
