// Servicio de reconocimiento de voz on-device para Focus.
//
// Usa expo-speech-recognition (jamsch) que en iOS encapsula
// SFSpeechRecognizer de Apple — sin envío a servidor, sin costos de
// transcripción, sin necesidad de APIs externas. La voz se transcribe
// localmente en el iPhone y el texto vuelve al cliente.
//
// Por qué lazy require:
//   El binario instalado puede o no tener el módulo nativo linkeado.
//   Importar a top-level haría crash en boot si la lib no está. Con
//   lazy require + try/catch, isAvailable() permite degradar UI:
//   "Dictado no disponible · requiere reinstalar" hasta que el usuario
//   haga `npm install && pod install && Cmd+R en Xcode`.
//
// Permisos requeridos en iOS (ya en Info.plist + plugin de app.json):
//   - NSMicrophoneUsageDescription
//   - NSSpeechRecognitionUsageDescription

let _Voice: any | null | undefined;
let _voiceLoadError: string | null = null;

function loadVoice(): any | null {
  if (_Voice !== undefined) return _Voice;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _Voice = require('expo-speech-recognition');
    return _Voice;
  } catch (err: any) {
    _Voice = null;
    _voiceLoadError = err?.message ?? 'unknown';
    if (__DEV__) {
      console.warn('[voice] expo-speech-recognition no disponible:', _voiceLoadError);
    }
    return null;
  }
}

export function isAvailable(): boolean {
  return loadVoice() !== null;
}

export function getLoadError(): string | null {
  loadVoice();
  return _voiceLoadError;
}

export type VoicePermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/**
 * Pide los 2 permisos necesarios en iOS: micrófono + reconocimiento de
 * voz. Devuelve granted solo si ambos quedaron concedidos.
 */
export async function requestVoicePermissions(): Promise<VoicePermissionStatus> {
  const V = loadVoice();
  if (!V?.ExpoSpeechRecognitionModule?.requestPermissionsAsync) return 'unavailable';
  try {
    const result = await V.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (result?.granted) return 'granted';
    if (result?.canAskAgain === false || result?.status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export async function getVoicePermissionStatus(): Promise<VoicePermissionStatus> {
  const V = loadVoice();
  if (!V?.ExpoSpeechRecognitionModule?.getPermissionsAsync) return 'unavailable';
  try {
    const result = await V.ExpoSpeechRecognitionModule.getPermissionsAsync();
    if (result?.granted) return 'granted';
    if (result?.canAskAgain === false || result?.status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export type VoiceListener = {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (code: string, message: string) => void;
  onEnd?: () => void;
};

/**
 * Inicia una sesión de reconocimiento. Devuelve una función `stop()` que
 * el caller debe llamar cuando termine (timeout, cancelación, o el usuario
 * suelta el botón). El listener `onFinal` recibe el texto definitivo
 * cuando el motor decide cerrar el utterance.
 *
 * Idioma: 'es-MX' por default — coincide con el copy en español neutral
 * que usamos en toda la app.
 */
export function startListening(listener: VoiceListener, options?: {
  locale?: string;
  interimResults?: boolean;
}): () => void {
  const V = loadVoice();
  if (!V) {
    listener.onError('unavailable', 'El módulo de voz no está disponible. Requiere reinstalar la app.');
    return () => {};
  }

  const { ExpoSpeechRecognitionModule } = V;

  // expo-speech-recognition v3 eliminó addSpeechRecognitionListener.
  // Los eventos se suscriben directamente en el native module vía .addListener.
  if (!ExpoSpeechRecognitionModule?.addListener) {
    listener.onError('unavailable', 'El módulo de voz no está disponible. Reinstala la app.');
    return () => {};
  }

  const subs: { remove: () => void }[] = [];
  const cleanup = () => {
    for (const s of subs) {
      try {
        s.remove();
      } catch {
        // ignore
      }
    }
  };

  try {
    subs.push(
      ExpoSpeechRecognitionModule.addListener('result', (event: any) => {
        // event.results: [{ transcript, confidence }]
        const transcript = event?.results?.[0]?.transcript?.trim?.() ?? '';
        if (!transcript) return;
        if (event?.isFinal) {
          listener.onFinal(transcript);
        } else if (listener.onPartial) {
          listener.onPartial(transcript);
        }
      }),
    );
    subs.push(
      ExpoSpeechRecognitionModule.addListener('error', (event: any) => {
        const code = event?.error ?? 'unknown';
        const message = event?.message ?? 'No pude escuchar.';
        listener.onError(String(code), String(message));
      }),
    );
    subs.push(
      ExpoSpeechRecognitionModule.addListener('end', () => {
        listener.onEnd?.();
        cleanup();
      }),
    );

    ExpoSpeechRecognitionModule.start({
      lang: options?.locale ?? 'es-MX',
      interimResults: options?.interimResults ?? true,
      continuous: false,
      // En iOS por default ya usa device si está disponible (offline).
      // En cellular se usa server-side de Apple — privado, no nuestro server.
      requiresOnDeviceRecognition: false,
    });
  } catch (err: any) {
    cleanup();
    listener.onError('start_failed', err?.message ?? 'No pude iniciar el dictado.');
    return () => {};
  }

  return () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      // ignore
    }
    cleanup();
  };
}
