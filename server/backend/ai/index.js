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
import {
    OLLAMA_FALLBACK_TIMEOUT,
    OLLAMA_FALLBACK_NUM_CTX,
    OLLAMA_KEEP_ALIVE,
} from '../config/ollama.js';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();

let provider;

function buildFallbackOptions(options = {}, mode = 'text') {
    const safeOptions = { ...options };

    // En fallback priorizamos robustez del primer token durante cold start.
    safeOptions.timeout = Math.max(options.timeout ?? 0, OLLAMA_FALLBACK_TIMEOUT);
    safeOptions.numCtx = Math.min(options.numCtx ?? OLLAMA_FALLBACK_NUM_CTX, OLLAMA_FALLBACK_NUM_CTX);
    safeOptions.keepAlive = options.keepAlive || OLLAMA_KEEP_ALIVE;
    safeOptions.retryAttempts = Math.max(options.retryAttempts ?? 1, 1);

    if (mode === 'json') {
        safeOptions.numPredict = Math.min(options.numPredict ?? 120, 120);
        safeOptions.temperature = options.temperature ?? 0;
    }

    if (mode === 'stream') {
        safeOptions.numPredict = Math.min(options.numPredict ?? 220, 220);
    }

    return safeOptions;
}

if (AI_PROVIDER === 'ollama') {
    provider = new OllamaProvider();
    logger.info('Proveedor IA: Ollama (local)');
} else {
    // Por defecto: Gemini con fallback automático a Ollama si hay 429 / cuota excedida
    const gemini = new GeminiProvider();
    const ollama = new OllamaProvider();

    provider = {
        async generate(prompt, options, systemInstruction) {
            if (gemini.isInQuotaCooldown()) {
                logger.warn('[Gemini] En cooldown por 429. Usando Ollama para esta petición.');
                // Ollama no soporta systemInstruction: concatenar al inicio del prompt
                const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
                return ollama.generate(fullPrompt, buildFallbackOptions(options, 'text'));
            }
            try {
                return await gemini.generate(prompt, options, systemInstruction);
            } catch (err) {
                if (err.isQuotaError || err.isNetworkError) {
                    logger.warn('[Gemini→Ollama] Fallback activado por cuota excedida o error de red.');
                    const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
                    return ollama.generate(fullPrompt, buildFallbackOptions(options, 'text'));
                }
                throw err;
            }
        },

        async generateJSON(prompt, fallback, options) {
            if (gemini.isInQuotaCooldown()) {
                logger.warn('[Gemini] En cooldown por 429. Usando Ollama para esta petición (JSON).');
                return ollama.generateJSON(prompt, fallback, buildFallbackOptions(options, 'json'));
            }
            try {
                return await gemini.generateJSON(prompt, fallback, options);
            } catch (err) {
                if (err.isQuotaError || err.isNetworkError) {
                    logger.warn('[Gemini→Ollama] Fallback activado por cuota excedida o error de red (JSON).');
                    return ollama.generateJSON(prompt, fallback, buildFallbackOptions(options, 'json'));
                }
                throw err;
            }
        },

        async generateStream(prompt, options, onChunk, systemInstruction) {
            if (gemini.isInQuotaCooldown()) {
                logger.warn('[Gemini] En cooldown por 429. Usando Ollama para streaming.');
                const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
                return ollama.generateStream(fullPrompt, buildFallbackOptions(options, 'stream'), onChunk);
            }
            try {
                return await gemini.generateStream(prompt, options, onChunk, systemInstruction);
            } catch (err) {
                if (err.isQuotaError || err.isNetworkError) {
                    logger.warn('[Gemini→Ollama] Fallback streaming activado por cuota excedida o error de red.');
                    const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
                    return ollama.generateStream(fullPrompt, buildFallbackOptions(options, 'stream'), onChunk);
                }
                throw err;
            }
        },

        async warmupModel(model) {
            const results = await Promise.allSettled([
                gemini.warmupModel(model),
                ollama.warmupModel(model),
            ]);

            const rejected = results.find(r => r.status === 'rejected');
            if (rejected) {
                logger.warn({ err: rejected.reason?.message || rejected.reason }, 'Warmup parcial de proveedores IA');
            }
        },
    };

    logger.info(`Proveedor IA: Gemini (${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}) + fallback Ollama`);
}

export default provider;
