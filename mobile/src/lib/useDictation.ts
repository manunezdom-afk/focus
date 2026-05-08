import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import {
  getVoicePermissionStatus,
  isAvailable as isVoiceAvailable,
  requestVoicePermissions,
  startListening,
  type VoicePermissionStatus,
} from './voice';

export type DictationState =
  | 'unavailable'
  | 'idle'
  | 'requesting'
  | 'denied'
  | 'listening'
  | 'error';

type Options = {
  // Callback que recibe el texto final cuando termina el utterance.
  // Padre lo usa para hacer setDraft(...) o append a un input controlado.
  onFinal: (text: string) => void;
  // Callback opcional para texto parcial mientras escucha — útil para
  // mostrar lo que el usuario va dictando en tiempo real.
  onPartial?: (text: string) => void;
};

/**
 * Hook único para botón "Dictar a Nova" en cualquier composer.
 *
 * Estado + acciones:
 *   - `available` — si el módulo nativo de voz está cargado.
 *   - `state` — máquina de estado simple (ver DictationState).
 *   - `errorMessage` — última razón humana de error.
 *   - `start()` — pide permiso si hace falta y arranca a escuchar.
 *   - `stop()`  — corta escuchar y dispara onFinal con lo que haya.
 *   - `openSystemSettings()` — atajo cuando el permiso quedó denied.
 *
 * Si el módulo nativo no está linkeado (binario sin rebuild post-install),
 * `available` queda false y `state` se queda en 'unavailable'. La UI
 * decide si mostrar un Alert con instrucciones o esconder el botón.
 */
export function useDictation({ onFinal, onPartial }: Options) {
  const available = isVoiceAvailable();
  const [state, setState] = useState<DictationState>(available ? 'idle' : 'unavailable');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const stopFnRef = useRef<(() => void) | null>(null);

  // Si la pantalla se desmonta a la mitad, cortamos para no dejar la
  // sesión de iOS Speech corriendo en background.
  useEffect(() => {
    return () => {
      if (stopFnRef.current) {
        try {
          stopFnRef.current();
        } catch {
          // ignore
        }
        stopFnRef.current = null;
      }
    };
  }, []);

  const start = useCallback(async () => {
    if (!available) {
      setState('unavailable');
      return;
    }
    if (state === 'listening' || state === 'requesting') return;

    setErrorMessage(null);
    setState('requesting');

    // Si el permiso ya está granted, no hace falta pedirlo de nuevo.
    let status: VoicePermissionStatus = await getVoicePermissionStatus();
    if (status !== 'granted') {
      status = await requestVoicePermissions();
    }
    if (status === 'denied') {
      setState('denied');
      return;
    }
    if (status === 'unavailable') {
      setState('unavailable');
      return;
    }
    if (status !== 'granted') {
      // 'undetermined' tras request → el usuario dismisseó el sheet
      setState('idle');
      return;
    }

    setState('listening');
    const stopFn = startListening({
      onPartial: (t) => onPartial?.(t),
      onFinal: (t) => {
        if (t.trim()) onFinal(t);
        setState('idle');
        stopFnRef.current = null;
      },
      onError: (_code, msg) => {
        setErrorMessage(msg);
        setState('error');
        stopFnRef.current = null;
      },
      onEnd: () => {
        // 'end' puede llegar después del 'result' final. Solo si seguimos
        // en listening (no movido a idle por onFinal), volvemos a idle.
        setState((prev) => (prev === 'listening' ? 'idle' : prev));
      },
    });
    stopFnRef.current = stopFn;
  }, [available, state, onFinal, onPartial]);

  const stop = useCallback(() => {
    if (stopFnRef.current) {
      stopFnRef.current();
      stopFnRef.current = null;
    }
    setState((prev) => (prev === 'listening' ? 'idle' : prev));
  }, []);

  const openSystemSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return {
    available,
    state,
    errorMessage,
    start,
    stop,
    openSystemSettings,
  };
}
