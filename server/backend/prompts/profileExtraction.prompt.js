const SECTION_SCHEMA = `{
  "candidateFields": {
    "nombre": string|null, "puestoActual": string|null, "resumen": string|null,
    "objetivoProfesional": string|null, "disponibilidad": string|null, "modalidadPreferida": string|null,
    "pretensionSalarial": string|null, "linkedinUrl": string|null, "githubUrl": string|null,
    "portfolioUrl": string|null, "sobreMi": string|null
  },
  "sections": {
    "experiencia_laboral": [{ "empresa": string, "puesto": string, "descripcion": string|null, "fecha_inicio": "YYYY-MM-DD"|null, "fecha_fin": "YYYY-MM-DD"|null, "actualmente": boolean }],
    "educacion": [{ "institucion": string, "titulo": string, "nivel": string|null, "fecha_inicio": "YYYY-MM-DD"|null, "fecha_fin": "YYYY-MM-DD"|null }],
    "cursos": [{ "nombre": string, "institucion": string|null, "descripcion": string|null, "fecha_inicio": "YYYY-MM-DD"|null, "fecha_fin": "YYYY-MM-DD"|null }],
    "proyectos": [{ "nombre": string, "descripcion": string|null, "tecnologias": string|null, "url": string|null, "fecha_inicio": "YYYY-MM-DD"|null, "fecha_fin": "YYYY-MM-DD"|null }],
    "habilidades": [{ "nombre": string, "categoria": string|null, "nivel": string|null }],
    "idiomas": [{ "idioma": string, "nivel": string|null }]
  }
}`;

export const EXTRACTION_FALLBACK = {
    candidateFields: {},
    sections: {
        experiencia_laboral: [],
        educacion: [],
        cursos: [],
        proyectos: [],
        habilidades: [],
        idiomas: [],
    },
};

function summarizeExistingProfile(existingProfile) {
    if (!existingProfile) return 'No hay datos previos cargados.';

    const usuario = existingProfile.usuario || {};
    const lines = [
        `nombre: ${usuario.nombre || '(vacío)'}`,
        `puesto actual: ${usuario.puesto_actual || '(vacío)'}`,
        `resumen: ${usuario.resumen || '(vacío)'}`,
    ];

    for (const key of ['experiencia_laboral', 'educacion', 'cursos', 'proyectos', 'habilidades', 'idiomas']) {
        const rows = existingProfile[key] || [];
        if (rows.length === 0) continue;
        const preview = rows.map((row) => Object.values(row).filter(Boolean).slice(0, 3).join(' / ')).join(' | ');
        lines.push(`${key} ya cargados (${rows.length}): ${preview}`);
    }

    return lines.join('\n');
}

/**
 * Prompt único reusado por la carga de CV ('cv') y el chat de autocompletado ('chat').
 * Ambos modos piden el mismo schema de salida — lo único que cambia es qué tan
 * "generoso" puede ser el modelo al inferir datos del texto fuente.
 */
export function buildProfileExtractionPrompt({ sourceText, mode, existingProfile = null, conversationContext = null }) {
    const modeInstruction = mode === 'cv'
        ? 'El texto es un CV completo. Extraé TODA la información estructurada que puedas encontrar.'
        : 'El texto es UN SOLO mensaje de un chat. Extraé SOLO lo que la persona dijo explícitamente en ese mensaje. NO inventes ni infieras datos que no estén ahí. Si el mensaje no menciona nada extraíble (ej. un saludo o una pregunta), devolvé arrays y campos vacíos.';

    const contextBlock = conversationContext
        ? `\nContexto reciente de la conversación (solo para entender referencias, no para extraer datos de acá):\n${conversationContext}\n`
        : '';

    return `Sos un asistente que extrae datos de perfil profesional/CV en formato JSON estructurado.

${modeInstruction}

Perfil ya guardado en la base de datos (no vuelvas a proponer esto, ya está guardado):
${summarizeExistingProfile(existingProfile)}
${contextBlock}
Texto fuente:
"""
${sourceText}
"""

Devolvé ÚNICAMENTE un JSON con este schema exacto (sin markdown, sin texto adicional):
${SECTION_SCHEMA}

Reglas:
- Fechas siempre en formato YYYY-MM-DD, o null si no se puede determinar el día exacto (usa el primer día del mes/año si solo tenés mes/año).
- Si un campo no se menciona, usá null (candidateFields) o simplemente no incluyas el ítem (sections).
- No repitas datos que ya figuran en el perfil guardado arriba.
- "actualmente" es true solo si el texto indica que el trabajo/estudio sigue en curso.`;
}
