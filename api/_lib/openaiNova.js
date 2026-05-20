// Shim de compatibilidad — re-exports desde el nuevo Nova Core
// (`api/_lib/nova/*`). Mantiene los símbolos públicos que los 30 tests
// existentes y el resto del backend importan. No agregues lógica nueva
// acá: ve a `nova/adapters/focus.js` o `nova/openaiClient.js`.

export {
  NOVA_OPENAI_SCHEMA,
  buildOpenAISystemPrompt,
  convertOpenAIToBackendResponse,
  expandToSemanticActions,
  collapseSemanticToBackendActions,
} from './nova/adapters/focus.js'

export {
  callOpenAI as callOpenAINova,
  extractResponsesText,
} from './nova/openaiClient.js'
