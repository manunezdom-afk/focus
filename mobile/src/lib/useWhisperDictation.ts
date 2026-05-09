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
 */
export function useWhisperDictation({ onFinal, onVolume }: Options) {
  const [state, _setState] = useState<WhisperState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Refs para evitar closures stale en callbacks/timers
  const stateRef = useRef<WhisperState>('idle');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Si la pantalla se desmonta a mitad de grabación, limpiamos recursos.
  useEffect(() => {
    return () => {
      clearTimers();
      const rec = recordingRef.current;
      if (rec) {
        recordingRef.current = null;
        try { rec.stopAndUnloadAsync(); } catch {}
      }
    };
  }, []);

  const stopInternal = useCallback(async () => {
    clearTimers();
    onVolumeRef.current?.(0);

    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return;

    setState('processing');
    let uri: string | null = null;

    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI() ?? null;
      if (!uri) throw new Error('No se generó el archivo de audio.');

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const res = await apiFetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType: 'audio/m4a' }),
        timeoutMs: 25_000,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.details || err?.error || `Error ${res.status}`);
      }

      const { text } = await res.json();
      if (text?.trim()) onFinalRef.current(text.trim());
      setState('idle');
    } catch (err: any) {
      setErrorMessage(err?.message || 'No pude transcribir. Intenta de nuevo.');
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    } finally {
      if (uri) {
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
      }
    }
  }, [setState]);

  const start = useCallback(async () => {
    const s = stateRef.current;
    if (s !== 'idle' && s !== 'error') return;
    setState('requesting');
    setErrorMessage(null);

    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setErrorMessage('Activa el micrófono en Ajustes para dictar a Nova.');
        setState('error');
        setTimeout(() => setState('idle'), 3000);
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

      // Límite de 60s para evitar archivos enormes
      autoStopRef.current = setTimeout(() => void stopInternal(), 60_000);
    } catch (err: any) {
      setErrorMessage(err?.message ?? 'No pude iniciar la grabación.');
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }, [setState, stopInternal]);

  const stop = useCallback(() => {
    if (stateRef.current !== 'recording') return;
    void stopInternal();
  }, [stopInternal]);

  return { state, errorMessage, start, stop };
}
