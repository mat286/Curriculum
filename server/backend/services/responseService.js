import { generate } from './ollamaService.js';
import { buildResponsePrompt } from '../prompts/response.prompt.js';
import { OLLAMA_KEEP_ALIVE, OLLAMA_MODEL, OLLAMA_NUM_CTX, OLLAMA_TIMEOUT } from '../config/ollama.js';

/**
 * Genera la respuesta final del chat como la persona del CV.
 * @param {string} userName - Nombre completo del usuario
 * @param {string} question - Pregunta original del usuario
 * @param {Object} data - Datos obtenidos de la base de datos
 * @param {string[]} embeddingResults - Resultados de búsqueda semántica (opcional)
 * @returns {string} Respuesta generada
 */
export async function generateResponse(userName, question, data, embeddingResults = []) {
    const prompt = buildResponsePrompt(userName, question, data, embeddingResults);
    return generate(prompt, {
        model: OLLAMA_MODEL,
        keepAlive: OLLAMA_KEEP_ALIVE,
        temperature: 0.25,
        numPredict: 120,
        numCtx: Math.min(OLLAMA_NUM_CTX, 2048),
        timeout: OLLAMA_TIMEOUT,
    });
}
