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
    /// Nivel de audio en vivo (0.0…1.0). Calculado en cada audio buffer
    /// del tap, normalizado a partir del RMS en dB. La UI usa este valor
    /// para waveform/barras animadas que dan feedback "estoy oyéndote".
    @Published private(set) var audioLevel: Float = 0
    /// `true` cuando hay habla actualmente (energía por encima del piso de
    /// ruido). Calculado en el mismo loop del tap. Sirve para distinguir
    /// "pausa para pensar" vs "terminé de hablar":
    /// - habla → reset del timer
    /// - silencio breve + última habla reciente → pausa para pensar
    /// - silencio sostenido + sin energía sostenida → fin
    @Published private(set) var isSpeaking: Bool = false

    // MARK: - Internals

    private let recognizer: SFSpeechRecognizer?
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?

    /// Locale efectivo que usamos (para diagnóstico/UI). Resuelto en init.
    let activeLocaleIdentifier: String

    /// **VAD (Voice Activity Detection) con doble timeout**:
    /// - `silenceShortSeconds` aplica cuando el usuario aún no dijo nada
    ///   (transcript vacío). Si arranca el mic pero no habla, paramos
    ///   rápido para no dejar pegado.
    /// - `silenceLongSeconds` aplica cuando ya hay transcript. Le damos
    ///   más tiempo para que pueda pausar y pensar en medio de una frase
    ///   sin que se corte.
    /// Ambos son condicionados a que ADEMÁS el audio level esté bajo
    /// sostenido (gateado por `lowEnergyHoldSeconds`), porque a veces el
    /// recognizer demora en emitir texto aunque el usuario esté hablando
    /// — usar solo timer de transcript causaba cortes prematuros.
    private static let silenceShortSeconds: Double = 2.0
    private static let silenceLongSeconds: Double = 3.5
    private static let lowEnergyHoldSeconds: Double = 0.6
    /// Umbral de energía debajo del cual consideramos "silencio". 0.05 en
    /// el rango 0…1 (-46dB aprox post-normalize). Más bajo = más
    /// estricto, más alto = corta antes con ruido ambiente.
    private static let speechEnergyThreshold: Float = 0.05

    /// Timer monotónico para detectar silencio. Lo reseteamos cada vez que
    /// llega texto nuevo del reconocedor o el audio level pasa el umbral.
    private var lastSpeechAt: Date?
    /// Última vez que el audio level estuvo por encima del threshold.
    /// Usado por el VAD para evitar corte mientras hay energía.
    private var lastHighEnergyAt: Date?
    private var silenceCheckTask: Task<Void, Never>?
    /// Smoothing factor (low-pass) para el audioLevel publicado — sin
    /// esto la UI parpadea demasiado. 0.0 = solo histórico, 1.0 = solo
    /// nuevo. 0.35 da movimiento responsive pero estable.
    private static let audioLevelSmoothing: Float = 0.35
    /// Contador para throttle del publish — el tap se llama ~43 veces/seg
    /// (buffer 1024 @ 44.1kHz). Publicar cada vez es exagerado, cada 3°
    /// callback da ~14fps que es suficiente para animación fluida.
    private var bufferTickCounter: Int = 0

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
        audioLevel = 0
        isSpeaking = false
        lastHighEnergyAt = nil
        bufferTickCounter = 0

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
        // Tap hace 2 cosas: (1) appendear audio al recognizer, (2)
        // calcular nivel RMS del buffer para audioLevel/VAD. La captura
        // débil de self sigue el lifecycle del service — si tearDown
        // nullea recognitionRequest, los buffers dejan de appenderse
        // limpiamente.
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            guard let self else { return }
            self.recognitionRequest?.append(buffer)
            // Audio level + VAD. Esta closure NO viene en MainActor —
            // calculamos el level acá y hopeamos al main solo para
            // publish + check del watchdog.
            let level = Self.bufferLevel(buffer)
            Task { @MainActor [weak self] in
                self?.updateAudioLevel(level)
            }
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
    /// llama esto cuando el usuario toca "Cancelar" o cuando el contexto
    /// requiere parar todo (cambio de tab, app va a background, logout).
    func cancel() {
        recognitionTask?.cancel()
        tearDown()
        transcript = ""
        state = .idle
    }

    /// Cleanup defensivo cuando el service se desinstancia (ej. logout
    /// destruye MiDiaView). Sin esto, el audio engine podría quedar
    /// activo en memoria hasta que iOS lo recicle. `tearDown` libera el
    /// inputNode, el audioEngine, el recognitionRequest y la audio session.
    deinit {
        // No podemos usar @MainActor desde deinit; las propiedades que
        // tocamos son thread-safe (audioEngine sync) o solo metadata.
        recognitionTask?.cancel()
        audioEngine?.inputNode.removeTap(onBus: 0)
        audioEngine?.stop()
        try? AVAudioSession.sharedInstance().setActive(
            false, options: .notifyOthersOnDeactivation
        )
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
        lastHighEnergyAt = nil
        audioLevel = 0
        isSpeaking = false
        bufferTickCounter = 0
        // Liberar la sesión para que no se quede activa bloqueando otros
        // sonidos. Ignoramos el error — si falla, no es crítico.
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// VAD inteligente: distingue **pausa para pensar** vs **fin de habla**
    /// usando dos señales en combinación:
    /// 1. **Tiempo sin transcripción nueva** del recognizer (`lastSpeechAt`).
    /// 2. **Energía de audio sostenida baja** (`lastHighEnergyAt`).
    ///
    /// La diferencia con la versión anterior (timeout fijo de 8s sin
    /// distinción) es:
    /// - Si el usuario aún no dijo nada (transcript vacío) → corte rápido
    ///   en `silenceShortSeconds` (2s). No le hacemos esperar si no piensa
    ///   hablar.
    /// - Si ya hay transcript → `silenceLongSeconds` (3.5s). Esto permite
    ///   pausas naturales para pensar entre frases.
    /// - Pero NUNCA cortamos si la energía de audio sigue alta — eso
    ///   significa que el usuario sigue hablando (o murmurando) aunque el
    ///   recognizer aún no haya emitido texto. Solo cortamos cuando
    ///   `lastHighEnergyAt` también pasó `lowEnergyHoldSeconds` (0.6s).
    private func startSilenceWatchdog() {
        silenceCheckTask?.cancel()
        silenceCheckTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                // Check cada 200ms — más responsive para VAD que 1s.
                try? await Task.sleep(nanoseconds: 200_000_000)
                guard let self else { return }
                guard self.state == .listening else { return }

                let now = Date()
                let hasContent = !self.transcript.isEmpty
                let silenceTimeout = hasContent
                    ? Self.silenceLongSeconds
                    : Self.silenceShortSeconds

                let timeSinceSpeech = self.lastSpeechAt.map {
                    now.timeIntervalSince($0)
                } ?? now.timeIntervalSince(Date(timeIntervalSinceNow: -100))

                let timeSinceHighEnergy = self.lastHighEnergyAt.map {
                    now.timeIntervalSince($0)
                } ?? Self.lowEnergyHoldSeconds + 1

                // Ambas condiciones deben cumplirse: timer de transcripción
                // pasó Y energía baja sostenida. Si el usuario sigue
                // hablando aunque el recognizer aún no haya emitido, la
                // energía mantiene viva la sesión.
                let transcriptIdle = timeSinceSpeech >= silenceTimeout
                let energyIdle = timeSinceHighEnergy >= Self.lowEnergyHoldSeconds
                if transcriptIdle && energyIdle {
                    self.stop()
                    return
                }
            }
        }
    }

    // MARK: - Audio level (RMS → dB → 0…1)

    /// Calcula el RMS del buffer (sample values son float -1..1 ya), lo
    /// convierte a dB y normaliza a un rango 0..1 con piso en -55dB
    /// (silencio) y techo en -5dB (habla fuerte). Resultado: el usuario
    /// hablando normal mueve la barra en ~0.4-0.7, silencio queda en ~0.
    private static func bufferLevel(_ buffer: AVAudioPCMBuffer) -> Float {
        guard let channelData = buffer.floatChannelData else { return 0 }
        let channel = channelData.pointee
        let length = Int(buffer.frameLength)
        guard length > 0 else { return 0 }
        var sumSquares: Float = 0
        for i in 0..<length {
            let s = channel[i]
            sumSquares += s * s
        }
        let rms = sqrt(sumSquares / Float(length))
        // Evitar log(0). 1e-7 corresponde a ~-140dB, sub-silencio absoluto.
        let dB = 20 * log10(max(rms, 1e-7))
        // Mapear -55dB (silencio ambiente) → 0, -5dB (habla alta) → 1.
        let normalized = (dB + 55) / 50
        return min(max(normalized, 0), 1)
    }

    /// Aplicado en MainActor (porque @Published muta state observable).
    /// Hace smoothing exponencial para que la UI no parpadee y throttling
    /// para no spamear publishes. Además resetea `lastHighEnergyAt` para
    /// el VAD.
    private func updateAudioLevel(_ newLevel: Float) {
        // Smoothing exponencial: nuevoValor = α·raw + (1-α)·anterior
        let smoothed = Self.audioLevelSmoothing * newLevel
            + (1 - Self.audioLevelSmoothing) * audioLevel

        bufferTickCounter += 1
        // Throttle publish — cada 3 ticks (~14fps), suficiente para
        // animación fluida sin spamear @Published.
        if bufferTickCounter % 3 == 0 {
            audioLevel = smoothed
        }

        // VAD: track energía alta para el watchdog. Threshold inferior
        // pequeño para captar voz suave también.
        let speaking = newLevel >= Self.speechEnergyThreshold
        if speaking {
            lastHighEnergyAt = Date()
        }
        if speaking != isSpeaking {
            isSpeaking = speaking
        }
    }
}
