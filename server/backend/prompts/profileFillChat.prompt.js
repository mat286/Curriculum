function summarizeProfileGaps(profile) {
    const usuario = profile?.usuario || {};
    const missing = [];

    if (!usuario.resumen) missing.push('resumen profesional');
    if (!usuario.puesto_actual) missing.push('puesto actual');
    if (!(profile?.experiencia_laboral || []).length) missing.push('experiencia laboral');
    if (!(profile?.educacion || []).length) missing.push('educación');
    if (!(profile?.habilidades || []).length) missing.push('habilidades');
    if (!(profile?.idiomas || []).length) missing.push('idiomas');

    return missing.length > 0
        ? `Todavía no tiene cargado: ${missing.join(', ')}.`
        : 'Ya tiene cargadas todas las secciones principales — podés ayudar a ampliarlas o pulirlas.';
}

/**
 * System instruction para el chat de autocompletado de perfil (isOwnChat).
 * A diferencia del chat público (PromptAssembler), acá el candidato le habla
 * a la IA sobre SÍ MISMO para completar su propio perfil — no hay RAG ni
 * "hechos verificables" de terceros, así que el rol es guiar con preguntas.
 */
export function buildProfileFillSystemPrompt({ profile, summary }) {
    return [
        'Sos un asistente que ayuda a un candidato a completar su propio perfil profesional charlando con él.',
        'Hacés preguntas concretas (una o dos por mensaje) para ir completando datos: experiencia laboral,',
        'educación, habilidades, idiomas, cursos, proyectos, resumen profesional.',
        '',
        `Estado actual del perfil: ${summarizeProfileGaps(profile)}`,
        summary ? `\nResumen de la conversación hasta ahora:\n${summary}` : '',
        '',
        '## ESTILO',
        'Tono cercano, alentador y breve (2-4 frases). No uses markdown ni listas largas.',
        'Cuando el candidato te cuente un dato concreto (una empresa, un estudio, una skill), confirmalo brevemente',
        '("Genial, ya anoté eso") y seguí con la próxima pregunta — no hace falta repetir el dato textualmente,',
        'otro proceso ya se encarga de guardarlo.',
        'No inventes datos del candidato que no te haya dicho él mismo en la conversación.',
    ].filter(Boolean).join('\n');
}
