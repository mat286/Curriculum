/**
 * Prompt para la fase de recolección del perfil buscado.
 * El LLM actúa como asistente de recruiting y hace preguntas
 * para construir un job profile estructurado.
 *
 * Devuelve JSON:
 *   { complete: false, question: "..." }
 *   { complete: true, jobProfile: { role, seniority, must_have, nice_to_have, keywords } }
 */
export function buildRecruiterCollectPrompt(message, conversationHistory, currentProfile) {
    const historyText = conversationHistory.length > 0
        ? conversationHistory.map(m => `${m.role === 'user' ? 'Recruiter' : 'Asistente'}: ${m.content}`).join('\n')
        : 'Sin historial previo.';

    const profileText = currentProfile && Object.keys(currentProfile).length > 0
        ? JSON.stringify(currentProfile, null, 2)
        : 'Aún no hay perfil construido.';

    return `Eres un asistente de recruiting práctico, humano y resolutivo. Tu tarea es ayudar a un recruiter a definir rápido el perfil buscado, incluso si usa lenguaje informal o no técnico.

Historial de conversación:
${historyText}

Perfil construido hasta ahora:
${profileText}

Nuevo mensaje del recruiter: "${message}"

REGLAS ESTRICTAS:
- Responde SOLO con JSON válido, sin texto adicional, sin markdown, sin explicaciones.
- Interpreta expresiones coloquiales como: "buen pibe", "con ganas", "para mañana", "sin experiencia", "que aprenda rápido", "para mi comercio".
- NO repitas la misma pregunta si el recruiter ya respondió.
- NO uses jerga técnica innecesaria. Evita preguntar "seniority" al usuario. Si necesitas aclarar experiencia, usa lenguaje simple como: "¿Te sirve alguien que recién empieza o prefieres a alguien con experiencia?"
- Si ya se entiende el rol y una o dos condiciones importantes, completa tú el perfil con inferencias razonables.
- Para roles simples u operativos (ventas, comercio, atención al cliente, caja, reposición, administración básica), con rol + actitud/disponibilidad + una habilidad básica ya puede ser suficiente para "complete: true".
- Si todavía falta algo crítico, devuelve:
  {"complete": false, "question": "Tu pregunta breve y natural para el recruiter", "jobProfile": {perfil_parcial}}
- Si ya tienes suficiente contexto, devuelve:
  {"complete": true, "jobProfile": {"role": "...", "seniority": "junior|semi-senior|senior|no especificado", "must_have": ["skill1"], "nice_to_have": ["skill2"], "keywords": ["kw1", "kw2"]}}
- Usa "junior" si el recruiter dice cosas como "sin experiencia", "poca experiencia", "que tenga ganas", "que aprenda rápido".
- Si no se entiende el rol exacto pero sí el contexto (ej. comercio/ventas), puedes inferirlo como "ventas / atención comercial".

Ejemplos válidos:
{"complete": true, "jobProfile": {"role": "ventas / atención comercial", "seniority": "junior", "must_have": ["ventas", "buena actitud", "disponibilidad inmediata"], "nice_to_have": ["ganas de aprender"], "keywords": ["comercio", "ventas", "atención al cliente"]}}
{"complete": false, "question": "¿Lo más importante es vender, atender clientes o cobrar en caja?", "jobProfile": {"role": "ventas / atención comercial", "seniority": "junior"}}
{"complete": true, "jobProfile": {"role": "backend developer", "seniority": "semi-senior", "must_have": ["nodejs", "api rest", "sql"], "nice_to_have": ["docker", "aws"], "keywords": ["backend", "apis", "escalabilidad"]}}

JSON:`;
}

/**
 * Prompt para que el LLM rankee candidatos según el job profile.
 *
 * Devuelve JSON: array de [{ id, score, reason }]
 */
export function buildRecruiterRankPrompt(jobProfile, candidates) {
    const profileText = JSON.stringify(jobProfile, null, 2);

    const candidatesText = candidates.map(c => {
        const fullName = c.nombreCompleto || c.nombre || [c.nombre, c.apellido].filter(Boolean).join(' ');
        const currentRole = c.puestoActual || c.puesto_actual || 'N/A';
        const summary = c.resumen || 'sin resumen';
        const skills = c.habilidades?.map(h => h.nombre || h).join(', ') || 'no especificadas';
        const exp = c.experiencia_laboral?.map(e => `${e.puesto} en ${e.empresa}`).join('; ') || 'sin registros';
        return `ID: ${c.id} | Nombre: ${fullName} | Puesto actual: ${currentRole} | Resumen: ${summary} | Habilidades: ${skills} | Experiencia: ${exp}`;
    }).join('\n');

    return `Eres un evaluador de candidatos. Tenés un perfil de puesto buscado y una lista de candidatos. Evaluá qué tan bien encaja cada candidato.

PERFIL BUSCADO:
${profileText}

CANDIDATOS:
${candidatesText}

INSTRUCCIONES:
- Evaluá cada candidato del 0.0 al 1.0 según qué tan bien encaja con el perfil buscado.
- Devuelve SOLO JSON válido, sin texto adicional, sin markdown.
- Formato exacto:
[{"id": 1, "score": 0.85, "reason": "Explicación breve en español (máx 20 palabras)"}]
- Incluí TODOS los candidatos en el array.
- Ordená por score descendente.
- Si un candidato no tiene datos suficientes, asignale score 0.1.

JSON:`;
}
