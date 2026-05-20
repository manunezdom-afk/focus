// KairosNovaAdapter — STUB intencional.
//
// El usuario fue explícito: "No tocar Kairos ni Spark todavía. Puedes
// dejar stubs/adapters, pero no migrarlos ni romper nada existente."
//
// Cuando Kairos se integre con Nova Core, este archivo debe exportar:
//   - NOVA_KAIROS_SCHEMA: schema OpenAI con acciones tipo summarize_note,
//     organize_notes, export_document, generate_outline, classify_content,
//     create_study_plan.
//   - buildKairosSystemPrompt({ ... }): prompt en español neutro adaptado
//     a contexto Kairos (apuntes, documentos, organización).
//   - expandToSemanticActions(raw): expansión equivalente al adapter focus.
//   - collapseToKairosShape(semantic, ctx): colapso al shape que el cliente
//     Kairos consuma (aún por definir).
//
// Hoy NO se llama desde ningún flow productivo. Si alguien lo invoca por
// error, devolvemos 501 explícito para no fallar silenciosamente.

export function notImplemented() {
  const err = new Error('KairosNovaAdapter no está implementado todavía')
  err.status = 501
  err.code = 'kairos_adapter_not_implemented'
  throw err
}

export function buildKairosSystemPrompt() {
  notImplemented()
}

export function convertOpenAIToKairosResponse() {
  notImplemented()
}
