// Defensa server-side contra Nova editando/borrando eventos sin que el
// usuario lo haya pedido explícitamente. El system prompt ya tiene la
// regla en texto, pero los modelos a veces alucinan: ven un evento
// parecido viejo, deciden mover el actual, y rompen la agenda.
//
// Este módulo es la última línea: si la intención del usuario NO incluye
// un verbo de edición, cualquier action de tipo edit_event / update_event /
// delete_event que llegue, queda strippeada (logged + removida).
//
// Lista de verbos basada en la regla acordada con el usuario:
//   mueve, cambia, edita, modifica, reagenda, pásalo, corre, adelanta,
//   atrasa, borra, elimina, cancela, quita.
// También cuentan formas conjugadas comunes ("muevelo", "cambiame", etc).

const EDIT_VERB_PATTERNS = [
  // [uú]/[aá] en la raíz: las formas imperativas con clítico llevan tilde
  // ("muévelo", "cámbialo") y antes NO matcheaban (bug pre-QA-closure).
  /\bmu[eé]v[a-záéíóú]*\b/i,
  /\bmov[eé]r[a-záéíóú]*\b/i,
  /\bc[aá]mbi[a-záéíóú]*\b/i,
  /\bedit[a-záéíóú]*\b/i,
  /\bmodific[a-záéíóú]*\b/i,
  /\breagend[a-záéíóú]*\b/i,
  /\bp[aá]sal[a-záéíóú]*\b/i,
  /\bcorr[ea-záéíóú]*\s+(?:lo|la|el|al|para|a las|a la|de|de\s+las|hasta|desde|m[aá]s)/i, // "corre las 3 a las 4", "corre el evento", evita "corre" verbo
  /\badelant[a-záéíóú]*\b/i,
  /\batras[a-záéíóú]*\b/i,
  /\bborr[a-záéíóú]*\b/i,
  /\belimin[a-záéíóú]*\b/i,
  /\bcancel[a-záéíóú]*\b/i,
  /\bquit[a-záéíóú]*\b/i,
  /\breagrup[a-záéíóú]*\b/i,
  /\bdesplaz[a-záéíóú]*\b/i,
  /\bdesagend[a-záéíóú]*\b/i,
  // Correcciones conversacionales post-creación (QA-closure 2026-06-10).
  // El usuario corrige lo que Nova acaba de crear sin usar un verbo de
  // edición clásico: "mejor no", "no lo pongas", "mejor mañana", "ponlo
  // una hora antes", "déjalo para el viernes", "que sea recordatorio",
  // "olvida lo anterior / olvida eso". Sin estos patrones, el filtro
  // strippeaba la edición legítima y Nova respondía con la nota técnica
  // "No moví ni edité…".
  /\bmejor no\b/i,
  /\bno l[oa] (pongas|agendes|crees|guardes|anotes)\b/i,
  /\bmejor\s+(mañana|manana|hoy|m[aá]s tarde|m[aá]s temprano|otro d[ií]a|a las?\b|el\s)/i,
  /\b(p[oó]nl[oa]|d[eé]jal[oa]|c[oó]rrel[oa])\b/i,
  // Ediciones con clítico "le" sobre un evento existente (fix 2026-06-11):
  // "ponle subtítulo X al gym", "agrégale pierna", "añádele llevar la
  // pelota", "quítale el subtítulo". Sin esto, el filtro strippeaba el
  // edit_event legítimo (solo cubría "ponlo/ponla"). Las formas base
  // "agrega"/"añade" NO van aquí — son intención de CREAR, no de editar.
  // ("cámbiale" ya lo cubre /c[aá]mbi[a-záéíóú]*/ de arriba.)
  /\bp[oó]nle\b/i,
  /\bagr[eé]gale\b/i,
  /\bañ[aá]dele\b/i,
  /\bqu[ií]tale\b/i,
  // "subtítulo" SOLO en contexto de corrección de un evento existente
  // ("el subtítulo va en el otro", "el subtítulo del gym está mal",
  // "corrige el subtítulo"), NO en una creación tipo "crea gym con
  // subtítulo pierna" (esa frase emite add_event, no edit, y abrir el
  // gate de edición ahí dejaba pasar deletes alucinados — review 2026-06-11).
  /\bsubt[ií]tulo\b[^.!?]{0,40}\b(va\b|en el otro|est[aá]\s+mal|incorrect|equivocad|no corresponde|sobra)/i,
  /\b(pon|p[oó]n|cambi|c[aá]mbi|qu[ií]t|arregl|corrig|edit|saca|borr)[a-záéíóú]*\s+(el\s+|le\s+el\s+)?subt[ií]tulo/i,
  /\bque sea\s+(recordatorio|evento|tarea)\b/i,
  /\bolvida\s+(eso|lo anterior|lo [uú]ltimo)\b/i,
  /\buna hora (antes|despu[eé]s)\b/i,
  // Correcciones declarativas sin verbo de edición (QA-closure 2026-06-10,
  // pasada Anthropic): "me equivoqué, era a las 6", "no, era mañana",
  // "eso era un evento", "era pierna no espalda". El modelo emite el
  // edit_event correcto pero el filtro lo mataba por falta de verbo.
  /\bme equivoqu[eé]\b/i,
  /\beso (era|es)\b/i,
  /\bno,?\s+era\b/i,
  /\bera\s+(a las?\s|mañana|manana|hoy|el\s|para\s)/i,
  /\bera\s+\S+\s+no\s+\S+/i, // "era pierna no espalda"
];

// Verbos/locuciones que expresan intención de BORRAR (no solo editar). Un
// delete_event es destructivo, así que exige una de estas — los verbos
// "suaves" de edición (ponle, agrégale, subtítulo, cambia la hora…) NO
// deben habilitar un delete alucinado (review 2026-06-11). "quítale" (clítico
// "le") es edición de un campo, no borrado del evento; "quita/quítalo/quítame"
// (objeto directo) sí es borrado.
const DELETE_VERB_PATTERNS = [
  /\bborr[a-záéíóú]*\b/i,
  /\belimin[a-záéíóú]*\b/i,
  /\bcancel[a-záéíóú]*\b/i,
  /\bdesagend[a-záéíóú]*\b/i,
  /\bqu[ií]ta(l[oa]|me|los|las)?\b/i, // quita / quítalo / quítala / quítame — NO "quítale"
  /\bmejor no\b/i,
  /\bno l[oa] (pongas|agendes|crees|guardes|anotes)\b/i,
  /\bolvida\s+(eso|lo anterior|lo [uú]ltimo)\b/i,
];

/**
 * Devuelve true si el mensaje del usuario contiene un verbo de edición
 * explícito. Caja blanca para depuración.
 */
export function hasExplicitEditIntent(userMessage) {
  if (typeof userMessage !== 'string' || !userMessage.trim()) return false;
  const m = userMessage.trim();
  for (const re of EDIT_VERB_PATTERNS) {
    if (re.test(m)) return true;
  }
  return false;
}

/**
 * Devuelve true si el mensaje expresa intención explícita de BORRAR. Más
 * estricto que la edición: solo verbos/locuciones de eliminación.
 */
export function hasExplicitDeleteIntent(userMessage) {
  if (typeof userMessage !== 'string' || !userMessage.trim()) return false;
  const m = userMessage.trim();
  for (const re of DELETE_VERB_PATTERNS) {
    if (re.test(m)) return true;
  }
  return false;
}

/**
 * Filtra acciones edit/update/delete cuando el usuario no expresó intención
 * de edición. Devuelve { actions, stripped } — actions es la lista limpia,
 * stripped son las acciones que se quitaron (para loggear o agregar nota
 * al reply).
 */
export function filterCalendarEditActions(actions, userMessage) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { actions: actions ?? [], stripped: [] };
  }
  const canEdit = hasExplicitEditIntent(userMessage);
  // El borrado se habilita SOLO con intención de borrar explícita. Un verbo
  // de edición (incluido "quítale el subtítulo") NO basta para pasar un
  // delete_event — evita que un delete alucinado se cuele por la puerta que
  // abrió una edición legítima (review 2026-06-11).
  const canDelete = hasExplicitDeleteIntent(userMessage);
  if (canEdit && canDelete) {
    return { actions, stripped: [] };
  }
  const kept = [];
  const stripped = [];
  for (const a of actions) {
    const type = a && typeof a === 'object' ? a.type : null;
    if (type === 'delete_event') {
      if (canDelete) kept.push(a); else stripped.push(a);
    } else if (type === 'edit_event' || type === 'update_event') {
      if (canEdit) kept.push(a); else stripped.push(a);
    } else {
      kept.push(a);
    }
  }
  return { actions: kept, stripped };
}

/**
 * Mensaje humano para agregar al reply cuando se strippearon acciones de
 * edición. El cliente lo ve en chat para entender por qué no pasó nada.
 */
export function strippedEditMessage(stripped) {
  if (stripped.length === 0) return '';
  const types = new Set(stripped.map(a => a.type));
  if (types.has('delete_event')) {
    return 'No borré el evento porque no me pediste explícitamente borrarlo. Si quieres, dime "borra X" o "elimina X".';
  }
  return 'No moví ni edité el evento existente porque no me pediste hacerlo. Si quieres que lo cambie, dime "mueve X a las Y" o "cambia X".';
}
