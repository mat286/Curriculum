import provider from '../ai/index.js';
import { buildProfileExtractionPrompt, EXTRACTION_FALLBACK } from '../prompts/profileExtraction.prompt.js';

const SECTION_KEYS = ['experiencia_laboral', 'educacion', 'cursos', 'proyectos', 'habilidades', 'idiomas'];
const CANDIDATE_FIELD_KEYS = [
    'nombre', 'puestoActual', 'resumen', 'objetivoProfesional', 'disponibilidad',
    'modalidadPreferida', 'pretensionSalarial', 'linkedinUrl', 'githubUrl', 'portfolioUrl', 'sobreMi',
];

function normalizeExtractionResult(raw) {
    const result = { candidateFields: {}, sections: {} };
    const rawCandidateFields = raw?.candidateFields;
    const rawSections = raw?.sections;

    for (const key of CANDIDATE_FIELD_KEYS) {
        const value = rawCandidateFields?.[key];
        if (typeof value === 'string' && value.trim()) {
            result.candidateFields[key] = value.trim();
        }
    }

    for (const key of SECTION_KEYS) {
        const rows = rawSections?.[key];
        result.sections[key] = Array.isArray(rows)
            ? rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row))
            : [];
    }

    return result;
}

/**
 * Punto único de extracción de datos de perfil a partir de texto libre —
 * usado tanto por la carga de CV (mode: 'cv') como por el chat de
 * autocompletado (mode: 'chat'). Nunca escribe en la base de datos: solo
 * devuelve una propuesta para que el usuario confirme.
 */
export async function extractProfileUpdates({ sourceText, mode, existingProfile = null, conversationContext = null }) {
    if (!sourceText || typeof sourceText !== 'string' || !sourceText.trim()) {
        return EXTRACTION_FALLBACK;
    }

    const prompt = buildProfileExtractionPrompt({ sourceText, mode, existingProfile, conversationContext });
    const raw = await provider.generateJSON(prompt, EXTRACTION_FALLBACK, {
        temperature: 0,
        numPredict: mode === 'cv' ? 1500 : 400,
        timeout: mode === 'cv' ? 20000 : 12000,
    });

    return normalizeExtractionResult(raw);
}
