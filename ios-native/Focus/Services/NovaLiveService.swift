import Foundation
import Speech
import AVFoundation

/// Voz a texto para Nova Live V1. Usa `SFSpeechRecognizer` + `AVAudioEngine`
/// para capturar audio del micrófono y transcribirlo en tiempo real.
///
/// Scope V1:
/// - Solo voz → texto. NO hay respuesta hablada (TTS).
/// - NO hay streaming full-duplex tipo Live API.
/// - Locale preferido `es_CL`, fallback `es_ES`, fallback default del device.
/// - El caller decide cuándo `start()` y `stop()`. La transcripción final
///   se entrega cuando el caller invoca `stop()` o el reconocedor emite el
///   resultado `isFinal`.
///
/// Permisos: el caller llama `requestAuthorization()` antes de `start()`.
/// Si rechaza, `start()` no hace nada y `state` queda en `.denied`.
///
/// Privacidad: el audio se procesa preferentemente on-device cuando el
/// modelo del idioma lo soporta. Si no, iOS envía a Apple para
/// reconocimiento — el usuario ya acepta esto al dar permiso de Speech.
/// Nunca enviamos audio al backend Focus.
@MainActor
final class NovaLiveService: ObservableObject {

    /// Estados visibles para Nova Live View.
    enum State: Equatable {
        case idle
        case requestingPermissions
        case listening
        case processing      // tras stop, esperando finalización del recognizer
        case error(String)
        case denied
    }

    @Published var state: State = .idle
    @Published var transcript: String = ""

    // MARK: - Internals

    private let recognizer: SFSpeechRecognizer?
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    /// Locale efectivo que usamos (para diagnóstico/UI). Resuelto en init.
    let activeLocaleIdentifier: String

    /// Cuántos segundos de silencio toleramos antes de auto-detener.
    /// 8s es generoso para alguien que piensa entre frases.
    private static let silenceTimeoutSeconds: Int = 8

    /// Timer monotónico para detectar silencio. Lo reseteamos cada vez que
    /// llega texto nuevo del reconocedor.
    private var lastSpeechAt: Date?
    private var silenceCheckTask: Task<Void, Never>?

    init() {
        // Preferir es-CL para entonación natural; si no está disponible,
        // caer a es-ES (España) que SÍ está garantizado en iOS. Si tampoco,
        // recognizer default del sistema (probablemente en_US, pero al menos
        // no es nil).
        let preferred = SFSpeechRecognizer(locale: Locale(identifier: "es_CL"))
        let fallbackES = SFSpeechRecognizer(locale: Locale(identifier: "es_ES"))
        let any = SFSpeechRecognizer()
        let chosen = preferred ?? fallbackES ?? any
        self.recognizer = chosen
        self.activeLocaleIdentifier = chosen?.locale.identifier ?? "unavailable"
    }

    // MARK: - Permission flow

    /// Pide los DOS permisos necesarios en orden: Speech Recognition + Micrófono.
    /// Devuelve `true` solo si ambos quedan autorizados.
    func requestAuthorization() async -> Bool {
        state = .requestingPermissions
        // Speech recognition primero — si el usuario lo deniega, no
        // tiene sentido pedir mic.
        let speechStatus = await Self.requestSpeechRecognitionAuthorization()
        guard speechStatus == .authorized else {
            state = .denied
            return false
        }
        let micGranted = await Self.requestMicrophonePermission()
        guard micGranted else {
            state = .denied
            return false
        }
        state = .idle
        return true
    }

    /// Estado combinado: si CUALQUIERA de los dos no está autorizado, lo
    /// tratamos como denied/notDetermined. La UI lo usa para mostrar el
    /// botón correcto ("Activar" vs "Abrir Ajustes").
    func currentAuthorizationStatus() async -> AuthorizationCombined {
        let speech = SFSpeechRecognizer.authorizationStatus()
        let mic = AVAudioApplication.shared.recordPermission
        if speech == .authorized && mic == .granted {
            return .authorized
        }
        if speech == .denied || speech == .restricted || mic == .denied {
            return .denied
        }
        return .notDetermined
    }

    enum AuthorizationCombined {
        case authorized
        case denied
        case notDetermined
    }

    private static func requestSpeechRecognitionAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { cont in
            SFSpeechRecognizer.requestAuthorization { status in
                cont.resume(returning: status)
            }
        }
    }

    private static func requestMicrophonePermission() async -> Bool {
        await withCheckedContinuation { cont in
            AVAudioApplication.requestRecordPermission { granted in
                cont.resume(returning: granted)
            }
        }
    }

    // MARK: - Listening

    /// Arranca la captura + transcripción. Asume permisos ya autorizados —
    /// si no lo están, devuelve error y deja `state = .denied`.
    func start() async {
        // Si veníamos de un error previo, limpiar.
        transcript = ""

        let auth = await currentAuthorizationStatus()
        guard auth == .authorized else {
            state = .denied
            return
        }

        guard let recognizer, recognizer.isAvailable else {
            state = .error("Reconocimiento de voz no disponible en este momento.")
            return
        }

        // Configurar sesión de audio para grabación. `.measurement` y
        // `.duckOthers` dan buena calidad sin matar otro audio (música
        // pausa, no se mata).
        let audioSession = AVAudioSession.sharedInstance()
        do {
            try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            state = .error("No pude activar el micrófono. Intenta otra vez.")
            return
        }

        // Crear engine + request + task.
        let engine = AVAudioEngine()
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        // Preferir on-device cuando esté disponible — más privado, más
        // rápido, no requiere internet. Si el modelo del locale no lo
        // soporta, iOS cae a server-side automáticamente.
        if recognizer.supportsOnDeviceRecognition {
            request.requiresOnDeviceRecognition = true
        }

        let inputNode = engine.inputNode
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)  // por las dudas, evitar dobles taps
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak request] buffer, _ in
            request?.append(buffer)
        }

        engine.prepare()
        do {
            try engine.start()
        } catch {
            state = .error("No pude iniciar la captura de audio.")
            tearDown()
            return
        }

        self.audioEngine = engine
        self.recognitionRequest = request
        self.lastSpeechAt = Date()

        self.recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            // Este closure NO viene en MainActor — hopeamos al main para
            // mutar @Published.
            Task { @MainActor in
                guard let self else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                    self.lastSpeechAt = Date()
                    if result.isFinal {
                        // El reconocedor dio resultado final — cerrar todo.
                        self.finalizeListening()
                    }
                }
                if let error {
                    // Errores comunes: cancellation cuando hacemos stop().
                    // No tratamos cancelaciones como errores visibles.
                    let nsErr = error as NSError
                    let isCancelled = (nsErr.domain == "kAFAssistantErrorDomain" && nsErr.code == 209)
                        || (nsErr.domain == "kAFAssistantErrorDomain" && nsErr.code == 216)
                    if !isCancelled {
                        self.state = .error("No pude entender el audio. Intenta otra vez.")
                    }
                    self.tearDown()
                }
            }
        }

        state = .listening
        startSilenceWatchdog()
    }

    /// Termina la grabación. Si hay transcripción acumulada, queda visible
    /// en `transcript` y el caller puede leerla. `state` pasa a
    /// `.processing` brevemente mientras el recognizer cierra, y queda en
    /// `.idle` cuando termina.
    func stop() {
        guard state == .listening else { return }
        state = .processing
        // Pedirle al request que termine de procesar el audio acumulado.
        recognitionRequest?.endAudio()
        // No tearDown inmediato — esperamos al `isFinal` del recognizer.
        // Si el recognizer no llega a final (raro), forzamos teardown a los
        // 2 segundos.
        let pendingTask = recognitionTask
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            guard let self else { return }
            if pendingTask === self.recognitionTask, self.state == .processing {
                self.finalizeListening()
            }
        }
    }

    /// Cancelación inmediata: descarta lo que haya y vuelve a idle. La UI
    /// llama esto cuando el usuario toca "Cancelar".
    func cancel() {
        recognitionTask?.cancel()
        tearDown()
        transcript = ""
        state = .idle
    }

    // MARK: - Internals

    private func finalizeListening() {
        tearDown()
        state = .idle
    }

    private func tearDown() {
        silenceCheckTask?.cancel()
        silenceCheckTask = nil
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        audioEngine = nil
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask = nil
        lastSpeechAt = nil
        // Liberar la sesión para que no se quede activa bloqueando otros
        // sonidos. Ignoramos el error — si falla, no es crítico.
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// Si pasan N segundos sin texto nuevo, auto-detenemos. Evita que la
    /// pantalla quede "escuchando" para siempre si el usuario olvidó cerrar.
    private func startSilenceWatchdog() {
        silenceCheckTask?.cancel()
        silenceCheckTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard let self else { return }
                guard self.state == .listening else { return }
                if let last = self.lastSpeechAt,
                   Date().timeIntervalSince(last) >= TimeInterval(Self.silenceTimeoutSeconds) {
                    // Auto-stop por silencio. Si ya hay transcripción
                    // acumulada, queda visible. Si no, transcript = ""
                    // y el caller mostrará error amable.
                    self.stop()
                    return
                }
            }
        }
    }
}
