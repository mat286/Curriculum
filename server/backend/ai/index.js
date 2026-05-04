/**
 * Factory de proveedores de IA (Strategy Pattern).
 *
 * Controla qué implementación de IA se usa en toda la aplicación.
 * Cambiá AI_PROVIDER en el .env para alternar:
 *   AI_PROVIDER=gemini   → GeminiProvider con fallback a Ollama en 429  (por defecto)
 *   AI_PROVIDER=ollama   → OllamaProvider directo
 *
 * NOTA: Los embeddings (búsqueda semántica) SIEMPRE usan Ollama,
 * independientemente de este proveedor. Ver embeddingService.js.
 */
import { GeminiProvider } from './GeminiProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import logger from '../utils/logger.js';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();

let provider;

if (AI_PROVIDER === 'ollama') {
    provider = new OllamaProvider();
    logger.info('Proveedor IA: Ollama (local)');
} else {
    // Por defecto: Gemini con fallback automático a Ollama si hay 429 / cuota excedida
    const gemini = new GeminiProvider();
    const ollama = new OllamaProvider();

    provider = {
        async generate(prompt, options) {
            if (gemini.isInQuotaCooldown()) {
                logger.warn('[Gemini] En cooldown por 429. Usando Ollama para esta petición.');
                return ollama.generate(prompt, options);
            }
            try {
                return await gemini.generate(prompt, options);
            } catch (err) {
                if (err.isQuotaError || err.isNetworkError) {
                    logger.warn('[Gemini→Ollama] Fallback activado por cuota excedida o error de red.');
                    return ollama.generate(prompt, options);
                }
                throw err;
            }
        },

        async generateJSON(prompt, fallback, options) {
            if (gemini.isInQuotaCooldown()) {
                logger.warn('[Gemini] En cooldown por 429. Usando Ollama para esta petición (JSON).');
                return ollama.generateJSON(prompt, fallback, options);
            }
            try {
                return await gemini.generateJSON(prompt, fallback, options);
            } catch (err) {
                if (err.isQuotaError || err.isNetworkError) {
                    logger.warn('[Gemini→Ollama] Fallback activado por cuota excedida o error de red (JSON).');
                    return ollama.generateJSON(prompt, fallback, options);
                }
                throw err;
            }
        },

        async generateStream(prompt, options, onChunk) {
            if (gemini.isInQuotaCooldown()) {
                logger.warn('[Gemini] En cooldown por 429. Usando Ollama para streaming.');
                return ollama.generateStream(prompt, options, onChunk);
            }
            try {
                return await gemini.generateStream(prompt, options, onChunk);
            } catch (err) {
                if (err.isQuotaError || err.isNetworkError) {
                    logger.warn('[Gemini→Ollama] Fallback streaming activado por cuota excedida o error de red.');
                    return ollama.generateStream(prompt, options, onChunk);
                }
                throw err;
            }
        },

        async warmupModel(model) {
            return gemini.warmupModel(model);
        },
    };

    logger.info(`Proveedor IA: Gemini (${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}) + fallback Ollama`);
}

export default provider;
