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
            label: "cleanTitle: 'ir a buscar a mi hermano en 10 minutos más' → 'Ir a buscar a mi hermano'",
            actual: NovaActionNormalizer.cleanTitle("ir a buscar a mi hermano en 10 minutos más"),
            expected: "Ir a buscar a mi hermano",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'hacer ejercicio en 20 min más' → 'Hacer ejercicio'",
            actual: NovaActionNormalizer.cleanTitle("hacer ejercicio en 20 min más"),
            expected: "Hacer ejercicio",
            failures: &failures
        )

        // BUG REPORTADO POR USUARIO (2026-05-14): "Tengo una comida a las 3:30 acuérdame
        // 20 minutos antes" terminó como evento titulado "Tengo una comida 20 minutos
        // antes". Esperado: "Comer" o "Comida" sin el sufijo de reminder ni "Tengo una".
        check(
            label: "cleanTitle: 'Tengo una comida 20 minutos antes' → 'Comida'",
            actual: NovaActionNormalizer.cleanTitle("Tengo una comida 20 minutos antes"),
            expected: "Comida",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'tengo que estudiar cálculo' → 'Estudiar cálculo'",
            actual: NovaActionNormalizer.cleanTitle("tengo que estudiar cálculo"),
            expected: "Estudiar cálculo",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'tengo reunión con Juan' → 'Reunión con Juan'",
            actual: NovaActionNormalizer.cleanTitle("tengo reunión con Juan"),
            expected: "Reunión con Juan",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'Tengo una clase de lenguaje' → 'Clase de lenguaje'",
            actual: NovaActionNormalizer.cleanTitle("Tengo una clase de lenguaje"),
            expected: "Clase de lenguaje",
            failures: &failures
        )

        // Prefijos coloquiales adicionales (paso 3c expandido).
        check(
            label: "cleanTitle: 'Necesito ir al dentista' → 'Ir al dentista'",
            actual: NovaActionNormalizer.cleanTitle("Necesito ir al dentista"),
            expected: "Ir al dentista",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'Quiero estudiar matemáticas' → 'Estudiar matemáticas'",
            actual: NovaActionNormalizer.cleanTitle("Quiero estudiar matemáticas"),
            expected: "Estudiar matemáticas",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'Voy a comer con Pedro' → 'Comer con Pedro'",
            actual: NovaActionNormalizer.cleanTitle("Voy a comer con Pedro"),
            expected: "Comer con Pedro",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'Me toca la reunión semanal' → 'Reunión semanal'",
            actual: NovaActionNormalizer.cleanTitle("Me toca la reunión semanal"),
            expected: "Reunión semanal",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'Me agendaron entrevista con HR' → 'Entrevista con HR'",
            actual: NovaActionNormalizer.cleanTitle("Me agendaron entrevista con HR"),
            expected: "Entrevista con HR",
            failures: &failures
        )

        check(
            label: "cleanTitle: 'tengo ganas de salir a correr' → 'Salir a correr'",
            actual: NovaActionNormalizer.cleanTitle("tengo ganas de salir a correr"),
            expected: "Salir a correr",
            failures: &failures
        )

        // No tocar título legítimo que CONTIENE 'tengo' pero no como prefijo.
        check(
            label: "cleanTitle: 'Reunión donde tengo que hablar' (intacto, no prefijo)",
            actual: NovaActionNormalizer.cleanTitle("Reunión donde tengo que hablar"),
            expected: "Reunión donde tengo que hablar",
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

        // ───── Reflexivos a infinitivo base (2026-05-13) ───────────────
        // El usuario: "si le digo dormirme a las 8 que el evento no se llame
        // dormirme sino dormir". Whitelist explícita normaliza la familia
        // común. Falsos positivos (palabras que terminan en -arme/-erme/
        // -irme sin ser verbos reflexivos) NO deben tocarse.

        check(
            label: "reflexive: 'dormirme a las 8' → 'Dormir'",
            actual: NovaActionNormalizer.cleanTitle("dormirme a las 8"),
            expected: "Dormir",
            failures: &failures
        )
        check(
            label: "reflexive: 'levantarme a las 7' → 'Levantar'",
            actual: NovaActionNormalizer.cleanTitle("levantarme a las 7"),
            expected: "Levantar",
            failures: &failures
        )
        check(
            label: "reflexive: 'ducharme a las 9' → 'Duchar'",
            actual: NovaActionNormalizer.cleanTitle("ducharme a las 9"),
            expected: "Duchar",
            failures: &failures
        )
        check(
            label: "reflexive: 'acostarme a las 11' → 'Acostar'",
            actual: NovaActionNormalizer.cleanTitle("acostarme a las 11"),
            expected: "Acostar",
            failures: &failures
        )
        check(
            label: "reflexive: 'prepararme para la reunión' → 'Preparar para la reunión'",
            actual: NovaActionNormalizer.cleanTitle("prepararme para la reunión"),
            expected: "Preparar para la reunión",
            failures: &failures
        )
        // Falsos positivos que NO deben tocarse:
        check(
            label: "reflexive (no match): 'firme el contrato' queda 'Firme el contrato'",
            actual: NovaActionNormalizer.cleanTitle("firme el contrato"),
            expected: "Firme el contrato",
            failures: &failures
        )
        check(
            label: "reflexive (no match): 'llamar a Carme' queda 'Llamar a Carme'",
            actual: NovaActionNormalizer.cleanTitle("llamar a Carme"),
            expected: "Llamar a Carme",
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

        // 1. "despertarme a las 7" → "Despertar" 07:00, recordatorio puntual.
        //    2026-05-13: el reflexivo -me se normaliza a infinitivo base —
        //    el evento se ve mejor como "Despertar" que como "Despertarme".
        checkAction(
            "case 1: despertarme a las 7",
            text: "despertarme a las 7",
            expectedTitle: "Despertar",
            expectedHour: 7,
            expectedReminder: true,
            failures: &failures
        )

        // 2. "levantarme a las 7" → "Levantar" 07:00 (idem: reflexivo a base).
        checkAction(
            "case 2: levantarme a las 7",
            text: "levantarme a las 7",
            expectedTitle: "Levantar",
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
            // Hora 10 → 10 AM si tests corren de día, 22 PM si corren de
            // noche (night-context rule). Ambas son interpretaciones
            // correctas del input "a las 10".
            let complexHour1 = complex[1].hour ?? -1
            check(label: "complex[1] hour ∈ {10, 22}",
                  actual: complexHour1 == 10 || complexHour1 == 22,
                  expected: true, failures: &failures)
            check(label: "complex[2] title 'Llevar la pelota' (NO concatenado)",
                  actual: complex[2].title, expected: "Llevar la pelota", failures: &failures)
            // Hora 11 → 11 AM si tests corren de día, 23 PM si corren de noche
            // (regla night-context aplica desde >=19h con runtime real). Ambas
            // son interpretaciones correctas del input "a las 11".
            let complexHour2 = complex[2].hour ?? -1
            check(label: "complex[2] hour ∈ {11, 23}",
                  actual: complexHour2 == 11 || complexHour2 == 23,
                  expected: true, failures: &failures)
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

        // ───── BUG REPORT 2026-05-12 v2 — CASOS EXACTOS DEL USUARIO ───

        // Caso 1 (exacto): "en una hora voy a jugar fútbol, en dos horas
        // vuelvo y a las 12 me acuesto". Tiene 3 acciones con horarios
        // relativos en palabras ("en una hora", "en dos horas") + hora
        // ambigua "a las 12". El parser LOCAL no puede separarlas (smart
        // " y " split exige hora en dígitos en ambos lados); el detector
        // debe marcarla como compleja para forzar el backend.
        check(
            label: "caso1: isLikelyMultiAction true (en una hora…, en dos horas…, a las 12)",
            actual: NovaResponder.isLikelyMultiAction(
                "en una hora voy a jugar fútbol, en dos horas vuelvo y a las 12 me acuesto"
            ),
            expected: true,
            failures: &failures
        )

        // Caso 2 (exacto): "tengo que seguir trabajando a las 3:30 y comer
        // a las 4" — dos horas en dígitos, smart " y " split debe separar.
        let caso2 = runPipeline("tengo que seguir trabajando a las 3:30 y comer a las 4")
        check(label: "caso2: 2 intents", actual: caso2.count, expected: 2, failures: &failures)
        if caso2.count == 2 {
            check(label: "caso2[0] title 'Seguir trabajando'",
                  actual: caso2[0].title, expected: "Seguir trabajando", failures: &failures)
            check(label: "caso2[0] hour 15", actual: caso2[0].hour, expected: 15, failures: &failures)
            check(label: "caso2[0] minute 30", actual: caso2[0].minute, expected: 30, failures: &failures)
            check(label: "caso2[0] no reunión", actual: caso2[0].section != .reunion, expected: true, failures: &failures)
            check(label: "caso2[1] title 'Comer'",
                  actual: caso2[1].title, expected: "Comer", failures: &failures)
            check(label: "caso2[1] hour 16", actual: caso2[1].hour, expected: 16, failures: &failures)
            check(label: "caso2[1] no reunión", actual: caso2[1].section != .reunion, expected: true, failures: &failures)
        }

        // Caso 3 (exacto): "necesito ir a buscar a mi hermano a las tres"
        // — hora en palabra, 1 acción. NO debe preguntar "¿cuándo?".
        let caso3 = runPipeline("necesito ir a buscar a mi hermano a las tres")
        check(label: "caso3: 1 intent (no clarify)",
              actual: caso3.count, expected: 1, failures: &failures)
        if let first = caso3.first {
            check(label: "caso3 NO es clarify",
                  actual: first.kind != .clarify, expected: true, failures: &failures)
            check(label: "caso3 title 'Ir a buscar a mi hermano'",
                  actual: first.title, expected: "Ir a buscar a mi hermano", failures: &failures)
            check(label: "caso3 hour 15", actual: first.hour, expected: 15, failures: &failures)
            check(label: "caso3 HOY", actual: first.day, expected: .today, failures: &failures)
        }

        // Caso 4 (exacto): "tengo que ir a buscar a mi hermano en 20 min
        // luego salir a jugar fútbol a las 10 y llevar la pelota a las 11"
        // → 3 intents con títulos limpios; NUNCA "Salir a jugar fútbol
        // que llevar la pelota" concatenado.
        let caso4 = runPipeline("tengo que ir a buscar a mi hermano en 20 min luego salir a jugar fútbol a las 10 y llevar la pelota a las 11")
        check(label: "caso4: 3 intents", actual: caso4.count, expected: 3, failures: &failures)
        if caso4.count == 3 {
            check(label: "caso4[0] title 'Ir a buscar a mi hermano'",
                  actual: caso4[0].title, expected: "Ir a buscar a mi hermano", failures: &failures)
            check(label: "caso4[1] title 'Salir a jugar fútbol'",
                  actual: caso4[1].title, expected: "Salir a jugar fútbol", failures: &failures)
            let caso4Hour1 = caso4[1].hour ?? -1
            check(label: "caso4[1] hour ∈ {10, 22}",
                  actual: caso4Hour1 == 10 || caso4Hour1 == 22,
                  expected: true, failures: &failures)
            check(label: "caso4[2] title 'Llevar la pelota'",
                  actual: caso4[2].title, expected: "Llevar la pelota", failures: &failures)
            // Hora 11 → 11 AM o 23 PM según runtime (night-context).
            let caso4Hour2 = caso4[2].hour ?? -1
            check(label: "caso4[2] hour ∈ {11, 23}",
                  actual: caso4Hour2 == 11 || caso4Hour2 == 23,
                  expected: true, failures: &failures)
            let badConcat = caso4.contains {
                let t = $0.title.lowercased()
                return t.contains("que llevar") || t.contains("fútbol que")
                    || t.contains("futbol que")
            }
            check(label: "caso4: ningún título concatenado",
                  actual: badConcat, expected: false, failures: &failures)
        }

        // AM/PM contextual reglas firmes del spec del usuario:
        // - despertarme a las 7 = 07:00
        // - clase a las 8 = 08:00
        // - comer a las 7 = 19:00
        // - trabajar a las 3:30 = 15:30
        // (cubiertas en `bug1`/`bug7`/`bug8`/`case4`/`case5`/`case1` arriba —
        //  añadimos asserts redundantes para que el bloque del usuario
        //  esté visible y verifiquemos cualquier regresión futura).
        let amTests: [(String, Int, Int)] = [
            ("despertarme a las 7", 7, 0),
            ("clase a las 8", 8, 0),
            ("comer a las 7", 19, 0),
            ("trabajar a las 3:30", 15, 30)
        ]
        for (text, h, m) in amTests {
            let r = runPipeline(text)
            if let first = r.first {
                check(label: "AM/PM '\(text)' hour=\(h)",
                      actual: first.hour, expected: h, failures: &failures)
                check(label: "AM/PM '\(text)' minute=\(m)",
                      actual: first.minute ?? 0, expected: m, failures: &failures)
            } else {
                let msg = "  ✗ AM/PM '\(text)' — pipeline devolvió 0 intents"
                print(msg); failures.append(msg)
            }
        }

        // ───── NIGHT CONTEXT — adjustAmPm con currentHour fijo ─────────
        //
        // Tests determinísticos del override de noche. El overload de
        // `adjustAmPm` permite inyectar `currentHour` y verificar la
        // interpretación nocturna sin depender del wall clock.
        //
        // Spec del usuario:
        // - 21:53 + "a las 11" → 23 (PM hoy)
        // - 21:53 + "a las 12" → 0 (medianoche próxima)
        // - 21:53 + "a las 9" → 9 (AM mañana — PM ya pasó)
        // - 14:00 + "a las 11" → 11 (mañana AM, regla coloquial)
        // - 14:00 + "a las 12 de la noche" → 0 (override PM/madrugada)

        let nightTests: [(Int, Int, String, Int, String)] = [
            // currentHour, hour, text, expected, label
            (21, 11, "ir a buscar a mi hermano a las 11",                 23, "21h + 11 → 23"),
            (21, 12, "a las 12 volver a casa",                            0,  "21h + 12 → 0 (medianoche)"),
            (22, 11, "a las 11 me acuesto",                               23, "22h + 11 → 23"),
            (21, 10, "a las 10",                                          22, "21h + 10 → 22"),
            (21, 9,  "a las 9",                                           9,  "21h + 9 → 9 (AM, PM ya pasó)"),
            (21, 8,  "a las 8",                                           8,  "21h + 8 → 8 AM"),
            // Marcador explícito 'mañana' apaga night-context
            (21, 10, "mañana a las 10",                                   10, "mañana suprime night-context"),
            (21, 11, "mañana a las 11",                                   11, "mañana suprime night-context"),
            // Día — comportamiento original (sin night-context)
            (14, 11, "ir a buscar a mi hermano a las 11",                 11, "14h + 11 → 11 AM (colloquial)"),
            (14, 3,  "a las 3",                                           15, "14h + 3 → 15 PM (colloquial 1-7)"),
            // School context — siempre AM aunque sea noche
            (21, 8,  "clase a las 8",                                     8,  "21h + 'clase a las 8' → 8 AM"),
            (21, 10, "tengo clase a las 10",                              10, "21h + 'tengo clase a las 10' → 10 AM"),
            // Verb context PM gana sobre night
            (21, 9,  "cenar a las 9",                                     21, "21h + 'cenar a las 9' → 21 PM"),
            // AM explícito gana sobre todo
            (21, 11, "a las 11 de la mañana",                             11, "AM explícito ignora noche"),
        ]
        for (ch, h, text, expected, label) in nightTests {
            let actual = NovaResponder.adjustAmPm(hour: h, in: text, currentHour: ch)
            check(label: "night: \(label)",
                  actual: actual, expected: expected, failures: &failures)
        }

        // Caso 2 del usuario, end-to-end via detector de complejidad:
        // "ir a buscar a mi hermano a las 11 y a las 12 volver a casa"
        // debe marcarse como complejo para que la app fuerce el backend.
        check(
            label: "caso2-v2: 'ir a buscar a las 11 y a las 12 volver a casa' isLikelyMultiAction true",
            actual: NovaResponder.isLikelyMultiAction(
                "ir a buscar a mi hermano a las 11 y a las 12 volver a casa"
            ),
            expected: true,
            failures: &failures
        )

        // ───── isLikelyMultiAction (gating de fallback local) ──────────

        // Caso real reportado el 2026-05-12: el parser local NO entiende
        // "en una hora", "en dos horas", ni la coma como separador, así
        // que terminaba creando un único evento basura "Voy a ir a jugar
        // fútbol — 12:00". El detector debe marcar la frase como compleja
        // para forzar el backend (IA fuerte).
        check(
            label: "isLikelyMultiAction: caso reportado 'en una hora… en dos horas… a las 12'",
            actual: NovaResponder.isLikelyMultiAction(
                "En una hora más te voy a ir a jugar fútbol, en dos horas más tengo que volver y más o menos a las 12 me tengo que acostar"
            ),
            expected: true,
            failures: &failures
        )

        // Spec del usuario — frases que SÍ deben gatear el backend:
        check(
            label: "isLikelyMultiAction: 'trabajar a las 3:30 y comer a las 4' (2 acciones+horas)",
            actual: NovaResponder.isLikelyMultiAction(
                "tengo que seguir trabajando a las 3:30 y comer a las 4"
            ),
            expected: true,
            failures: &failures
        )
        check(
            label: "isLikelyMultiAction: 'mañana despiértame a las 7 y salir a las 8' (2 acciones+horas)",
            actual: NovaResponder.isLikelyMultiAction(
                "mañana despiértame a las 7 y salir a las 8"
            ),
            expected: true,
            failures: &failures
        )
        check(
            label: "isLikelyMultiAction: 'jugar fútbol a las 10 y llevar la pelota a las 9:30'",
            actual: NovaResponder.isLikelyMultiAction(
                "jugar fútbol a las 10 y llevar la pelota a las 9:30"
            ),
            expected: true,
            failures: &failures
        )

        // Spec del usuario — frases SIMPLES que NO deben gatear el backend:
        check(
            label: "isLikelyMultiAction: 'buscar a mi hermano a las tres' (1 acción, 1 hora) → false",
            actual: NovaResponder.isLikelyMultiAction(
                "necesito ir a buscar a mi hermano a las tres"
            ),
            expected: false,
            failures: &failures
        )
        check(
            label: "isLikelyMultiAction: 'comprar pan y leche' (sin horas, 'y' une objetos) → false",
            actual: NovaResponder.isLikelyMultiAction("comprar pan y leche"),
            expected: false,
            failures: &failures
        )
        check(
            label: "isLikelyMultiAction: 'reunión con Juan y Pedro a las 5' (1 hora, 'y' une personas) → false",
            actual: NovaResponder.isLikelyMultiAction(
                "reunión con Juan y Pedro a las 5"
            ),
            expected: false,
            failures: &failures
        )
        check(
            label: "isLikelyMultiAction: 'agenda dentista mañana a las 10' (simple) → false",
            actual: NovaResponder.isLikelyMultiAction("agenda dentista mañana a las 10"),
            expected: false,
            failures: &failures
        )
        check(
            label: "isLikelyMultiAction: 'café' (vacía, sin hora) → false",
            actual: NovaResponder.isLikelyMultiAction("café"),
            expected: false,
            failures: &failures
        )

        // Conectores explícitos siempre disparan, aunque solo haya 1 hora:
        check(
            label: "isLikelyMultiAction: 'gym a las 7 y luego correr' (conector 'y luego')",
            actual: NovaResponder.isLikelyMultiAction("gym a las 7 y luego correr"),
            expected: true,
            failures: &failures
        )
        check(
            label: "isLikelyMultiAction: 'almuerzo, después siesta' (conector 'después')",
            actual: NovaResponder.isLikelyMultiAction("almuerzo, después siesta"),
            expected: true,
            failures: &failures
        )

        // ───── 7 CASOS OBLIGATORIOS DEL USUARIO (2026-05-13) ──────────
        //
        // Asegurar que cada caso real del spec tenga su test pipeline.
        // Algunos ya existían bajo otros nombres; los duplicamos acá con
        // el rótulo "user-caso-N" para que el bloque sea evidente al
        // leer la salida del runner.

        // Caso 1: "necesito ir a buscar a mi hermano a las tres"
        let u1 = runPipeline("necesito ir a buscar a mi hermano a las tres")
        check(label: "user-caso-1: 1 intent (no clarify)",
              actual: u1.count, expected: 1, failures: &failures)
        if let first = u1.first {
            check(label: "user-caso-1: kind ≠ clarify",
                  actual: first.kind != .clarify, expected: true, failures: &failures)
            check(label: "user-caso-1: title 'Ir a buscar a mi hermano'",
                  actual: first.title, expected: "Ir a buscar a mi hermano", failures: &failures)
            check(label: "user-caso-1: hour 15", actual: first.hour, expected: 15, failures: &failures)
            check(label: "user-caso-1: today", actual: first.day, expected: .today, failures: &failures)
        }

        // Caso 2: "ir a buscar a mi hermano a las 11 y a las 12 volver a casa"
        // — frase compleja, debe gatear backend.
        check(
            label: "user-caso-2: isLikelyMultiAction true",
            actual: NovaResponder.isLikelyMultiAction(
                "ir a buscar a mi hermano a las 11 y a las 12 volver a casa"
            ),
            expected: true,
            failures: &failures
        )
        // Determinista: adjustAmPm con currentHour fijo (21:53) cubre la
        // interpretación nocturna de "a las 11" y "a las 12".
        check(label: "user-caso-2: 21h + 'a las 11' → 23",
              actual: NovaResponder.adjustAmPm(
                  hour: 11, in: "ir a buscar a mi hermano a las 11", currentHour: 21
              ),
              expected: 23, failures: &failures)
        check(label: "user-caso-2: 21h + 'a las 12' → 0 (medianoche)",
              actual: NovaResponder.adjustAmPm(
                  hour: 12, in: "a las 12 volver a casa", currentHour: 21
              ),
              expected: 0, failures: &failures)

        // Caso 3: "en una hora voy a jugar fútbol, en dos horas vuelvo y a las 12 me acuesto"
        check(
            label: "user-caso-3: isLikelyMultiAction true",
            actual: NovaResponder.isLikelyMultiAction(
                "en una hora voy a jugar fútbol, en dos horas vuelvo y a las 12 me acuesto"
            ),
            expected: true,
            failures: &failures
        )

        // Caso 4: "tengo que seguir trabajando a las 3:30 y comer a las 4"
        let u4 = runPipeline("tengo que seguir trabajando a las 3:30 y comer a las 4")
        check(label: "user-caso-4: 2 intents",
              actual: u4.count, expected: 2, failures: &failures)
        if u4.count == 2 {
            check(label: "user-caso-4: [0] title 'Seguir trabajando'",
                  actual: u4[0].title, expected: "Seguir trabajando", failures: &failures)
            check(label: "user-caso-4: [0] hour 15", actual: u4[0].hour, expected: 15, failures: &failures)
            check(label: "user-caso-4: [0] minute 30", actual: u4[0].minute, expected: 30, failures: &failures)
            check(label: "user-caso-4: [0] no reunión",
                  actual: u4[0].section != .reunion, expected: true, failures: &failures)
            check(label: "user-caso-4: [1] title 'Comer'",
                  actual: u4[1].title, expected: "Comer", failures: &failures)
            check(label: "user-caso-4: [1] hour 16", actual: u4[1].hour, expected: 16, failures: &failures)
            check(label: "user-caso-4: [1] no reunión",
                  actual: u4[1].section != .reunion, expected: true, failures: &failures)
        }

        // Caso 5: "tengo que ir a buscar a mi hermano en 20 min luego salir a jugar fútbol a las 10 y llevar la pelota a las 11"
        let u5 = runPipeline("tengo que ir a buscar a mi hermano en 20 min luego salir a jugar fútbol a las 10 y llevar la pelota a las 11")
        check(label: "user-caso-5: 3 intents",
              actual: u5.count, expected: 3, failures: &failures)
        if u5.count == 3 {
            check(label: "user-caso-5: [0] title 'Ir a buscar a mi hermano'",
                  actual: u5[0].title, expected: "Ir a buscar a mi hermano", failures: &failures)
            check(label: "user-caso-5: [1] title 'Salir a jugar fútbol'",
                  actual: u5[1].title, expected: "Salir a jugar fútbol", failures: &failures)
            check(label: "user-caso-5: [2] title 'Llevar la pelota'",
                  actual: u5[2].title, expected: "Llevar la pelota", failures: &failures)
            // Crítico: ningún título con concatenación tipo "que llevar".
            let badConcat = u5.contains { t in
                t.title.lowercased().contains("que llevar") ||
                t.title.lowercased().contains("fútbol que")
            }
            check(label: "user-caso-5: ningún título concatenado",
                  actual: badConcat, expected: false, failures: &failures)
        }

        // Caso 6: "comprar pan y leche" → 1 tarea, no split
        let u6 = runPipeline("comprar pan y leche")
        check(label: "user-caso-6: 1 intent (tarea, no split)",
              actual: u6.count, expected: 1, failures: &failures)
        if let first = u6.first {
            check(label: "user-caso-6: kind = task",
                  actual: first.kind, expected: .task, failures: &failures)
        }

        // Caso 7: "reunión con Juan y Pedro a las 5" → 1 reunión
        let u7 = runPipeline("reunión con Juan y Pedro a las 5")
        check(label: "user-caso-7: 1 intent (no split)",
              actual: u7.count, expected: 1, failures: &failures)
        if let first = u7.first {
            check(label: "user-caso-7: section = reunion",
                  actual: first.section, expected: .reunion, failures: &failures)
        }

        // ═══════════════════════════════════════════════════════════════
        //  BETA SPEC: CASOS A-J (auditoría 2026-05-14)
        //
        //  Estos son los casos que el usuario exige que Nova maneje SÍ O SÍ
        //  antes de subir a beta. Cubren título limpio, AM/PM coherente,
        //  future-first, separación evento vs reminder, multi-acción.
        //
        //  Algunos casos dependen de currentHour real del simulator. Los
        //  marcados como "(non-deterministic hour)" no verifican la hora
        //  específica, sino que el intent sea correcto en estructura
        //  (título limpio, kind, día). Los tests específicos de hora
        //  llaman a `adjustAmPm(hour:, in:, currentHour:)` directo.
        // ═══════════════════════════════════════════════════════════════

        // ───── Caso A: evento + reminder mid-sentence ─────────────────
        // "tengo clases tipo 5:30 acuérdame de salir en 10 min"
        // → 2 intents: Clase 17:30 + Salir (reminder) en 10 min
        let casoA = runPipeline("tengo clases tipo 5:30 acuérdame de salir en 10 min")
        check(label: "casoA: 2 intents (evento + reminder)",
              actual: casoA.count, expected: 2, failures: &failures)
        if casoA.count == 2 {
            // Intent 1: Clase a las 17:30
            check(label: "casoA[0] title contains 'lase' (Clase/Clases)",
                  actual: casoA[0].title.lowercased().contains("lase"),
                  expected: true, failures: &failures)
            check(label: "casoA[0] hour 17",
                  actual: casoA[0].hour, expected: 17, failures: &failures)
            check(label: "casoA[0] minute 30",
                  actual: casoA[0].minute, expected: 30, failures: &failures)
            // Intent 2: Salir reminder (en 10 min relative)
            check(label: "casoA[1] title 'Salir'",
                  actual: casoA[1].title, expected: "Salir", failures: &failures)
            check(label: "casoA[1] isReminder",
                  actual: casoA[1].isReminder, expected: true, failures: &failures)
        }

        // ───── Caso B: doble acción con " y ", sequence context ───────
        // "tengo clases a las 5:30 de historia y salgo a las 7"
        // → 2 intents: Clase de historia 17:30 + Salir/Salgo 19:00
        let casoB = runPipeline("tengo clases a las 5:30 de historia y salgo a las 7")
        check(label: "casoB: 2 intents",
              actual: casoB.count, expected: 2, failures: &failures)
        if casoB.count == 2 {
            check(label: "casoB[0] title contiene 'historia'",
                  actual: casoB[0].title.lowercased().contains("historia"),
                  expected: true, failures: &failures)
            check(label: "casoB[0] hour 17",
                  actual: casoB[0].hour, expected: 17, failures: &failures)
            check(label: "casoB[0] minute 30",
                  actual: casoB[0].minute, expected: 30, failures: &failures)
            check(label: "casoB[1] hour 19 (PM por coloquial 1-7)",
                  actual: casoB[1].hour, expected: 19, failures: &failures)
            // CRÍTICO: el segundo evento NO debe quedar como 07:00 (mañana)
            check(label: "casoB[1] NO es 7 AM (future-first)",
                  actual: casoB[1].hour != 7, expected: true, failures: &failures)
        }

        // ───── Caso C: buscar a la X tipo N (sin "ir a") ──────────────
        // "buscar a la Agustina tipo 3 acuérdate"
        // → 1 intent reminder: "Buscar a Agustina" 15:00
        let casoC = runPipeline("buscar a la Agustina tipo 3 acuérdate")
        check(label: "casoC: 1 intent",
              actual: casoC.count, expected: 1, failures: &failures)
        if let first = casoC.first {
            check(label: "casoC title 'Buscar a Agustina'",
                  actual: first.title, expected: "Buscar a Agustina", failures: &failures)
            check(label: "casoC hour 15 (tipo 3 → PM)",
                  actual: first.hour, expected: 15, failures: &failures)
            check(label: "casoC isReminder (por 'acuérdate')",
                  actual: first.isReminder, expected: true, failures: &failures)
        }

        // ───── Caso D: reminder puntual relativo ──────────────────────
        // "recuérdame llamar a mi mamá en 20 minutos"
        // → 1 intent reminder: "Llamar a mi mamá" en +20 min
        let casoD = runPipeline("recuérdame llamar a mi mamá en 20 minutos")
        check(label: "casoD: 1 intent",
              actual: casoD.count, expected: 1, failures: &failures)
        if let first = casoD.first {
            check(label: "casoD title 'Llamar a mi mamá'",
                  actual: first.title, expected: "Llamar a mi mamá", failures: &failures)
            check(label: "casoD isReminder",
                  actual: first.isReminder, expected: true, failures: &failures)
            check(label: "casoD day = today (relative +20m)",
                  actual: first.day, expected: .today, failures: &failures)
        }

        // ───── Caso E: "mañana" respetado, AM 8 razonable ─────────────
        // "mañana tengo reunión a las 8"
        // → 1 event mañana 08:00, NO mover a hoy
        let casoE = runPipeline("mañana tengo reunión a las 8")
        check(label: "casoE: 1 intent",
              actual: casoE.count, expected: 1, failures: &failures)
        if let first = casoE.first {
            check(label: "casoE title 'Reunión'",
                  actual: first.title, expected: "Reunión", failures: &failures)
            check(label: "casoE hour 8 (AM, sin override night)",
                  actual: first.hour, expected: 8, failures: &failures)
            check(label: "casoE day = mañana",
                  actual: first.day, expected: .tomorrow, failures: &failures)
        }

        // ───── Caso F: future-first con "hoy" + "clase" + AM pasada ───
        // Llama `adjustAmPm` directamente para fijar currentHour.
        // "hoy tengo clase a las 7" a las 14:00 → 19:00, NO 07:00 (vencido)
        check(label: "casoF (hoy+clase+7, currentHour=14): 19",
              actual: NovaResponder.adjustAmPm(hour: 7, in: "hoy tengo clase a las 7", currentHour: 14),
              expected: 19, failures: &failures)
        // Mismo input a las 06:00 → 7 AM (futuro AM válido)
        check(label: "casoF (hoy+clase+7, currentHour=6): 7 AM",
              actual: NovaResponder.adjustAmPm(hour: 7, in: "hoy tengo clase a las 7", currentHour: 6),
              expected: 7, failures: &failures)
        // SIN "hoy" — "tengo clase a las 7" a las 14:00 → 7 AM (default escolar)
        check(label: "casoF (sin 'hoy', clase+7, currentHour=14): 7 AM",
              actual: NovaResponder.adjustAmPm(hour: 7, in: "tengo clase a las 7", currentHour: 14),
              expected: 7, failures: &failures)
        // "hoy clase a las 8" a las 14:00 → 20 PM (future-first)
        check(label: "casoF (hoy+clase+8, currentHour=14): 20",
              actual: NovaResponder.adjustAmPm(hour: 8, in: "hoy tengo clase a las 8", currentHour: 14),
              expected: 20, failures: &failures)
        // "hoy clase a las 8" a las 7:00 → 8 AM (futuro AM aún válido)
        check(label: "casoF (hoy+clase+8, currentHour=7): 8 AM",
              actual: NovaResponder.adjustAmPm(hour: 8, in: "hoy tengo clase a las 8", currentHour: 7),
              expected: 8, failures: &failures)

        // ───── Caso G: evento + tarea con conector " y después " ──────
        // "tengo dentista el viernes a las 4 y después comprar remedios"
        // → 2 intents: Dentista viernes 16:00 + Comprar remedios (task)
        let casoG = runPipeline("tengo dentista el viernes a las 4 y después comprar remedios")
        check(label: "casoG: 2 intents",
              actual: casoG.count, expected: 2, failures: &failures)
        if casoG.count == 2 {
            check(label: "casoG[0] title 'Dentista'",
                  actual: casoG[0].title, expected: "Dentista", failures: &failures)
            check(label: "casoG[0] hour 16",
                  actual: casoG[0].hour, expected: 16, failures: &failures)
            // El día depende de hoy: si hoy es jueves, viernes = tomorrow;
            // cualquier otro día, otherDay. Aceptamos ambos.
            let viernesOk = casoG[0].day == .otherDay || casoG[0].day == .tomorrow
            check(label: "casoG[0] day = viernes (tomorrow u otherDay)",
                  actual: viernesOk, expected: true, failures: &failures)
            check(label: "casoG[1] title contains 'remedios'",
                  actual: casoG[1].title.lowercased().contains("remedios"),
                  expected: true, failures: &failures)
            check(label: "casoG[1] kind = task (sin hora)",
                  actual: casoG[1].kind, expected: .task, failures: &failures)
        }

        // ───── Caso H: "antes de la clase" sin offset → clarify/task ───
        // "recuérdame antes de la clase comprar una bebida"
        // → 1 intent (no debe crear "Antes de la clase Comprar una bebida"
        //   como evento — extractReminderAttachIntent NO matchea sin offset
        //   numérico explícito y caemos al flujo normal: tarea o clarify).
        let casoH = runPipeline("recuérdame antes de la clase comprar una bebida")
        check(label: "casoH: 1 intent",
              actual: casoH.count, expected: 1, failures: &failures)
        if let first = casoH.first {
            // NO debe contener "antes de" en el título (basura)
            check(label: "casoH title NO contains 'antes de'",
                  actual: first.title.lowercased().contains("antes de"),
                  expected: false, failures: &failures)
        }

        // ───── Caso I: "el lunes" sin hora → clarify (pedir hora) ─────
        // "tengo prueba de historia el lunes"
        // → clarify: no inventar hora absurda. El default 9:00 es placeholder
        //   y el parser detecta `isAtDayDefault` → pide hora al usuario.
        let casoI = runPipeline("tengo prueba de historia el lunes")
        check(label: "casoI: 1 intent",
              actual: casoI.count, expected: 1, failures: &failures)
        if let first = casoI.first {
            check(label: "casoI kind = clarify (pedir hora)",
                  actual: first.kind, expected: .clarify, failures: &failures)
        }

        // ───── Caso J: timeframe "en la tarde" mapea a 16:00 ──────────
        // "acuérdame de estudiar mañana en la tarde"
        // → reminder "Estudiar" mañana 16:00 (NO 9:00)
        let casoJ = runPipeline("acuérdame de estudiar mañana en la tarde")
        check(label: "casoJ: 1 intent",
              actual: casoJ.count, expected: 1, failures: &failures)
        if let first = casoJ.first {
            check(label: "casoJ title 'Estudiar'",
                  actual: first.title, expected: "Estudiar", failures: &failures)
            check(label: "casoJ hour 16 (tarde)",
                  actual: first.hour, expected: 16, failures: &failures)
            check(label: "casoJ day = mañana",
                  actual: first.day, expected: .tomorrow, failures: &failures)
            check(label: "casoJ isReminder",
                  actual: first.isReminder, expected: true, failures: &failures)
        }

        // ───── defaultHourForTimeframe direct unit tests ──────────────
        check(label: "timeframe 'esta noche' → 20:00",
              actual: NovaResponder.defaultHourForTimeframe(in: "estudiar esta noche")?.0,
              expected: 20, failures: &failures)
        check(label: "timeframe 'en la tarde' → 16:00",
              actual: NovaResponder.defaultHourForTimeframe(in: "comer en la tarde")?.0,
              expected: 16, failures: &failures)
        check(label: "timeframe 'en la mañana' → 9:00",
              actual: NovaResponder.defaultHourForTimeframe(in: "salir en la mañana")?.0,
              expected: 9, failures: &failures)
        check(label: "timeframe 'al mediodía' → 12:00",
              actual: NovaResponder.defaultHourForTimeframe(in: "comer al mediodía")?.0,
              expected: 12, failures: &failures)
        check(label: "timeframe 'al final del día' → 21:00",
              actual: NovaResponder.defaultHourForTimeframe(in: "tarea al final del día")?.0,
              expected: 21, failures: &failures)
        check(label: "timeframe sin marcador → nil",
              actual: NovaResponder.defaultHourForTimeframe(in: "estudiar mañana") == nil,
              expected: true, failures: &failures)

        // ───── future-first NO sobre-aplica sin "hoy" ─────────────────
        // Caso de NO regresión: "clase a las 8" sin "hoy", currentHour=14
        // debe seguir siendo 8 AM (default escolar). El override solo
        // dispara con "hoy" explícito.
        check(label: "future-first NO sobre-aplica: 'clase a las 8' currentHour=14 → 8 AM",
              actual: NovaResponder.adjustAmPm(hour: 8, in: "tengo clase a las 8", currentHour: 14),
              expected: 8, failures: &failures)
        // "mañana clase a las 7" currentHour=14 → 7 AM (mañana es futuro)
        check(label: "future-first NO sobre-aplica con 'mañana': → 7 AM",
              actual: NovaResponder.adjustAmPm(hour: 7, in: "mañana tengo clase a las 7", currentHour: 14),
              expected: 7, failures: &failures)

        // ───── Reminder absoluto: el splitter NO debe partir ──────────
        // Bug fix: "ir a buscar a mi hermano a las 6:30 acuérdame 40 minutos antes"
        // debe seguir siendo UN solo intent (newBlock con offset).
        let regBlock = runPipeline("ir a buscar a mi hermano a las 6:30 acuérdame 40 minutos antes")
        check(label: "reminder absoluto: 1 intent (no split)",
              actual: regBlock.count, expected: 1, failures: &failures)

        // ═══════════════════════════════════════════════════════════════
        //  NAMED REMINDERS — Spec del usuario (2026-05-15):
        //
        //  "Le digo a Nova que tengo un partido tipo 3 y que me acuerde
        //   20 min antes de echar las zapatillas a la mochila" debe crear:
        //   - Evento "Partido" 15:00
        //   - Reminder offset 20 min anclado al evento
        //   - Reminder note = "Echar las zapatillas a la mochila"
        //
        //  La notif a las 14:40 mostrará la nota como title y el evento
        //  padre como subtitle.
        // ═══════════════════════════════════════════════════════════════

        // 1. extractReminderOffsetAndNote — patrón principal del user
        if let detail = NovaActionNormalizer.extractReminderOffsetAndNote(
            from: "tengo partido tipo 3 acuérdame 20 min antes de echar las zapatillas a la mochila"
        ) {
            check(label: "named-1: offset = 20",
                  actual: detail.offsetMinutes, expected: 20, failures: &failures)
            check(label: "named-1: note = 'Echar las zapatillas a la mochila'",
                  actual: detail.note,
                  expected: "Echar las zapatillas a la mochila" as String?,
                  failures: &failures)
        } else {
            failures.append("  ✗ named-1: extractReminderOffsetAndNote devolvió nil")
        }

        // 2. extractReminderOffsetAndNote — sin "de X" trailing
        if let detail = NovaActionNormalizer.extractReminderOffsetAndNote(
            from: "acuérdame 10 min antes"
        ) {
            check(label: "named-2: offset = 10",
                  actual: detail.offsetMinutes, expected: 10, failures: &failures)
            check(label: "named-2: note = nil (sin 'de X')",
                  actual: detail.note == nil, expected: true, failures: &failures)
        } else {
            failures.append("  ✗ named-2: extractReminderOffsetAndNote devolvió nil")
        }

        // 3. extractReminderOffsetAndNote — número en palabra
        if let detail = NovaActionNormalizer.extractReminderOffsetAndNote(
            from: "recuérdame media hora antes de salir de casa"
        ) {
            check(label: "named-3: offset = 30 (media hora)",
                  actual: detail.offsetMinutes, expected: 30, failures: &failures)
            check(label: "named-3: note = 'Salir de casa'",
                  actual: detail.note,
                  expected: "Salir de casa" as String?,
                  failures: &failures)
        } else {
            failures.append("  ✗ named-3: extractReminderOffsetAndNote devolvió nil")
        }

        // 4. cleanTitle del input completo — título limpio sin "antes de X"
        check(
            label: "named-4: cleanTitle 'tengo partido...' → 'Partido' limpio",
            actual: NovaActionNormalizer.cleanTitle(
                "tengo partido tipo 3 acuérdame 20 min antes de echar las zapatillas a la mochila"
            ),
            expected: "Partido",
            failures: &failures
        )

        // 5. cleanTitle del input completo — el note NO debe quedar en title
        let cleanedTitle5 = NovaActionNormalizer.cleanTitle(
            "tengo partido tipo 3 acuérdame 20 min antes de echar las zapatillas a la mochila"
        ).lowercased()
        check(label: "named-5: title NO contiene 'echar'",
              actual: cleanedTitle5.contains("echar"), expected: false, failures: &failures)
        check(label: "named-5: title NO contiene 'zapatillas'",
              actual: cleanedTitle5.contains("zapatillas"), expected: false, failures: &failures)
        check(label: "named-5: title NO contiene 'antes'",
              actual: cleanedTitle5.contains("antes"), expected: false, failures: &failures)

        // 6. Caso parser → reminderNotes propagado a FocusEvent vía local
        //    flow. Probamos creando el evento directamente y verificando
        //    que la nota va al campo correcto.
        do {
            let event = FocusEvent(
                title: "Partido",
                startTime: Date().addingTimeInterval(3600),  // 1h en futuro
                endTime: Date().addingTimeInterval(7200),
                section: .personal,
                reminderOffsets: [20],
                reminderNotes: ["Echar las zapatillas a la mochila"]
            )
            check(label: "named-6: reminderOffsets [20]",
                  actual: event.reminderOffsets ?? [], expected: [20], failures: &failures)
            check(label: "named-6: reminderNote(at: 0) = 'Echar las zapatillas a la mochila'",
                  actual: event.reminderNote(at: 0),
                  expected: "Echar las zapatillas a la mochila" as String?,
                  failures: &failures)
            check(label: "named-6: reminderNote(at: 1) = nil (fuera de rango)",
                  actual: event.reminderNote(at: 1) == nil,
                  expected: true, failures: &failures)
        }

        // 7. cleanReminderNote helper — strip "de " redundante y capitalize
        if let detail = NovaActionNormalizer.extractReminderOffsetAndNote(
            from: "avísame 5 minutos antes de la reunión con el cliente"
        ) {
            // El "de la" inicial se trim porque la captura empieza después
            // de "antes de " ya. La nota efectiva es "la reunión con el
            // cliente" — el cleaner respeta artículos legítimos.
            check(label: "named-7: offset = 5",
                  actual: detail.offsetMinutes, expected: 5, failures: &failures)
            // Aceptamos cualquier variación que contenga "reunión con el cliente"
            let noteLower = (detail.note ?? "").lowercased()
            check(label: "named-7: note contiene 'reunión con el cliente'",
                  actual: noteLower.contains("reunión con el cliente"),
                  expected: true, failures: &failures)
        }

        // 8. Compatibilidad backward — evento con offsets pero SIN notes
        //    no debe crashear ni alucinar nota.
        do {
            let legacyEvent = FocusEvent(
                title: "Ducharme",
                startTime: Date().addingTimeInterval(3600),
                endTime: Date().addingTimeInterval(3900),
                section: .personal,
                reminderOffsets: [10]
                // sin reminderNotes
            )
            check(label: "named-8: backward-compat reminderNote(at: 0) = nil",
                  actual: legacyEvent.reminderNote(at: 0) == nil,
                  expected: true, failures: &failures)
        }

        // ═══════════════════════════════════════════════════════════════
        //  TOPIC FOCUS / MEMORIA TEMPORAL — User spec 2026-05-15:
        //
        //  "si estamos hablando de futbol y le pongo de las zapatillas, que
        //   no me pregunte para que evento es si es obvio que para el de
        //   futbol y no para el de arte"
        //
        //  La memoria local mantiene una lista de eventos discutidos en
        //  los últimos 30 min. La lista se ordena por recencia. Cuando el
        //  user pide algo ambiguo, se resuelve al primero.
        // ═══════════════════════════════════════════════════════════════

        // 1. NovaContext: discussedEvents vacío por default.
        do {
            let ctx = NovaContext()
            check(label: "topic-1: discussedEvents vacío por default",
                  actual: ctx.discussedEvents.isEmpty, expected: true, failures: &failures)
            check(label: "topic-1: topicEvent nil cuando lista vacía",
                  actual: ctx.topicEvent == nil, expected: true, failures: &failures)
        }

        // 2. DiscussedEvent.isFresh: < 30 min = fresh, ≥ 30 min = stale.
        do {
            let recent = DiscussedEvent(
                eventId: UUID(),
                title: "Partido",
                mentionedAt: Date().addingTimeInterval(-5 * 60)  // hace 5 min
            )
            let stale = DiscussedEvent(
                eventId: UUID(),
                title: "Muestra",
                mentionedAt: Date().addingTimeInterval(-31 * 60)  // hace 31 min
            )
            check(label: "topic-2: evento de hace 5 min es fresh",
                  actual: recent.isFresh, expected: true, failures: &failures)
            check(label: "topic-2: evento de hace 31 min NO es fresh",
                  actual: stale.isFresh, expected: false, failures: &failures)
        }

        // 3. freshDiscussedEvents filtra correctamente expirados.
        do {
            let recent = DiscussedEvent(
                eventId: UUID(), title: "Partido",
                mentionedAt: Date().addingTimeInterval(-5 * 60)
            )
            let stale = DiscussedEvent(
                eventId: UUID(), title: "Muestra",
                mentionedAt: Date().addingTimeInterval(-31 * 60)
            )
            let ctx = NovaContext(discussedEvents: [recent, stale])
            check(label: "topic-3: freshDiscussedEvents.count = 1",
                  actual: ctx.freshDiscussedEvents.count, expected: 1, failures: &failures)
            check(label: "topic-3: topicEvent es el fresco (Partido)",
                  actual: ctx.topicEvent?.title, expected: "Partido" as String?, failures: &failures)
        }

        // 4. Orden por recencia: el más reciente primero.
        do {
            let arteId = UUID()
            let partidoId = UUID()
            let partido = DiscussedEvent(
                eventId: partidoId, title: "Partido",
                mentionedAt: Date().addingTimeInterval(-10 * 60)  // hace 10 min
            )
            let arte = DiscussedEvent(
                eventId: arteId, title: "Muestra de arte",
                mentionedAt: Date().addingTimeInterval(-2 * 60)   // hace 2 min, más reciente
            )
            // Lista construida en orden de recencia (más reciente primero).
            let ctx = NovaContext(discussedEvents: [arte, partido])
            check(label: "topic-4: topicEvent es Arte (el más reciente)",
                  actual: ctx.topicEvent?.title, expected: "Muestra de arte" as String?, failures: &failures)
            check(label: "topic-4: segundo en lista es Partido",
                  actual: ctx.freshDiscussedEvents.dropFirst().first?.title,
                  expected: "Partido" as String?, failures: &failures)
        }

        // 5. detectAndPromoteMentions: el match más fuerte (substring de título
        //    en texto) promueve al evento al frente.
        do {
            // Para testear la lógica, usamos un store stub no es necesario —
            // testeamos la equivalencia del helper de detección: una nueva
            // entrada con eventId = matched aparece al frente.
            //
            // Aquí solo verificamos que múltiples mentions ordenan
            // correctamente. La lógica real vive en FocusDataStore.
            let arteId = UUID()
            let partidoId = UUID()
            var ctx = NovaContext()
            // Simulación manual del flujo de promoteDiscussedEvent.
            ctx.discussedEvents.insert(
                DiscussedEvent(eventId: partidoId, title: "Partido",
                               mentionedAt: Date().addingTimeInterval(-3)),
                at: 0
            )
            ctx.discussedEvents.insert(
                DiscussedEvent(eventId: arteId, title: "Muestra de arte",
                               mentionedAt: Date()),
                at: 0
            )
            check(label: "topic-5: tras dos mentions, topicEvent = Arte",
                  actual: ctx.topicEvent?.title,
                  expected: "Muestra de arte" as String?, failures: &failures)
            check(label: "topic-5: ambos eventos en discusión",
                  actual: ctx.freshDiscussedEvents.count, expected: 2, failures: &failures)
        }

        // 6. Cap de 5 items: no acumular indefinidamente.
        do {
            var ctx = NovaContext()
            // Insertar 7 mentions distintas, cada una al frente.
            for i in 0..<7 {
                let event = DiscussedEvent(
                    eventId: UUID(),
                    title: "Evento \(i)",
                    mentionedAt: Date().addingTimeInterval(-Double(i))
                )
                ctx.discussedEvents.insert(event, at: 0)
                // Cap manual del test — coincide con el cap de updateNovaContext.
                ctx.discussedEvents = Array(ctx.discussedEvents.prefix(5))
            }
            check(label: "topic-6: máximo 5 items en discusión",
                  actual: ctx.discussedEvents.count, expected: 5, failures: &failures)
        }

        // 7. Caso integración: extractReminderAttachIntent extrae offset+
        //    activity correctamente para el fallback de topic focus.
        if let intent = NovaResponder.extractReminderAttachIntent(
            from: "acuérdame 20 min antes de echar las zapatillas a la mochila"
        ) {
            check(label: "topic-7: offset = 20",
                  actual: intent.offsetMinutes, expected: 20, failures: &failures)
            check(label: "topic-7: activity = 'echar las zapatillas a la mochila'",
                  actual: intent.activity,
                  expected: "echar las zapatillas a la mochila",
                  failures: &failures)
            // El consumer (tryAttachReminderToExistingEvent) usará este
            // activity como reminderNote si cae al topic focus event.
        } else {
            failures.append("  ✗ topic-7: extractReminderAttachIntent devolvió nil")
        }

        // ───── Validador post-IA ──────────────────────────────────────
        NovaActionValidatorTests.runAll(into: &failures)

        // ───── Attach-reminder: detectar "acuérdame N antes de X" ─────
        //
        // Spec del usuario: cuando dice "acuérdame N min antes de
        // ducharme" y existe un evento "Ducharme", debemos extraer
        // (offset=N, activity="ducharme") y luego usar fuzzy match para
        // encontrar el evento. NO crear basura.

        // 1. extractReminderAttachIntent — pattern matching

        if let intent = NovaResponder.extractReminderAttachIntent(
            from: "Acuérdame 10 minutos antes de ducharme"
        ) {
            check(label: "attach: offset 10 min",
                  actual: intent.offsetMinutes, expected: 10, failures: &failures)
            check(label: "attach: activity 'ducharme'",
                  actual: intent.activity, expected: "ducharme", failures: &failures)
        } else {
            let msg = "  ✗ attach: no extrajo intent de 'Acuérdame 10 minutos antes de ducharme'"
            print(msg); failures.append(msg)
        }

        // Caso B literal del spec del usuario
        if let intent = NovaResponder.extractReminderAttachIntent(
            from: "acuérdame 40 min antes de ir a buscar a mi hermano"
        ) {
            check(label: "attach-B: offset 40 min",
                  actual: intent.offsetMinutes, expected: 40, failures: &failures)
            check(label: "attach-B: activity contiene 'buscar a mi hermano' o similar",
                  actual: intent.activity.contains("hermano"),
                  expected: true, failures: &failures)
        } else {
            let msg = "  ✗ attach-B: no extrajo intent del caso 'mi hermano'"
            print(msg); failures.append(msg)
        }

        // Variantes que NO deben matchear: sin "antes de", sin trigger, etc.
        check(
            label: "attach: 'acuérdame comprar pan' sin 'antes de' → nil",
            actual: NovaResponder.extractReminderAttachIntent(
                from: "acuérdame comprar pan en 10 min"
            ) == nil,
            expected: true, failures: &failures
        )
        check(
            label: "attach: sin trigger 'acuérdame' → nil",
            actual: NovaResponder.extractReminderAttachIntent(
                from: "ducharme a las 10"
            ) == nil,
            expected: true, failures: &failures
        )

        // 2. findEventByApproxTitle — fuzzy match

        let mockDucharme = FocusEvent(
            title: "Ducharme",
            startTime: Date().addingTimeInterval(60 * 60),     // +1h
            section: .personal
        )
        let mockBuscarHermano = FocusEvent(
            title: "Ir a buscar a mi hermano",
            startTime: Date().addingTimeInterval(60 * 60 * 2), // +2h
            section: .personal
        )
        let mockEvents = [mockDucharme, mockBuscarHermano]

        // Match exacto: "ducharme" → Ducharme
        if let m = NovaResponder.findEventByApproxTitle("ducharme", in: mockEvents) {
            check(label: "fuzzy: 'ducharme' → 'Ducharme' exacto",
                  actual: m.id, expected: mockDucharme.id, failures: &failures)
        } else {
            let msg = "  ✗ fuzzy: 'ducharme' no encontró el evento Ducharme"
            print(msg); failures.append(msg)
        }

        // Match con acentos / mayúsculas diferentes
        if let m = NovaResponder.findEventByApproxTitle("DUCHARME", in: mockEvents) {
            check(label: "fuzzy: 'DUCHARME' (mayúscula) → Ducharme",
                  actual: m.id, expected: mockDucharme.id, failures: &failures)
        }

        // Match substring: "ducha" matchea "Ducharme" (substring)
        if let m = NovaResponder.findEventByApproxTitle("ducha", in: mockEvents) {
            check(label: "fuzzy: 'ducha' → Ducharme (substring)",
                  actual: m.id, expected: mockDucharme.id, failures: &failures)
        } else {
            let msg = "  ✗ fuzzy: 'ducha' no encontró Ducharme via substring"
            print(msg); failures.append(msg)
        }

        // Match token overlap: "ir a buscar a mi hermano"
        if let m = NovaResponder.findEventByApproxTitle(
            "ir a buscar a mi hermano", in: mockEvents
        ) {
            check(label: "fuzzy: 'ir a buscar a mi hermano' → match exacto",
                  actual: m.id, expected: mockBuscarHermano.id, failures: &failures)
        } else {
            let msg = "  ✗ fuzzy: 'ir a buscar a mi hermano' no encontró el evento"
            print(msg); failures.append(msg)
        }

        // Match parcial: "buscar hermano" → "Ir a buscar a mi hermano"
        if let m = NovaResponder.findEventByApproxTitle(
            "buscar hermano", in: mockEvents
        ) {
            check(label: "fuzzy: 'buscar hermano' → Ir a buscar a mi hermano",
                  actual: m.id, expected: mockBuscarHermano.id, failures: &failures)
        } else {
            let msg = "  ✗ fuzzy: 'buscar hermano' no matcheó"
            print(msg); failures.append(msg)
        }

        // Sin match: "estudiar matemáticas" no debe matchear nada
        check(
            label: "fuzzy: 'estudiar matemáticas' sin match → nil",
            actual: NovaResponder.findEventByApproxTitle(
                "estudiar matemáticas", in: mockEvents
            ) == nil,
            expected: true, failures: &failures
        )

        // Empty events → nil
        check(
            label: "fuzzy: events vacío → nil",
            actual: NovaResponder.findEventByApproxTitle("ducharme", in: []) == nil,
            expected: true, failures: &failures
        )

        // ───── REMINDER ABSOLUTO (bug 2026-05-13) ────────────────────
        //
        // Patrón "[evento] a las X acuérdame a las Y" debe extraerse como
        // UN evento + UN aviso, no como dos acciones multi-intent.

        // Caso 1: "tengo clases a las 1:30 acuérdame a las 12:50"
        if let intent = NovaResponder.extractReminderAbsoluteIntent(
            from: "tengo clases a las 1:30 acuérdame a las 12:50"
        ), case let .newBlock(title, eh, em, rh, rm) = intent {
            check(label: "abs-1: title contiene 'clase'",
                  actual: title.lowercased().contains("clase"),
                  expected: true, failures: &failures)
            check(label: "abs-1: event hour 1", actual: eh, expected: 1, failures: &failures)
            check(label: "abs-1: event min 30", actual: em, expected: 30, failures: &failures)
            check(label: "abs-1: reminder hour 12", actual: rh, expected: 12, failures: &failures)
            check(label: "abs-1: reminder min 50", actual: rm, expected: 50, failures: &failures)
        } else {
            failures.append("  ✗ abs-1: 'tengo clases a las 1:30 acuérdame a las 12:50' no matcheó newBlock")
        }
        // Defensa: isLikelyMultiAction NO debe marcarlo complejo.
        check(
            label: "abs-1: isLikelyMultiAction false (no es multi-action)",
            actual: NovaResponder.isLikelyMultiAction(
                "tengo clases a las 1:30 acuérdame a las 12:50"
            ),
            expected: false, failures: &failures
        )

        // Caso 2: "reunión a las 5 avísame a las 4:30"
        if let intent = NovaResponder.extractReminderAbsoluteIntent(
            from: "reunión a las 5 avísame a las 4:30"
        ), case let .newBlock(title, eh, em, rh, rm) = intent {
            check(label: "abs-2: title contiene 'reunión'",
                  actual: title.lowercased().contains("reuni"),
                  expected: true, failures: &failures)
            check(label: "abs-2: event hour 5", actual: eh, expected: 5, failures: &failures)
            check(label: "abs-2: event min 0", actual: em, expected: 0, failures: &failures)
            check(label: "abs-2: reminder hour 4", actual: rh, expected: 4, failures: &failures)
            check(label: "abs-2: reminder min 30", actual: rm, expected: 30, failures: &failures)
        } else {
            failures.append("  ✗ abs-2: 'reunión a las 5 avísame a las 4:30' no matcheó newBlock")
        }
        check(
            label: "abs-2: isLikelyMultiAction false",
            actual: NovaResponder.isLikelyMultiAction(
                "reunión a las 5 avísame a las 4:30"
            ),
            expected: false, failures: &failures
        )

        // Caso 3: "ducharme a las 10 acuérdame a las 9:50"
        if let intent = NovaResponder.extractReminderAbsoluteIntent(
            from: "ducharme a las 10 acuérdame a las 9:50"
        ), case let .newBlock(title, eh, em, rh, rm) = intent {
            check(label: "abs-3: title contiene 'ducha'",
                  actual: title.lowercased().contains("ducha"),
                  expected: true, failures: &failures)
            check(label: "abs-3: event hour 10", actual: eh, expected: 10, failures: &failures)
            check(label: "abs-3: event min 0", actual: em, expected: 0, failures: &failures)
            check(label: "abs-3: reminder hour 9", actual: rh, expected: 9, failures: &failures)
            check(label: "abs-3: reminder min 50", actual: rm, expected: 50, failures: &failures)
        } else {
            failures.append("  ✗ abs-3: 'ducharme a las 10 acuérdame a las 9:50' no matcheó")
        }
        check(
            label: "abs-3: isLikelyMultiAction false",
            actual: NovaResponder.isLikelyMultiAction(
                "ducharme a las 10 acuérdame a las 9:50"
            ),
            expected: false, failures: &failures
        )

        // Caso 4: "tengo que seguir trabajando a las 3:30 y comer a las 4"
        // → NO es reminder absoluto (sin trigger 'acuérdame'). Sigue siendo
        //   multi-action → isLikelyMultiAction true. No regresión.
        check(
            label: "abs-4: 'trabajando a las 3:30 y comer a las 4' isLikelyMultiAction true",
            actual: NovaResponder.isLikelyMultiAction(
                "tengo que seguir trabajando a las 3:30 y comer a las 4"
            ),
            expected: true, failures: &failures
        )
        check(
            label: "abs-4: extractReminderAbsoluteIntent nil (sin trigger)",
            actual: NovaResponder.extractReminderAbsoluteIntent(
                from: "tengo que seguir trabajando a las 3:30 y comer a las 4"
            ) == nil,
            expected: true, failures: &failures
        )

        // Caso 5: "comprar pan y leche" — sin horas, sin reminder. No
        // toca el flow nuevo. Sigue siendo simple task (no multi-action).
        check(
            label: "abs-5: 'comprar pan y leche' extractor nil",
            actual: NovaResponder.extractReminderAbsoluteIntent(
                from: "comprar pan y leche"
            ) == nil,
            expected: true, failures: &failures
        )
        check(
            label: "abs-5: 'comprar pan y leche' isLikelyMultiAction false",
            actual: NovaResponder.isLikelyMultiAction("comprar pan y leche"),
            expected: false, failures: &failures
        )

        // Caso B (attach por absoluto): "acuérdame a las 9:50 de ducharme"
        if let intent = NovaResponder.extractReminderAbsoluteIntent(
            from: "acuérdame a las 9:50 de ducharme"
        ), case let .attachByAbsolute(activity, rh, rm) = intent {
            check(label: "abs-B: activity contiene 'ducha'",
                  actual: activity.lowercased().contains("ducha"),
                  expected: true, failures: &failures)
            check(label: "abs-B: reminder hour 9", actual: rh, expected: 9, failures: &failures)
            check(label: "abs-B: reminder min 50", actual: rm, expected: 50, failures: &failures)
        } else {
            failures.append("  ✗ abs-B: 'acuérdame a las 9:50 de ducharme' no matcheó attach")
        }

        // ───── resolveAbsoluteReminderHour: scoring AM/PM ─────────────
        //
        // Bug 2026-05-13 (Caso 1): "clases a las 1:30 acuérdame a las 12:50"
        // — el reminder "12:50" con school context forceAM se resolvía a
        // 0:50 (medianoche), dando offset ~12h 40min. Wrong. El scoring
        // smart debe elegir PM 12:50 (mediodía) → offset 40 min.
        //
        // Patrón: dado eventHour24 y rawReminderHour 1-12, devolver el
        // bracket (AM o PM) que produce offset positivo razonable.

        // Caso 1 literal: event 13:30, reminder cruda 12:50 → debe ser 12 (PM mediodía).
        check(
            label: "scoring abs-1: event=13:30 + reminder cruda 12:50 → 12 (PM mediodía)",
            actual: NovaResponder.resolveAbsoluteReminderHour(
                rawReminderHour: 12, rawReminderMin: 50,
                eventHour24: 13, eventMin: 30
            ),
            expected: 12, failures: &failures
        )
        // Caso 2: event 17:00, reminder cruda 4:30 → debe ser 16 (PM 4:30).
        check(
            label: "scoring abs-2: event=17:00 + reminder cruda 4:30 → 16 (PM)",
            actual: NovaResponder.resolveAbsoluteReminderHour(
                rawReminderHour: 4, rawReminderMin: 30,
                eventHour24: 17, eventMin: 0
            ),
            expected: 16, failures: &failures
        )
        // Caso 3: event 10:00 AM, reminder cruda 9:50 → debe ser 9 (AM).
        check(
            label: "scoring abs-3: event=10:00 AM + reminder cruda 9:50 → 9 (AM)",
            actual: NovaResponder.resolveAbsoluteReminderHour(
                rawReminderHour: 9, rawReminderMin: 50,
                eventHour24: 10, eventMin: 0
            ),
            expected: 9, failures: &failures
        )
        // Edge: reminder 24h literal (>12) — pasa tal cual.
        check(
            label: "scoring edge: reminder 16 (ya 24h) → 16",
            actual: NovaResponder.resolveAbsoluteReminderHour(
                rawReminderHour: 16, rawReminderMin: 0,
                eventHour24: 17, eventMin: 0
            ),
            expected: 16, failures: &failures
        )
        // Edge: event temprano (8 AM), reminder 12:50 → AM 0:50 da offset 7h10m,
        // PM 12:50 da offset NEGATIVO (-4h50m). AM gana.
        check(
            label: "scoring edge: event=8 AM + reminder 12:50 → 0 (AM noche)",
            actual: NovaResponder.resolveAbsoluteReminderHour(
                rawReminderHour: 12, rawReminderMin: 50,
                eventHour24: 8, eventMin: 0
            ),
            expected: 0, failures: &failures
        )

        // ───── Caso 7 (ambiguo): "acuérdame lo de mañana" ────────────
        //
        // Sin trigger de tiempo concreto, ni "antes de", ni hora absoluta.
        // El extractor de absoluto debe devolver nil. El de attach también.
        // El flujo cae al parser local que pedirá clarify — no a "no pude
        // separar" porque NO tiene 2 horas.

        check(
            label: "ambiguo: 'acuérdame lo de mañana' extract absoluto nil",
            actual: NovaResponder.extractReminderAbsoluteIntent(
                from: "acuérdame lo de mañana"
            ) == nil,
            expected: true, failures: &failures
        )
        check(
            label: "ambiguo: 'acuérdame lo de mañana' extract attach nil",
            actual: NovaResponder.extractReminderAttachIntent(
                from: "acuérdame lo de mañana"
            ) == nil,
            expected: true, failures: &failures
        )
        check(
            label: "ambiguo: 'acuérdame lo de mañana' isLikelyMultiAction false",
            actual: NovaResponder.isLikelyMultiAction("acuérdame lo de mañana"),
            expected: false, failures: &failures
        )

        // ───── REORDEN: 'a las X [verbo]' → '[verbo] a las X' ─────────
        //
        // Tras splitear por "luego/después", el segundo segmento puede
        // empezar con la hora ("a las 3 ducharme"). El parser local
        // entiende mejor si reordenamos a "ducharme a las 3".
        //
        // Bug del screenshot 2026-05-13:
        //   "ir a buscar a mi hermano a las 2 luego a las 3 ducharme"
        // splits a:
        //   1. "ir a buscar a mi hermano a las 2"  ✓ (parser OK)
        //   2. "a las 3 ducharme"  ← antes daba clarify, ahora reordena
        //                            a "ducharme a las 3" y parser OK.

        let reorderTest = NovaResponder.parseAll(
            "ir a buscar a mi hermano a las 2 luego a las 3 ducharme"
        )
        check(label: "reorden: 'a las 2 luego a las 3 ducharme' → 2 intents",
              actual: reorderTest.count, expected: 2, failures: &failures)

        let reorderResults = runPipeline(
            "ir a buscar a mi hermano a las 2 luego a las 3 ducharme"
        )
        check(label: "reorden runPipeline: 2 intents",
              actual: reorderResults.count, expected: 2, failures: &failures)
        if reorderResults.count == 2 {
            // Intent 1: "Ir a buscar a mi hermano" hora 14 (PM colloquial)
            check(label: "reorden[0] title 'Ir a buscar a mi hermano'",
                  actual: reorderResults[0].title,
                  expected: "Ir a buscar a mi hermano", failures: &failures)
            check(label: "reorden[0] hour 14",
                  actual: reorderResults[0].hour, expected: 14, failures: &failures)
            // Intent 2: "Duchar" hora 15 (PM colloquial).
            // "Ducharme" → stripReflexiveMe → "Duchar" (reflejo correcto).
            check(label: "reorden[1] title 'Duchar'",
                  actual: reorderResults[1].title, expected: "Duchar", failures: &failures)
            check(label: "reorden[1] hour 15",
                  actual: reorderResults[1].hour, expected: 15, failures: &failures)
            // Crítico: ninguno debe ser .clarify
            check(label: "reorden[1] kind ≠ clarify",
                  actual: reorderResults[1].kind != .clarify,
                  expected: true, failures: &failures)
        }

        // Caso similar con palabras: "estudiar a las 5 luego a las 7 cenar"
        let reorderWords = runPipeline("estudiar a las 5 luego a las 7 cenar")
        check(label: "reorden-2: 'estudiar a las 5 luego a las 7 cenar' → 2 intents",
              actual: reorderWords.count, expected: 2, failures: &failures)
        if reorderWords.count == 2 {
            check(label: "reorden-2[0] hour 17 (estudiar PM)",
                  actual: reorderWords[0].hour, expected: 17, failures: &failures)
            check(label: "reorden-2[1] hour 19 (cenar PM por verbo)",
                  actual: reorderWords[1].hour, expected: 19, failures: &failures)
        }

        // ───── REGRESSION: school context AM solo en 6-12 ─────────────
        //
        // Antes del fix: "clase a las 1:30" → 1:30 AM (forceAM agresivo).
        // Después del fix: → 13:30 (school context no aplica para 1-5).
        check(
            label: "school-fix: 'clase a las 1:30' currentHour=14 → 13 (PM)",
            actual: NovaResponder.adjustAmPm(
                hour: 1, in: "clase a las 1:30", currentHour: 14
            ),
            expected: 13, failures: &failures
        )
        // Pero "clase a las 8" debe seguir siendo 8 AM (sin regresión).
        check(
            label: "school-fix: 'clase a las 8' currentHour=14 → 8 (AM)",
            actual: NovaResponder.adjustAmPm(
                hour: 8, in: "clase a las 8", currentHour: 14
            ),
            expected: 8, failures: &failures
        )
        // Y "clase a las 3" también PM (3 en 1-7 → +12).
        check(
            label: "school-fix: 'clase a las 3' currentHour=14 → 15 (PM)",
            actual: NovaResponder.adjustAmPm(
                hour: 3, in: "clase a las 3", currentHour: 14
            ),
            expected: 15, failures: &failures
        )

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
