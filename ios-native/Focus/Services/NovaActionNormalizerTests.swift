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

        // ───── AM/PM contextual por verbo (los 10 casos del usuario) ──

        // 1. "despertarme a las 7" → "Despertarme" 07:00, recordatorio puntual
        checkAction(
            "case 1: despertarme a las 7",
            text: "despertarme a las 7",
            expectedTitle: "Despertarme",
            expectedHour: 7,
            expectedReminder: true,
            failures: &failures
        )

        // 2. "levantarme a las 7" → "Levantarme" 07:00
        checkAction(
            "case 2: levantarme a las 7",
            text: "levantarme a las 7",
            expectedTitle: "Levantarme",
            expectedHour: 7,
            expectedReminder: true,
            failures: &failures
        )

        // 3. "salir de mi casa a las 8 para la universidad" → "Salir de mi casa" 08:00
        checkAction(
            "case 3: salir de mi casa a las 8 para la universidad",
            text: "salir de mi casa a las 8 para la universidad",
            expectedTitle: "Salir de mi casa",
            expectedHour: 8,
            expectedReminder: nil,  // no chequeamos — el destino escolar fuerza AM, no reminder
            failures: &failures
        )

        // 4. "clase a las 8" → 08:00 (no 20:00)
        checkAction(
            "case 4: clase a las 8",
            text: "clase a las 8",
            expectedTitle: nil,
            expectedHour: 8,
            expectedReminder: nil,
            failures: &failures
        )

        // 5. "comer a las 7" → "Comer" 19:00
        checkAction(
            "case 5: comer a las 7",
            text: "comer a las 7",
            expectedTitle: "Comer",
            expectedHour: 19,
            expectedReminder: nil,
            failures: &failures
        )

        // 6. "cenar a las 8" → 20:00
        checkAction(
            "case 6: cenar a las 8",
            text: "cenar a las 8",
            expectedTitle: "Cenar",
            expectedHour: 20,
            expectedReminder: nil,
            failures: &failures
        )

        // 7. "almorzar a la 1" → 13:00
        checkAction(
            "case 7: almorzar a la 1",
            text: "almorzar a la 1",
            expectedTitle: "Almorzar",
            expectedHour: 13,
            expectedReminder: nil,
            failures: &failures
        )

        // 8. "seguir trabajo de mi papá a la 1 y comer a las 7" → 2 intents
        //    "Seguir trabajo de mi papá" 13:00 + "Comer" 19:00
        let case8 = runPipeline("seguir trabajo de mi papá a la 1 y comer a las 7")
        check(
            label: "case 8: 'seguir...a la 1 y comer a las 7' → 2 intents",
            actual: case8.count, expected: 2, failures: &failures
        )
        if case8.count == 2 {
            check(label: "case 8a: hora intent 1", actual: case8[0].hour, expected: 13, failures: &failures)
            check(label: "case 8b: hora intent 2", actual: case8[1].hour, expected: 19, failures: &failures)
        }

        // 9. "mañana despertarme a las 7 y salir a las 8" → 2 intents
        //    "Despertarme" mañana 07:00 + "Salir" mañana 08:00
        let case9 = runPipeline("mañana despertarme a las 7 y salir a las 8")
        check(
            label: "case 9: 'mañana despertarme...y salir...' → 2 intents",
            actual: case9.count, expected: 2, failures: &failures
        )
        if case9.count == 2 {
            check(label: "case 9a: hora intent 1 (despertarme)", actual: case9[0].hour, expected: 7, failures: &failures)
            check(label: "case 9b: hora intent 2 (salir)", actual: case9[1].hour, expected: 8, failures: &failures)
            check(label: "case 9a: intent 1 es recordatorio", actual: case9[0].isReminder, expected: true, failures: &failures)
        }

        // 10. "reunión a las 7" → 19:00 (regla coloquial 1-7 PM como safe default).
        checkAction(
            "case 10: reunión a las 7 (safe default)",
            text: "reunión a las 7",
            expectedTitle: nil,
            expectedHour: 19,
            expectedReminder: nil,
            failures: &failures
        )

        // ───── Overrides explícitos AM/PM ─────────────────────────────

        checkAction(
            "override AM: 'comer a las 7 de la mañana' → 07:00",
            text: "comer a las 7 de la mañana",
            expectedTitle: nil,
            expectedHour: 7,
            expectedReminder: nil,
            failures: &failures
        )

        checkAction(
            "override PM: 'despertarme a las 7 de la tarde' → 19:00",
            text: "despertarme a las 7 de la tarde",
            expectedTitle: nil,
            expectedHour: 19,
            expectedReminder: nil,
            failures: &failures
        )

        // ───── Edge: 'salir' SIN destino escolar no fuerza AM ────────

        checkAction(
            "edge: 'salir a las 6' sin contexto → 18:00 (colloquial PM)",
            text: "salir a las 6",
            expectedTitle: nil,
            expectedHour: 18,
            expectedReminder: nil,
            failures: &failures
        )

        // ───── Edge: 'salir' + universidad fuerza AM aunque sea hora 1-7 ──

        checkAction(
            "edge: 'salir a las 6 para la universidad' → 06:00",
            text: "salir a las 6 para la universidad",
            expectedTitle: "Salir",
            expectedHour: 6,
            expectedReminder: nil,
            failures: &failures
        )

        // ───── impliesPunctualReminder unit tests ─────────────────────

        check(
            label: "impliesPunctualReminder: 'despertarme a las 7' → true",
            actual: NovaActionNormalizer.impliesPunctualReminder(in: "despertarme a las 7"),
            expected: true, failures: &failures
        )
        check(
            label: "impliesPunctualReminder: 'levantarme mañana' → true",
            actual: NovaActionNormalizer.impliesPunctualReminder(in: "levantarme mañana"),
            expected: true, failures: &failures
        )
        check(
            label: "impliesPunctualReminder: 'reunión a las 7' → false",
            actual: NovaActionNormalizer.impliesPunctualReminder(in: "reunión a las 7"),
            expected: false, failures: &failures
        )
        check(
            label: "impliesPunctualReminder: 'comer a las 7' → false",
            actual: NovaActionNormalizer.impliesPunctualReminder(in: "comer a las 7"),
            expected: false, failures: &failures
        )

        // ───── Resultado ───────────────────────────────────────────────

        if failures.isEmpty {
            return "✓ ALL TESTS PASSED"
        }
        return "✗ FAILURES (\(failures.count)):\n" + failures.joined(separator: "\n")
    }

    // MARK: - Helpers para tests de pipeline completo

    /// Resultado de pasar un texto por `parseAll` + `cleanTitle`. Replica
    /// lo que hace `applyLocalNovaIntent` antes de guardar el evento.
    private struct ParsedAction: Equatable {
        let title: String
        let hour: Int?
        let isReminder: Bool
    }

    /// Pasa el texto por el pipeline completo (parseAll → cleanTitle) y
    /// devuelve una lista de `ParsedAction`, uno por intent generado.
    private static func runPipeline(_ text: String) -> [ParsedAction] {
        let intents = NovaResponder.parseAll(text)
        return intents.compactMap { intent -> ParsedAction? in
            switch intent {
            case let .createEvent(rawTitle, when, _, _, _, wantsReminder):
                let title = NovaActionNormalizer.cleanTitle(rawTitle)
                let hour = when.map { Calendar.current.component(.hour, from: $0) }
                let reminder = wantsReminder
                    || NovaActionNormalizer.isReminderTrigger(in: text)
                    || NovaActionNormalizer.impliesPunctualReminder(in: text)
                return ParsedAction(title: title, hour: hour, isReminder: reminder)
            case let .createTask(rawTitle, dueDate, _, wantsReminder):
                let title = NovaActionNormalizer.cleanTitle(rawTitle)
                let hour = dueDate.map { Calendar.current.component(.hour, from: $0) }
                let reminder = wantsReminder
                    || NovaActionNormalizer.isReminderTrigger(in: text)
                    || NovaActionNormalizer.impliesPunctualReminder(in: text)
                return ParsedAction(title: title, hour: hour, isReminder: reminder)
            default:
                return nil
            }
        }
    }

    /// Comprueba que un texto produce exactamente 1 intent con título / hora /
    /// flag de recordatorio esperados. Si `expectedTitle` o `expectedReminder`
    /// son `nil`, no se chequean.
    private static func checkAction(
        _ label: String,
        text: String,
        expectedTitle: String?,
        expectedHour: Int?,
        expectedReminder: Bool?,
        failures: inout [String]
    ) {
        let actions = runPipeline(text)
        guard let first = actions.first else {
            let msg = "  ✗ \(label) — pipeline devolvió 0 intents"
            print(msg); failures.append(msg)
            return
        }
        if actions.count != 1 {
            let msg = "  ⚠ \(label) — pipeline devolvió \(actions.count) intents (esperaba 1)"
            print(msg); failures.append(msg)
        }
        if let expectedTitle {
            check(label: "\(label) — title", actual: first.title, expected: expectedTitle, failures: &failures)
        }
        if let expectedHour {
            check(label: "\(label) — hour", actual: first.hour, expected: expectedHour, failures: &failures)
        }
        if let expectedReminder {
            check(label: "\(label) — isReminder", actual: first.isReminder, expected: expectedReminder, failures: &failures)
        }
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
