import Foundation

#if DEBUG

/// Tests internos del `NovaActionNormalizer`. Como el proyecto no tiene
/// target de XCTest separado todavía, estos tests son funciones puras que
/// se pueden llamar desde un debugger o desde un breakpoint para validar
/// que los casos críticos del usuario siguen funcionando.
///
/// **Cómo correr manualmente desde LLDB en Xcode**:
///   `po NovaActionNormalizerTests.runAll()`
///
/// Imprime en consola los casos que pasan/fallan. Si todos pasan, devuelve
/// "ALL TESTS PASSED ✓". Si alguno falla, devuelve la lista de fallidos.
///
/// Casos basados directamente en la sección "TEST SUITE MANUAL Y/O
/// AUTOMATIZABLE" del prompt de Martin — son los inputs reales que él
/// dice que deben funcionar.
enum NovaActionNormalizerTests {

    @discardableResult
    static func runAll() -> String {
        var failures: [String] = []

        // ───── cleanTitle ──────────────────────────────────────────────

        check(
            label: "cleanTitle: 'ir a buscar a la agustina tipo 3 acuérdate' → 'Buscar a Agustina'",
            actual: NovaActionNormalizer.cleanTitle("ir a buscar a la agustina tipo 3 acuérdate"),
            expected: "Buscar a Agustina",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'salir a buscar a mi hermano en 5 min' → 'Buscar a mi hermano'",
            actual: NovaActionNormalizer.cleanTitle("salir a buscar a mi hermano en 5 min"),
            expected: "Buscar a mi hermano",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'acuérdame llamar a Juan' → 'Llamar a Juan'",
            actual: NovaActionNormalizer.cleanTitle("acuérdame llamar a Juan"),
            expected: "Llamar a Juan",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'recuérdame pagar internet mañana' → 'Pagar internet'",
            actual: NovaActionNormalizer.cleanTitle("recuérdame pagar internet mañana"),
            expected: "Pagar internet",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'Recordatorio: comprar pan' → 'Comprar pan'",
            actual: NovaActionNormalizer.cleanTitle("Recordatorio: comprar pan"),
            expected: "Comprar pan",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'reunión con Juan a las 3' → 'Reunión con Juan'",
            actual: NovaActionNormalizer.cleanTitle("reunión con Juan a las 3"),
            expected: "Reunión con Juan",
            failures: &failures
        )

        // Sanity: la frase "X minutos antes" se va del título.
        check(
            label: "cleanTitle: 'salir a buscar a mi hermano a las 10 acuérdame 5 minutos antes' → 'Buscar a mi hermano'",
            actual: NovaActionNormalizer.cleanTitle("salir a buscar a mi hermano a las 10 acuérdame 5 minutos antes"),
            expected: "Buscar a mi hermano",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'reunión con Juan a las 3 recuérdame media hora antes' → 'Reunión con Juan'",
            actual: NovaActionNormalizer.cleanTitle("reunión con Juan a las 3 recuérdame media hora antes"),
            expected: "Reunión con Juan",
            failures: &failures
        )

        // ───── extractReminderOffset ───────────────────────────────────

        check(
            label: "extractReminderOffset: 'acuérdame 5 minutos antes' → 5",
            actual: NovaActionNormalizer.extractReminderOffset(from: "acuérdame 5 minutos antes"),
            expected: 5,
            failures: &failures
        )

        check(
            label: "extractReminderOffset: 'recuérdame cinco minutos antes' → 5",
            actual: NovaActionNormalizer.extractReminderOffset(from: "recuérdame cinco minutos antes"),
            expected: 5,
            failures: &failures
        )

        check(
            label: "extractReminderOffset: 'avísame media hora antes' → 30",
            actual: NovaActionNormalizer.extractReminderOffset(from: "avísame media hora antes"),
            expected: 30,
            failures: &failures
        )

        check(
            label: "extractReminderOffset: 'una hora antes' → 60",
            actual: NovaActionNormalizer.extractReminderOffset(from: "una hora antes"),
            expected: 60,
            failures: &failures
        )

        check(
            label: "extractReminderOffset: 'tengo reunión mañana' → nil",
            actual: NovaActionNormalizer.extractReminderOffset(from: "tengo reunión mañana"),
            expected: nil as Int?,
            failures: &failures
        )

        // ───── isReminderTrigger ───────────────────────────────────────

        check(
            label: "isReminderTrigger: 'acuérdame llamar' → true",
            actual: NovaActionNormalizer.isReminderTrigger(in: "acuérdame llamar"),
            expected: true,
            failures: &failures
        )

        check(
            label: "isReminderTrigger: 'avísame en 5 minutos' → true",
            actual: NovaActionNormalizer.isReminderTrigger(in: "avísame en 5 minutos"),
            expected: true,
            failures: &failures
        )

        check(
            label: "isReminderTrigger: 'que no se me olvide pagar' → true",
            actual: NovaActionNormalizer.isReminderTrigger(in: "que no se me olvide pagar"),
            expected: true,
            failures: &failures
        )

        check(
            label: "isReminderTrigger: 'tengo reunión mañana' → false",
            actual: NovaActionNormalizer.isReminderTrigger(in: "tengo reunión mañana"),
            expected: false,
            failures: &failures
        )

        check(
            label: "isReminderTrigger: 'agenda dentista' → false",
            actual: NovaActionNormalizer.isReminderTrigger(in: "agenda dentista"),
            expected: false,
            failures: &failures
        )

        // ───── resolveEndTime ──────────────────────────────────────────

        let now = Date()
        let oneHour = now.addingTimeInterval(3600)

        let reminderEnd = NovaActionNormalizer.resolveEndTime(
            startTime: now, providedEndTime: oneHour,
            hasExplicitEndTime: true, isReminder: true
        )
        check(
            label: "resolveEndTime: isReminder=true ignora endTime explícito",
            actual: reminderEnd.endTime,
            expected: nil as Date?,
            failures: &failures
        )

        let explicitRange = NovaActionNormalizer.resolveEndTime(
            startTime: now, providedEndTime: oneHour,
            hasExplicitEndTime: true, isReminder: false
        )
        check(
            label: "resolveEndTime: rango explícito se respeta",
            actual: explicitRange.endTime != nil,
            expected: true,
            failures: &failures
        )

        let noEnd = NovaActionNormalizer.resolveEndTime(
            startTime: now, providedEndTime: nil,
            hasExplicitEndTime: false, isReminder: false
        )
        check(
            label: "resolveEndTime: sin rango explícito → inferred",
            actual: noEnd.inferredDuration,
            expected: true,
            failures: &failures
        )

        // ───── shouldScheduleNotification ──────────────────────────────

        let future = Date().addingTimeInterval(60)
        let past = Date().addingTimeInterval(-60)

        check(
            label: "shouldSchedule: reminder + futuro + toggle ON → true",
            actual: NovaActionNormalizer.shouldScheduleNotification(
                isReminder: true, startTime: future, remindersEnabledInSettings: true
            ),
            expected: true,
            failures: &failures
        )

        check(
            label: "shouldSchedule: reminder + pasado → false",
            actual: NovaActionNormalizer.shouldScheduleNotification(
                isReminder: true, startTime: past, remindersEnabledInSettings: true
            ),
            expected: false,
            failures: &failures
        )

        check(
            label: "shouldSchedule: no-reminder + futuro → false",
            actual: NovaActionNormalizer.shouldScheduleNotification(
                isReminder: false, startTime: future, remindersEnabledInSettings: true
            ),
            expected: false,
            failures: &failures
        )

        check(
            label: "shouldSchedule: toggle OFF → false aunque sea reminder futuro",
            actual: NovaActionNormalizer.shouldScheduleNotification(
                isReminder: true, startTime: future, remindersEnabledInSettings: false
            ),
            expected: false,
            failures: &failures
        )

        // ───── parseAll (multi-intent) ─────────────────────────────────

        // Frase compuesta del bug report del usuario.
        let multi = NovaResponder.parseAll(
            "mañana despertarme a las 7:10 y luego tipo 8 salir de mi casa a mi clase llamada contenidos digitales"
        )
        check(
            label: "parseAll: frase con 'y luego' → 2 intents",
            actual: multi.count,
            expected: 2,
            failures: &failures
        )

        // Frase simple sin conectores → 1 intent.
        let single = NovaResponder.parseAll("acuérdame comprar pan mañana a las 10")
        check(
            label: "parseAll: frase sin conectores → 1 intent",
            actual: single.count,
            expected: 1,
            failures: &failures
        )

        // Conector "después" también separa.
        let after = NovaResponder.parseAll("despiértame a las 7 después recuérdame salir a las 8")
        check(
            label: "parseAll: 'después' separa → 2 intents",
            actual: after.count,
            expected: 2,
            failures: &failures
        )

        // Conector "también".
        let also = NovaResponder.parseAll("agenda reunión mañana a las 10 también recuérdame llamar a Juan")
        check(
            label: "parseAll: 'también' separa → 2 intents",
            actual: also.count,
            expected: 2,
            failures: &failures
        )

        // ───── Smart " y " split (con hora en ambos lados) ────────────

        // CASO DEL BUG REPORT — el caso real que motivó el fix.
        let bugCase = NovaResponder.parseAll(
            "seguir trabajo de mi papá a las 1 y comer a las 7"
        )
        check(
            label: "parseAll: 'seguir trabajo a las 1 y comer a las 7' → 2 intents",
            actual: bugCase.count,
            expected: 2,
            failures: &failures
        )

        let wakeAndLeave = NovaResponder.parseAll(
            "despertarme a las 7 y salir a las 8"
        )
        check(
            label: "parseAll: 'despertarme a las 7 y salir a las 8' → 2 intents",
            actual: wakeAndLeave.count,
            expected: 2,
            failures: &failures
        )

        let studyAndCall = NovaResponder.parseAll(
            "estudiar a las 5 y llamar a mi mamá a las 8"
        )
        check(
            label: "parseAll: 'estudiar a las 5 y llamar a las 8' → 2 intents",
            actual: studyAndCall.count,
            expected: 2,
            failures: &failures
        )

        // ───── Smart " y " NO-split (sin horas en ambos lados) ────────

        // "comprar pan y leche" debe quedar como 1 sola tarea — "y leche"
        // forma parte del título, no es una nueva acción.
        let breadMilk = NovaResponder.parseAll("comprar pan y leche")
        check(
            label: "parseAll: 'comprar pan y leche' → 1 intent (no split)",
            actual: breadMilk.count,
            expected: 1,
            failures: &failures
        )

        // "reunión con Juan y Pedro a las 5" — solo hay UNA hora (5), no
        // dos. " y Pedro" es parte del título de la reunión.
        let meetTwo = NovaResponder.parseAll("reunión con Juan y Pedro a las 5")
        check(
            label: "parseAll: 'reunión con Juan y Pedro a las 5' → 1 intent",
            actual: meetTwo.count,
            expected: 1,
            failures: &failures
        )

        // ───── Resultado ───────────────────────────────────────────────

        if failures.isEmpty {
            return "✓ ALL TESTS PASSED"
        }
        return "✗ FAILURES (\(failures.count)):\n" + failures.joined(separator: "\n")
    }

    private static func check<T: Equatable>(
        label: String,
        actual: T,
        expected: T,
        failures: inout [String]
    ) {
        if actual == expected {
            print("  ✓ \(label)")
        } else {
            let msg = "  ✗ \(label) — got \(actual), expected \(expected)"
            print(msg)
            failures.append(msg)
        }
    }
}

#endif
