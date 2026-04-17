import { generateJSON } from './ollamaService.js';
import { buildRouterPrompt } from '../prompts/router.prompt.js';
import { OLLAMA_ROUTER_MODEL, OLLAMA_TIMEOUT } from '../config/ollama.js';
import logger from '../utils/logger.js';

// Campos por defecto si el router falla
const ALL_FIELDS = [
    'sobre_mi', 'experiencia_laboral', 'educacion', 'cursos',
    'proyectos', 'habilidades', 'idiomas', 'respuestas_entrevista',
];

const DEFAULT_FALLBACK = {
    needs_db: true,
    intent: 'general_cv',
    fields_required: ALL_FIELDS,
};

/**
 * Clasifica un mensaje del usuario para decidir si necesita consultar la base de datos.
 * @param {string} message - Mensaje del usuario
 * @param {string} userName - Nombre del usuario para personalizar respuestas directas
 * @returns {Object} Decisión del router: { needs_db, direct_response?, intent?, fields_required? }
 */
export async function classify(message, userName) {
    const prompt = buildRouterPrompt(message, userName);

    const result = await generateJSON(prompt, DEFAULT_FALLBACK, {
        model: OLLAMA_ROUTER_MODEL,
        temperature: 0,
        numPredict: 60,
        numCtx: 1024,
        timeout: Math.min(OLLAMA_TIMEOUT, 30000),
    });

    if (!result || typeof result.needs_db !== 'boolean') {
        logger.warn({ result }, 'Router devolvió respuesta inválida, usando fallback');
        return DEFAULT_FALLBACK;
    }

    if (!result.needs_db) {
        const directResponse = typeof result.direct_response === 'string' ? result.direct_response.trim() : '';
        const looksLikeStructuredPayload = directResponse.startsWith('{')
            || directResponse.includes('fields_required')
            || directResponse.includes('"intent"');

        if (!directResponse || looksLikeStructuredPayload) {
            logger.warn({ result }, 'Router devolvió respuesta directa inválida, usando fallback de base de datos');
            return DEFAULT_FALLBACK;
        }

        result.direct_response = directResponse;
        return result;
    }

    // Validar campos requeridos si needs_db es true
    if (result.needs_db) {
        if (!Array.isArray(result.fields_required) || result.fields_required.length === 0) {
            result.fields_required = ALL_FIELDS;
        }
        // Filtrar campos inválidos
        result.fields_required = result.fields_required.filter(f => ALL_FIELDS.includes(f));
        if (result.fields_required.length === 0) {
            result.fields_required = ALL_FIELDS;
        }
    }

    logger.info({ intent: result.intent, needs_db: result.needs_db, fields: result.fields_required }, 'Router clasificó mensaje');
    return result;
}
