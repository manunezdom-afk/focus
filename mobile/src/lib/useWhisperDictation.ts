import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from './api';

export type WhisperState = 'idle' | 'requesting' | 'recording' | 'processing' | 'error';

type Options = {
  onFinal: (text: string) => void;
  onVolume?: (level: number) => void;
};

/**
 * Hook de dictado usando OpenAI Whisper (mismo modelo que ChatGPT Voice).
 *
 * Flujo: tap mic → permiso → grabación con expo-av (m4a) → tap stop →
 * upload base64 a /api/transcribe → Whisper → texto en el draft.
 *
 * El callback onVolume recibe 0..1 cada 80ms (desde el metering dBFS del
 * recording) para alimentar el visualizador MicWaveform.
 *
 * Estados:
 *   idle        — listo para grabar
 *   requesting  — pidiendo permiso o iniciando grabación
 *   recording   — grabando audio + emitiendo metering
 *   processing  — subiendo + esperando Whisper
 *   error       — falla transitoria; vuelve a idle en 3s
 */
export function useWhisperDictation({ onFinal, onVolume }: Options) {
  const [state, _setState] = useState<WhisperState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs para evitar closures stale en callbacks/timers
  const stateRef = useRef<WhisperState>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const stoppingRef = useRef(false); // guard contra doble-stop (race tap user / autoStop)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFinalRef = useRef(onFinal);
  const onVolumeRef = useRef(onVolume);

  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);
  useEffect(() => { onVolumeRef.current = onVolume; }, [onVolume]);

  const setState = useCallback((s: WhisperState) => {
    stateRef.current = s;
    _setState(s);
  }, []);

  const clearTimers = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
  };

  const scheduleErrorReset = useCallback((message: string) => {
    setErrorMessage(message);
    setState('error');
    if (errorClearRef.current) clearTimeout(errorClearRef.current);
    errorClearRef.current = setTimeout(() => {
      setState('idle');
      setErrorMessage(null);
      errorClearRef.current = null;
    }, 3500);
  }, [setState]);

  // Devuelve siempre el modo de audio a "no grabando" para que la próxima
  // sesión arranque limpia y no quede el iPhone con el micrófono activo.
  const releaseAudioMode = async () => {
    try { await Audio.setAudioModeAsync({ allowsRecordingIOS: false }); } catch {}
  };

  // Si la pantalla se desmonta a mitad de grabación, limpiamos recursos.
  useEffect(() => {
    return () => {
      clearTimers();
      if (errorClearRef.current) clearTimeout(errorClearRef.current);
      const rec = recordingRef.current;
      if (rec) {
        recordingRef.current = null;
        try { rec.stopAndUnloadAsync().catch(() => {}); } catch {}
      }
      void releaseAudioMode();
    };
  }, []);

  const stopInternal = useCallback(async () => {
    // Guard contra doble-llamada: el autoStopRef + tap del usuario pueden
    // dispararse en el mismo frame si la grabación llegó al límite justo
    // cuando el usuario presionó stop.
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    clearTimers();
    onVolumeRef.current?.(0);

    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) {
      stoppingRef.current = false;
      return;
    }

    setState('processing');
    let uri: string | null = null;

    try {
      try {
        await recording.stopAndUnloadAsync();
      } catch {
        // stopAndUnload puede fallar si la grabación ya estaba descargada
        // (race con autoStop). Seguimos: el URI puede seguir siendo válido.
      }
      uri = recording.getURI() ?? null;
      await releaseAudioMode();

      if (!uri) {
        scheduleErrorReset('No pude guardar el audio. Intenta de nuevo.');
        return;
      }

      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || (typeof info.size === 'number' && info.size === 0)) {
        scheduleErrorReset('No grabé audio. Habla más cerca y vuelve a intentar.');
        return;
      }

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const res = await apiFetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType: 'audio/m4a' }),
        timeoutMs: 25_000,
      });

      if (!res.ok) {
        // Errores con copy específico: cuota, no internet, mic apagado en
        // backend. Cualquier otro fallo se muestra genérico.
        let payload: any = null;
        try { payload = await res.json(); } catch {}
        if (res.status === 429 && payload?.error === 'quota_exceeded') {
          scheduleErrorReset(payload.message || 'Llegaste al límite diario de dictado.');
          return;
        }
        if (res.status === 401) {
          scheduleErrorReset('Necesitas iniciar sesión para dictar a Nova.');
          return;
        }
        if (res.status === 422 && payload?.error === 'empty_transcript') {
          scheduleErrorReset('No escuché nada. Habla más cerca del iPhone.');
          return;
        }
        if (res.status === 413) {
          scheduleErrorReset('La grabación es muy larga. Intenta menos de 1 minuto.');
          return;
        }
        scheduleErrorReset('No pude transcribir. Intenta de nuevo.');
        return;
      }

      const { text } = await res.json();
      if (typeof text === 'string' && text.trim()) {
        onFinalRef.current(text.trim());
        setState('idle');
        setErrorMessage(null);
      } else {
        scheduleErrorReset('No escuché nada. Habla más cerca del iPhone.');
      }
    } catch (err: any) {
      // err.name === 'AbortError' → timeout del fetch (25s)
      const isTimeout = err?.name === 'AbortError';
      scheduleErrorReset(
        isTimeout
          ? 'La transcripción tardó demasiado. Verifica tu conexión.'
          : 'No pude transcribir. Intenta de nuevo.',
      );
    } finally {
      stoppingRef.current = false;
      if (uri) {
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
      }
    }
  }, [setState, scheduleErrorReset]);

  const start = useCallback(async () => {
    const s = stateRef.current;
    if (s !== 'idle' && s !== 'error') return;
    setState('requesting');
    setErrorMessage(null);
    if (errorClearRef.current) {
      clearTimeout(errorClearRef.current);
      errorClearRef.current = null;
    }

    try {
      const { granted, canAskAgain } = await Audio.requestPermissionsAsync();
      if (!granted) {
        // Si canAskAgain es false el usuario rechazó "no preguntar más" —
        // la única salida es abrir Ajustes (el composer escucha esa frase
        // y abre Alert con botón a Ajustes).
        const message = canAskAgain
          ? 'Activa el micrófono para dictar a Nova.'
          : 'Activa el micrófono en Ajustes para dictar a Nova.';
        scheduleErrorReset(message);
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });
      recordingRef.current = recording;
      setState('recording');

      // Polling de metering cada 80ms → MicWaveform
      pollRef.current = setInterval(async () => {
        try {
          const status = await recording.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            // dBFS −160..0. Habla normal ≈ −40..−10, silencio ≈ −60..−40
            const norm = Math.max(0, Math.min(1, (status.metering + 55) / 45));
            onVolumeRef.current?.(norm);
          }
        } catch {}
      }, 80);

      // Límite de 60s — más que eso es muy probable que sea ruido o un
      // dictado donde el usuario olvidó cortar; además protege el límite
      // de payload base64 del endpoint.
      autoStopRef.current = setTimeout(() => void stopInternal(), 60_000);
    } catch (err: any) {
      await releaseAudioMode();
      scheduleErrorReset(err?.message ?? 'No pude iniciar la grabación.');
    }
  }, [setState, stopInternal, scheduleErrorReset]);

  const stop = useCallback(() => {
    if (stateRef.current !== 'recording') return;
    void stopInternal();
  }, [stopInternal]);

  return { state, errorMessage, start, stop };
}
