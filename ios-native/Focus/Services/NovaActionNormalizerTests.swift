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
            label: "cleanTitle: 'salir a buscar a mi hermano en 5 min' → 'Salir a buscar a mi hermano'",
            actual: NovaActionNormalizer.cleanTitle("salir a buscar a mi hermano en 5 min"),
            expected: "Salir a buscar a mi hermano",
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
            label: "cleanTitle: 'salir a buscar a mi hermano a las 10 acuérdame 5 minutos antes' → 'Salir a buscar a mi hermano'",
            actual: NovaActionNormalizer.cleanTitle("salir a buscar a mi hermano a las 10 acuérdame 5 minutos antes"),
            expected: "Salir a buscar a mi hermano",
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

        // Cambio de criterio 2026-05-12: el rango explícito SIEMPRE gana,
        // incluso cuando isReminder=true. Antes "reunión de 5 a 6 acuérdame
        // 15 antes" perdía el rango — bajo el nuevo modelo, el aviso va como
        // chip dentro del mismo bloque y la duración real se respeta.
        let reminderWithRange = NovaActionNormalizer.resolveEndTime(
            startTime: now, providedEndTime: oneHour,
            hasExplicitEndTime: true, isReminder: true
        )
        check(
            label: "resolveEndTime: rango explícito gana aunque sea reminder",
            actual: reminderWithRange.endTime != nil,
            expected: true,
            failures: &failures
        )
        // Recordatorio SIN rango → nil (punto en el tiempo).
        let reminderPoint = NovaActionNormalizer.resolveEndTime(
            startTime: now, providedEndTime: nil,
            hasExplicitEndTime: false, isReminder: true
        )
        check(
            label: "resolveEndTime: reminder sin rango → nil",
            actual: reminderPoint.endTime,
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
            label: "impliesPunctualReminder: 'comer a las 7' → true (extended)",
            actual: NovaActionNormalizer.impliesPunctualReminder(in: "comer a las 7"),
            expected: true, failures: &failures
        )

        // ───── FASE 8 — TESTS OBLIGATORIOS DEL BUG REPORT ─────────────

        // 1. "tengo que seguir trabajando a las 3:30 y comer a las 4"
        //    → 2 intents, HOY, 15:30 + 16:00, sin reunión, títulos limpios
        let bug1 = runPipeline("tengo que seguir trabajando a las 3:30 y comer a las 4")
        check(
            label: "bug1: 2 intents",
            actual: bug1.count, expected: 2, failures: &failures
        )
        if bug1.count == 2 {
            check(label: "bug1[0] title", actual: bug1[0].title, expected: "Seguir trabajando", failures: &failures)
            check(label: "bug1[0] hour 15", actual: bug1[0].hour, expected: 15, failures: &failures)
            // El día depende de la hora a la que corren los tests. Si son
            // antes de 19:30, 15:30 cae hoy futuro; si son después, el
            // bumpea-a-mañana legítimo lo manda a tomorrow. AMBOS son
            // aceptables — el bug original era que caía a "otherDay" por
            // interpretación errónea de 3:30 → 03:30.
            check(label: "bug1[0] today o tomorrow (no otherDay)",
                  actual: bug1[0].day == .today || bug1[0].day == .tomorrow,
                  expected: true, failures: &failures)
            check(label: "bug1[0] no reunión", actual: bug1[0].section != .reunion, expected: true, failures: &failures)
            check(label: "bug1[0] es recordatorio", actual: bug1[0].isReminder, expected: true, failures: &failures)

            check(label: "bug1[1] title", actual: bug1[1].title, expected: "Comer", failures: &failures)
            check(label: "bug1[1] hour 16", actual: bug1[1].hour, expected: 16, failures: &failures)
            check(label: "bug1[1] today o tomorrow",
                  actual: bug1[1].day == .today || bug1[1].day == .tomorrow,
                  expected: true, failures: &failures)
            check(label: "bug1[1] no reunión", actual: bug1[1].section != .reunion, expected: true, failures: &failures)
        }

        // 2. "seguir trabajo de mi papá a la 1 y comer a las 7"
        //    → 13:00 + 19:00
        let bug2 = runPipeline("seguir trabajo de mi papá a la 1 y comer a las 7")
        check(label: "bug2: 2 intents", actual: bug2.count, expected: 2, failures: &failures)
        if bug2.count == 2 {
            check(label: "bug2[0] hour 13", actual: bug2[0].hour, expected: 13, failures: &failures)
            check(label: "bug2[0] no reunión", actual: bug2[0].section != .reunion, expected: true, failures: &failures)
            check(label: "bug2[1] hour 19", actual: bug2[1].hour, expected: 19, failures: &failures)
            check(label: "bug2[1] no reunión", actual: bug2[1].section != .reunion, expected: true, failures: &failures)
        }

        // 3. "mañana despertarme a las 7 y salir a las 8"
        //    → mañana 07:00 + mañana 08:00
        let bug3 = runPipeline("mañana despertarme a las 7 y salir a las 8")
        check(label: "bug3: 2 intents", actual: bug3.count, expected: 2, failures: &failures)
        if bug3.count == 2 {
            check(label: "bug3[0] mañana", actual: bug3[0].day, expected: .tomorrow, failures: &failures)
            check(label: "bug3[0] hour 7", actual: bug3[0].hour, expected: 7, failures: &failures)
            check(label: "bug3[1] mañana", actual: bug3[1].day, expected: .tomorrow, failures: &failures)
            check(label: "bug3[1] hour 8", actual: bug3[1].hour, expected: 8, failures: &failures)
        }

        // 4. "comprar pan y leche" → 1 tarea
        let bug4 = runPipeline("comprar pan y leche")
        check(label: "bug4: 1 intent", actual: bug4.count, expected: 1, failures: &failures)
        if let first = bug4.first {
            check(label: "bug4 kind = task", actual: first.kind, expected: .task, failures: &failures)
        }

        // 5. "reunión con Juan y Pedro a las 5" → 1 evento/reunión
        let bug5 = runPipeline("reunión con Juan y Pedro a las 5")
        check(label: "bug5: 1 intent", actual: bug5.count, expected: 1, failures: &failures)
        if let first = bug5.first {
            check(label: "bug5 section = reunión", actual: first.section, expected: .reunion, failures: &failures)
        }

        // 6. "comer a las 4" → 16:00, no reunión
        let bug6 = runPipeline("comer a las 4")
        if let first = bug6.first {
            check(label: "bug6 hour 16", actual: first.hour, expected: 16, failures: &failures)
            check(label: "bug6 no reunión", actual: first.section != .reunion, expected: true, failures: &failures)
        }

        // 7. "despertarme a las 7" → 07:00
        let bug7 = runPipeline("despertarme a las 7")
        if let first = bug7.first {
            check(label: "bug7 hour 7", actual: first.hour, expected: 7, failures: &failures)
        }

        // 8. "trabajar a las 3:30" → 15:30 (no reunión)
        let bug8 = runPipeline("trabajar a las 3:30")
        if let first = bug8.first {
            check(label: "bug8 hour 15", actual: first.hour, expected: 15, failures: &failures)
            check(label: "bug8 no reunión", actual: first.section != .reunion, expected: true, failures: &failures)
        }

        // Bonus: 'trabajar a las 3:30 de la mañana' → 03:30 (override AM)
        let bug8am = runPipeline("trabajar a las 3:30 de la mañana")
        if let first = bug8am.first {
            check(label: "bug8 AM override hour 3", actual: first.hour, expected: 3, failures: &failures)
        }

        // ───── BUG REPORT 2026-05-12 — HORAS EN PALABRAS ──────────────

        // Caso real iPhone: "necesito ir a buscar a mi hermano a las tres"
        // Antes: Nova preguntaba "¿Cuándo?" con título "Buscar a Mi hermano a Tres".
        // Esperado: "Ir a buscar a mi hermano" hoy 15:00, sin preguntar.
        let wordBug = runPipeline("necesito ir a buscar a mi hermano a las tres")
        check(
            label: "wordBug: 1 intent (no clarify)",
            actual: wordBug.count, expected: 1, failures: &failures
        )
        if let first = wordBug.first {
            check(label: "wordBug kind ≠ clarify", actual: first.kind != .clarify, expected: true, failures: &failures)
            check(label: "wordBug title = 'Ir a buscar a mi hermano'", actual: first.title, expected: "Ir a buscar a mi hermano", failures: &failures)
            check(label: "wordBug hour 15", actual: first.hour, expected: 15, failures: &failures)
            check(label: "wordBug HOY", actual: first.day, expected: .today, failures: &failures)
        }

        // "despertarme a las siete" → 07:00
        let w1 = runPipeline("despertarme a las siete")
        if let first = w1.first {
            check(label: "word: despertarme a las siete → 7", actual: first.hour, expected: 7, failures: &failures)
        }

        // "comer a las siete" → 19:00
        let w2 = runPipeline("comer a las siete")
        if let first = w2.first {
            check(label: "word: comer a las siete → 19", actual: first.hour, expected: 19, failures: &failures)
        }

        // "clase a las ocho" → 08:00
        let w3 = runPipeline("clase a las ocho")
        if let first = w3.first {
            check(label: "word: clase a las ocho → 8", actual: first.hour, expected: 8, failures: &failures)
        }

        // "reunión a las tres de la tarde" → 15:00 (PM explícito)
        let w4 = runPipeline("reunión a las tres de la tarde")
        if let first = w4.first {
            check(label: "word: reunión a las tres de la tarde → 15", actual: first.hour, expected: 15, failures: &failures)
        }

        // "levantarme a las seis y media" → 06:30
        let w5 = runPipeline("levantarme a las seis y media")
        if let first = w5.first {
            check(label: "word: levantarme a las seis y media → hora 6", actual: first.hour, expected: 6, failures: &failures)
        }

        // "seguir trabajando a las tres y media y comer a las siete" → 2 intents
        // El " y " entre "tres" y "media" NO debe splittear (es time fragment).
        // El " y " entre "media" y "comer" SÍ debe splittear.
        let w6 = runPipeline("seguir trabajando a las tres y media y comer a las siete")
        check(label: "word multi: 2 intents", actual: w6.count, expected: 2, failures: &failures)
        if w6.count == 2 {
            check(label: "word multi[0] hour 15", actual: w6[0].hour, expected: 15, failures: &failures)
            check(label: "word multi[1] hour 19", actual: w6[1].hour, expected: 19, failures: &failures)
        }

        // "comprar pan y leche" → 1 tarea, no hora
        let w7 = runPipeline("comprar pan y leche")
        check(label: "word neg: 'comprar pan y leche' → 1 intent", actual: w7.count, expected: 1, failures: &failures)

        // "ir a buscar a la Agustina a las tres" → "Buscar a Agustina" (idiomático)
        // Para preservar el comportamiento idiomático cuando hay "la NombrePropio".
        let w8 = runPipeline("ir a buscar a la Agustina a las tres")
        if let first = w8.first {
            check(label: "word: 'ir a buscar a la Agustina' → 'Buscar a Agustina'", actual: first.title, expected: "Buscar a Agustina", failures: &failures)
            check(label: "word: hora 15", actual: first.hour, expected: 15, failures: &failures)
        }

        // hasTimeMarker para horas en palabras (sanity unit).
        // Necesitamos exponer esto para test — chequear via runPipeline si
        // detecta hora. Si no detecta, kind sería clarify o el intent no
        // tendría hour. Ya cubierto por wordBug arriba.

        // ───── MODELO UNIFICADO "bloque" 2026-05-12 ───────────────────

        // Bug del producto: antes los recordatorios aparecían como tarjeta
        // separada Y como bloque en timeline → duplicado. Ahora todo lo que
        // tiene hora es UN solo bloque con chip de offset opcional.

        // Bloque 1: "ir a buscar a mi hermano a las 6:30 y comer a las 8"
        //           → 2 bloques, ambos hoy, sin duplicados.
        let block1 = runPipeline("ir a buscar a mi hermano a las 6:30 y comer a las 8")
        check(label: "block1: 2 intents", actual: block1.count, expected: 2, failures: &failures)
        if block1.count == 2 {
            check(label: "block1[0] hour 18", actual: block1[0].hour, expected: 18, failures: &failures)
            check(label: "block1[0] minute 30", actual: block1[0].minute, expected: 30, failures: &failures)
            check(label: "block1[1] hour 20", actual: block1[1].hour, expected: 20, failures: &failures)
            check(label: "block1[0] sin offset", actual: block1[0].reminderOffsetMinutes, expected: nil, failures: &failures)
        }

        // Bloque 2: "ir a buscar a mi hermano a las 6:30 acuérdame 40 minutos antes"
        //           → 1 bloque con reminderOffsetMinutes = 40.
        let block2 = runPipeline("ir a buscar a mi hermano a las 6:30 acuérdame 40 minutos antes")
        check(label: "block2: 1 intent", actual: block2.count, expected: 1, failures: &failures)
        if let first = block2.first {
            check(label: "block2 hour 18", actual: first.hour, expected: 18, failures: &failures)
            check(label: "block2 minute 30", actual: first.minute, expected: 30, failures: &failures)
            check(label: "block2 offset = 40 min", actual: first.reminderOffsetMinutes, expected: 40, failures: &failures)
            check(label: "block2 title sin 'acuérdame'", actual: first.title, expected: "Ir a buscar a mi hermano", failures: &failures)
        }

        // Bloque 3: "reunión con Juan de 5 a 6 acuérdame 15 minutos antes"
        //           → evento con duración + reminderOffsetMinutes = 15.
        let block3 = runPipeline("reunión con Juan de 5 a 6 acuérdame 15 minutos antes")
        check(label: "block3: 1 intent", actual: block3.count, expected: 1, failures: &failures)
        if let first = block3.first {
            check(label: "block3 hour 17 (start)", actual: first.hour, expected: 17, failures: &failures)
            check(label: "block3 endHour 18", actual: first.endHour, expected: 18, failures: &failures)
            check(label: "block3 offset = 15 min", actual: first.reminderOffsetMinutes, expected: 15, failures: &failures)
        }

        // Bloque 4: "comprar pan" → tarea (sin hora).
        let block4 = runPipeline("comprar pan")
        check(label: "block4: 1 intent", actual: block4.count, expected: 1, failures: &failures)
        if let first = block4.first {
            check(label: "block4 kind = task", actual: first.kind, expected: .task, failures: &failures)
        }

        // ───── BUG REPORT 2026-05-12 — INSTRUCCIÓN COMPLEJA ────────────

        // Bug iPhone: "tengo que ir a buscar a mi hermano en 20 min luego
        // salir a jugar fútbol a las 10 y llevar la pelota a las 11"
        // → Nova creó "Salir a jugar futbol que llevar la pelota" como
        // título concatenado. Esperamos 3 intents con títulos limpios.
        let complex = runPipeline("tengo que ir a buscar a mi hermano en 20 min luego salir a jugar fútbol a las 10 y llevar la pelota a las 11")
        check(label: "complex: 3 intents", actual: complex.count, expected: 3, failures: &failures)
        if complex.count == 3 {
            check(label: "complex[0] title 'Ir a buscar a mi hermano'",
                  actual: complex[0].title, expected: "Ir a buscar a mi hermano", failures: &failures)
            check(label: "complex[1] title 'Salir a jugar fútbol'",
                  actual: complex[1].title, expected: "Salir a jugar fútbol", failures: &failures)
            check(label: "complex[1] hour 10", actual: complex[1].hour, expected: 10, failures: &failures)
            check(label: "complex[2] title 'Llevar la pelota' (NO concatenado)",
                  actual: complex[2].title, expected: "Llevar la pelota", failures: &failures)
            check(label: "complex[2] hour 11", actual: complex[2].hour, expected: 11, failures: &failures)
            // Crítico: NO debe contener "que llevar" en ningún título.
            let hasBadConcatenation = complex.contains {
                $0.title.lowercased().contains("que llevar")
            }
            check(label: "complex: ningún título concatenado con 'que llevar'",
                  actual: hasBadConcatenation, expected: false, failures: &failures)
        }

        // Caso menor del mismo bug: "salir a jugar fútbol a las 10 y llevar
        // la pelota" → segundo segmento SIN hora (no debería splittear por
        // " y " porque smart split exige hora en ambos lados).
        let shortRelated = runPipeline("salir a jugar fútbol a las 10 y llevar la pelota")
        check(label: "shortRelated: 1 intent (no split, llevar no tiene hora)",
              actual: shortRelated.count, expected: 1, failures: &failures)

        // ───── Resultado ───────────────────────────────────────────────

        if failures.isEmpty {
            return "✓ ALL TESTS PASSED"
        }
        return "✗ FAILURES (\(failures.count)):\n" + failures.joined(separator: "\n")
    }

    // MARK: - Helpers para tests de pipeline completo

    /// Tipo de intent ejecutado. Útil para chequear que "comprar pan y
    /// leche" devuelve `.task` (no event, no split) y que multi-intent
    /// con horas devuelve `.event` o `.reminder` según corresponda.
    enum ParsedKind: String, Equatable {
        case event
        case reminder
        case task
        case clarify
        case other
    }

    /// Resultado de pasar un texto por `parseAll` + `cleanTitle`. Replica
    /// lo que hace `applyLocalNovaIntent` antes de guardar el evento.
    private struct ParsedAction: Equatable {
        let kind: ParsedKind
        let title: String
        let hour: Int?
        let minute: Int?
        let endHour: Int?
        let day: DayLabel
        let section: EventSection?
        let isReminder: Bool
        /// Minutos antes del startTime extraídos de "acuérdame N antes".
        /// Permite testear que un mismo bloque conserva su offset sin
        /// crearse como ítem duplicado.
        let reminderOffsetMinutes: Int?
    }

    enum DayLabel: String, Equatable {
        case today, tomorrow, otherDay, none
    }

    /// Pasa el texto por el pipeline completo (parseAll → cleanTitle) y
    /// devuelve una lista de `ParsedAction`, uno por intent generado.
    /// Si el intent es `.clarify`, devuelve una acción tipo `.clarify` para
    /// que el test pueda chequear ese resultado también.
    private static func runPipeline(_ text: String) -> [ParsedAction] {
        let intents = NovaResponder.parseAll(text)
        return intents.compactMap { intent -> ParsedAction? in
            switch intent {
            case let .createEvent(rawTitle, when, explicitEnd, _, section, wantsReminder):
                let title = NovaActionNormalizer.cleanTitle(rawTitle)
                let hour = when.map { Calendar.current.component(.hour, from: $0) }
                let minute = when.map { Calendar.current.component(.minute, from: $0) }
                let endHour = explicitEnd.map { Calendar.current.component(.hour, from: $0) }
                let day = dayLabel(for: when)
                let reminder = wantsReminder
                    || NovaActionNormalizer.isReminderTrigger(in: text)
                    || NovaActionNormalizer.impliesPunctualReminder(in: text)
                let offset = NovaActionNormalizer.extractReminderOffset(from: text)
                return ParsedAction(
                    kind: reminder ? .reminder : .event,
                    title: title, hour: hour, minute: minute, endHour: endHour, day: day,
                    section: section, isReminder: reminder,
                    reminderOffsetMinutes: offset
                )
            case let .createTask(rawTitle, dueDate, _, wantsReminder):
                let title = NovaActionNormalizer.cleanTitle(rawTitle)
                let hour = dueDate.map { Calendar.current.component(.hour, from: $0) }
                let minute = dueDate.map { Calendar.current.component(.minute, from: $0) }
                let day = dayLabel(for: dueDate)
                let reminder = wantsReminder
                    || NovaActionNormalizer.isReminderTrigger(in: text)
                    || NovaActionNormalizer.impliesPunctualReminder(in: text)
                return ParsedAction(
                    kind: .task, title: title, hour: hour, minute: minute, endHour: nil, day: day,
                    section: nil, isReminder: reminder,
                    reminderOffsetMinutes: nil
                )
            case .clarify:
                return ParsedAction(
                    kind: .clarify, title: "", hour: nil, minute: nil, endHour: nil, day: .none,
                    section: nil, isReminder: false,
                    reminderOffsetMinutes: nil
                )
            default:
                return ParsedAction(
                    kind: .other, title: "", hour: nil, minute: nil, endHour: nil, day: .none,
                    section: nil, isReminder: false,
                    reminderOffsetMinutes: nil
                )
            }
        }
    }

    /// Devuelve una etiqueta legible (today/tomorrow/otherDay/none) según
    /// la fecha dada. Hace los tests más fáciles de leer.
    private static func dayLabel(for date: Date?) -> DayLabel {
        guard let date else { return .none }
        let cal = Calendar.current
        if cal.isDateInToday(date) { return .today }
        if cal.isDateInTomorrow(date) { return .tomorrow }
        return .otherDay
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
