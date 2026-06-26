/**
 * Factory de proveedores de IA (Strategy Pattern).
 *
 * Controla qué implementación de IA se usa en toda la aplicación.
 * Cambiá AI_PROVIDER en el .env para alternar:
 *   AI_PROVIDER=gemini  → GeminiProvider con 1 reintento automático (por defecto)
 *   AI_PROVIDER=ollama  → OllamaProvider directo (desarrollo sin internet)
 *
 * IMPORTANTE: Ollama se usa EXCLUSIVAMENTE para embeddings (nomic-embed-text).
 * No se carga ningún modelo LLM en Ollama. Si Gemini falla tras el reintento,
 * se devuelve un error claro al usuario.
 *
 * NOTA: Los embeddings (búsqueda semántica) SIEMPRE usan Ollama,
 * independientemente de este proveedor. Ver embeddingService.js.
 */
import { GeminiProvider } from './GeminiProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { LLMError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';

const AI_PROVIDER = (process.env.AI_PROVIDER || 'gemini').toLowerCase().trim();
const GEMINI_RETRY_DELAY_MS = parseInt(process.env.GEMINI_RETRY_DELAY_MS || '1500', 10);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Intenta llamar a fn(). Si falla con error recuperable (timeout / red),
 * espera GEMINI_RETRY_DELAY_MS y lo intenta una vez más.
 * Si falla de nuevo — o el error es de cuota (429) — lanza error limpio.
 */
async function withGeminiRetry(fn, context = '') {
    try {
        return await fn();
    } catch (firstErr) {
        // 429 / cuota: no tiene sentido reintentar inmediatamente
        if (firstErr.isQuotaError) {
            logger.warn(`[Gemini${context}] Cuota excedida (429). Sin reintento.`);
            throw new LLMError('El servicio de IA está temporalmente saturado. Intentalo en unos minutos.');
        }

        // Timeout o red: reintentamos una vez
        const isRetryable = firstErr.isNetworkError || firstErr.message?.includes('timeout');
        if (!isRetryable) throw firstErr;

        logger.warn(`[Gemini${context}] Primer intento falló (${firstErr.message}). Reintentando en ${GEMINI_RETRY_DELAY_MS}ms…`);
        await sleep(GEMINI_RETRY_DELAY_MS);

        try {
            return await fn();
        } catch (secondErr) {
            logger.warn(`[Gemini${context}] Segundo intento falló: ${secondErr.message}`);
            throw new LLMError('No se pudo obtener respuesta del servicio de IA. Verificá tu conexión e intentalo de nuevo.');
        }
    }
}

let provider;

if (AI_PROVIDER === 'ollama') {
    provider = new OllamaProvider();
    logger.info('Proveedor IA: Ollama (local)');
} else {
    const gemini = new GeminiProvider();

    provider = {
        async generate(prompt, options, systemInstruction) {
            if (gemini.isInQuotaCooldown()) {
                throw new LLMError('El servicio de IA está temporalmente saturado. Intentalo en unos minutos.');
            }
            return withGeminiRetry(
                () => gemini.generate(prompt, options, systemInstruction),
                ' generate',
            );
        },

        async generateJSON(prompt, fallback, options) {
            if (gemini.isInQuotaCooldown()) {
                return fallback;
            }
            try {
                return await withGeminiRetry(
                    () => gemini.generateJSON(prompt, fallback, options),
                    ' generateJSON',
                );
            } catch {
                // generateJSON es no-crítico: devolver fallback en lugar de explotar
                return fallback;
            }
        },

        async generateStream(prompt, options, onChunk, systemInstruction) {
            if (gemini.isInQuotaCooldown()) {
                throw new LLMError('El servicio de IA está temporalmente saturado. Intentalo en unos minutos.');
            }
            return withGeminiRetry(
                () => gemini.generateStream(prompt, options, onChunk, systemInstruction),
                ' stream',
            );
        },

        async warmupModel(_model) {
            return gemini.warmupModel(_model);
        },
    };

    logger.info(`Proveedor IA: Gemini (${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}) — sin fallback Ollama LLM`);
}

export default provider;
