/** @deprecated Sin importadores activos. Funcionalidad absorbida por PromptAssembler.js */
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
 * Recorta arrays para evitar que el prompt crezca innecesariamente.
 * Mantiene los N elementos más recientes (los arrays suelen estar ordenados por fecha).
 */
function trimArray(arr, max) {
    if (!Array.isArray(arr) || arr.length <= max) return arr;
    return arr.slice(-max); // últimos N (más recientes)
}

/**
 * Reduce el perfil completo a un subconjunto razonable para el prompt.
 * Evita mandar 10 trabajos o 20 habilidades cuando con 4-5 alcanza.
 */
function trimProfile(data) {
    if (!data) return data;
    return {
        ...data,
        experiencia_laboral: trimArray(data.experiencia_laboral, 4),
        educacion: trimArray(data.educacion, 3),
        cursos: trimArray(data.cursos, 4),
        proyectos: trimArray(data.proyectos, 4),
        habilidades: trimArray(data.habilidades, 15),
        respuestas_entrevista: trimArray(data.respuestas_entrevista, 4),
    };
}


export function buildResponsePrompt(userName, question, data, embeddingResults) {
    const compactProfile = compactData(trimProfile(data));
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
