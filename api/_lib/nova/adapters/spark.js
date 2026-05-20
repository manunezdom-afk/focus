// SparkNovaAdapter — STUB intencional.
//
// El usuario fue explícito: "No tocar Kairos ni Spark todavía. Puedes
// dejar stubs/adapters, pero no migrarlos ni romper nada existente."
//
// Cuando Spark se integre con Nova Core, este archivo debe exportar:
//   - NOVA_SPARK_SCHEMA: schema con acciones generate_flashcards,
//     create_quiz, explain_topic, plan_study_session, review_progress.
//   - buildSparkSystemPrompt({ ... }): prompt en español neutro
//     adaptado a contexto Spark (estudio, métodos, tarjetas).
//   - expandToSemanticActions(raw): expansión equivalente al adapter focus.
//   - collapseToSparkShape(semantic, ctx): colapso al shape Spark.
//
// Hoy NO se llama desde ningún flow productivo. Si alguien lo invoca por
// error, devolvemos 501 explícito para no fallar silenciosamente.

export function notImplemented() {
  const err = new Error('SparkNovaAdapter no está implementado todavía')
  err.status = 501
  err.code = 'spark_adapter_not_implemented'
  throw err
}

export function buildSparkSystemPrompt() {
  notImplemented()
}

export function convertOpenAIToSparkResponse() {
  notImplemented()
}
