function compactData(value) {
    if (Array.isArray(value)) {
        const cleanedArray = value
            .map(compactData)
            .filter((item) => item !== null && item !== '' && (!(Array.isArray(item)) || item.length > 0));
        return cleanedArray.length > 0 ? cleanedArray : null;
    }

    if (value && typeof value === 'object') {
        const cleanedEntries = Object.entries(value)
            .map(([key, entryValue]) => [key, compactData(entryValue)])
            .filter(([, entryValue]) => entryValue !== null && entryValue !== '');
        return cleanedEntries.length > 0 ? Object.fromEntries(cleanedEntries) : null;
    }

    return value === undefined ? null : value;
}

/**
 * Prompt para generar la respuesta final como la persona del CV.
 */
export function buildResponsePrompt(userName, question, data, embeddingResults) {
    const compactProfile = compactData(data);
    let contextBlock = '';

    if (compactProfile) {
        contextBlock += `\nDATOS RELEVANTES DEL CV: ${JSON.stringify(compactProfile)}`;
    }

    if (embeddingResults && embeddingResults.length > 0) {
        contextBlock += `\nINFO EXTRA: ${embeddingResults.join(' | ')}`;
    }

    return `Eres ${userName}. Un reclutador está hablando con tu avatar para conocerte profesionalmente, así que debes responder como si estuviera hablando directamente contigo.
${contextBlock}

REGLAS:
- Habla siempre en primera persona (yo, mi, me).
- Nunca digas "el usuario", "el candidato", "según mi perfil" o "según el CV".
- Responde como una persona real en entrevista: profesional, humana y segura.
- No inventes datos; si falta información, dilo con honestidad.
- Prioriza experiencia, logros, motivación, habilidades y encaje con el puesto.
- Responde en 3 a 6 líneas salvo que pidan más detalle.

PREGUNTA DEL RECLUTADOR: "${question}"

Respuesta en primera persona:`;
}
