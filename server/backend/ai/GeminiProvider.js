import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_TIMEOUT } from '../config/gemini.js';
import { LLMError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import { AIProvider } from './AIProvider.js';

// Duración del cooldown cuando se detecta un error 429.
// Configurable vía env para reducirlo en desarrollo (ej. GEMINI_COOLDOWN_MS=30000).
const QUOTA_COOLDOWN_MS = parseInt(process.env.GEMINI_COOLDOWN_MS || String(10 * 60 * 1000), 10);

/**
 * Extrae el retryDelay sugerido por la API de Gemini desde el mensaje de error.
 * Devuelve milisegundos.
 */
function parseRetryDelay(errorMessage = '') {
    const match = errorMessage.match(/retry in (\d+)/i);
    if (match) return parseInt(match[1], 10) * 1000;
    return 5000; // fallback: 5 segundos
}

export class GeminiProvider extends AIProvider {
    constructor() {
        super();
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY no configurada. Agregala al .env (AI_PROVIDER=gemini requiere esta clave).');
        }
        this._client = new GoogleGenerativeAI(GEMINI_API_KEY);
        // Timestamp hasta el cual Gemini está en cooldown por 429
        this._quotaCooldownUntil = 0;
    }

    /**
     * Verifica si Gemini está en cooldown por cuota excedida.
     */
    isInQuotaCooldown() {
        return Date.now() < this._quotaCooldownUntil;
    }

    /**
     * Activa el cooldown de cuota.
     */
    activateQuotaCooldown(durationMs = QUOTA_COOLDOWN_MS) {
        this._quotaCooldownUntil = Date.now() + durationMs;
        const minutes = Math.round(durationMs / 60000);
        logger.warn(`[Gemini] Cuota excedida (429). Cooldown activo por ${minutes} minutos.`);
    }

    /**
     * Determina si el error es un 429 / cuota excedida de Gemini.
     */
    isQuotaError(error) {
        const msg = error?.message || '';
        return msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded');
    }

    /**
     * Determina si el error es un fallo de red (sin conectividad a la API de Google).
     */
    isNetworkError(error) {
        const msg = String(error?.message || error?.cause?.message || '');
        return (
            msg.includes('fetch failed') ||
            msg.includes('Failed to fetch') ||
            msg.includes('ECONNREFUSED') ||
            msg.includes('ENOTFOUND') ||
            msg.includes('ETIMEDOUT') ||
            msg.includes('ECONNRESET') ||
            msg.includes('network socket disconnected') ||
            msg.includes('unable to verify the first certificate')
        );
    }

    /**
     * Genera texto libre con Gemini.
     */
    async generate(prompt, options = {}, systemInstruction = null) {
        if (!prompt || typeof prompt !== 'string') {
            throw new LLMError('El prompt no puede estar vacío');
        }

        const timeout = options.timeout ?? GEMINI_TIMEOUT;
        const modelConfig = {
            model: GEMINI_MODEL,
            generationConfig: {
                temperature: options.temperature ?? 0.2,
                maxOutputTokens: options.numPredict ?? 500,
            },
        };
        if (systemInstruction) {
            modelConfig.systemInstruction = systemInstruction;
        }
        const model = this._client.getGenerativeModel(modelConfig);

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new LLMError(`Gemini timeout después de ${timeout}ms`)), timeout)
        );

        try {
            const result = await Promise.race([
                model.generateContent(prompt.trim()),
                timeoutPromise,
            ]);
            return result.response.text().trim();
        } catch (error) {
            if (error instanceof LLMError) throw error;
            if (this.isQuotaError(error)) {
                const delay = parseRetryDelay(error.message);
                this.activateQuotaCooldown(Math.max(delay + 5000, QUOTA_COOLDOWN_MS));
                const quotaErr = new LLMError(`[Gemini 429] Cuota excedida. ${error.message}`);
                quotaErr.isQuotaError = true;
                throw quotaErr;
            }
            if (this.isNetworkError(error)) {
                logger.warn({ err: error.message }, '[Gemini] Error de red.');
                const netErr = new LLMError(`[Gemini network] ${error.message}`);
                netErr.isNetworkError = true;
                throw netErr;
            }
            logger.error({ err: error }, 'Error comunicando con Gemini');
            throw new LLMError(`Error al generar respuesta: ${error.message}`);
        }
    }

    /**
     * Genera JSON estructurado con Gemini usando el JSON mode nativo.
     */
    async generateJSON(prompt, fallback = null, options = {}) {
        if (!prompt || typeof prompt !== 'string') {
            return fallback;
        }

        const timeout = options.timeout ?? GEMINI_TIMEOUT;
        const model = this._client.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: options.temperature ?? 0,
                maxOutputTokens: options.numPredict ?? 500,
            },
        });

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new LLMError(`Gemini timeout después de ${timeout}ms`)), timeout)
        );

        try {
            const result = await Promise.race([
                model.generateContent(prompt.trim()),
                timeoutPromise,
            ]);
            const text = result.response.text().trim();
            return JSON.parse(text);
        } catch (error) {
            if (error instanceof LLMError && (error.isQuotaError || error.isNetworkError)) throw error;
            if (this.isQuotaError(error)) {
                const delay = parseRetryDelay(error.message);
                this.activateQuotaCooldown(Math.max(delay + 5000, QUOTA_COOLDOWN_MS));
                const quotaErr = new LLMError(`[Gemini 429] Cuota excedida. ${error.message}`);
                quotaErr.isQuotaError = true;
                throw quotaErr;
            }
            if (this.isNetworkError(error)) {
                logger.warn({ err: error.message }, '[Gemini] Error de red en generateJSON.');
                const netErr = new LLMError(`[Gemini network] ${error.message}`);
                netErr.isNetworkError = true;
                throw netErr;
            }
            if (error instanceof LLMError) {
                logger.warn({ err: error.message }, 'Gemini generateJSON timeout');
            } else {
                logger.warn({ err: error.message }, 'Error en Gemini generateJSON');
            }
            return fallback;
        }
    }

    /**
     * Igual que generate() pero llama a onChunk(token) por cada fragmento recibido,
     * permitiendo streaming hacia el cliente via SSE.
     */
    async generateStream(prompt, options = {}, onChunk, systemInstruction = null) {
        if (!prompt || typeof prompt !== 'string') {
            throw new LLMError('El prompt no puede estar vacío');
        }

        const modelConfig = {
            model: GEMINI_MODEL,
            generationConfig: {
                temperature: options.temperature ?? 0.2,
                maxOutputTokens: options.numPredict ?? 500,
            },
        };
        if (systemInstruction) {
            modelConfig.systemInstruction = systemInstruction;
        }
        const model = this._client.getGenerativeModel(modelConfig);

        try {
            const streamResult = await model.generateContentStream(prompt.trim());
            let result = '';

            for await (const chunk of streamResult.stream) {
                const text = chunk.text();
                if (text) {
                    result += text;
                    if (onChunk) onChunk(text);
                }
            }

            return result.trim();
        } catch (error) {
            if (error instanceof LLMError) throw error;
            if (this.isQuotaError(error)) {
                const delay = parseRetryDelay(error.message);
                this.activateQuotaCooldown(Math.max(delay + 5000, QUOTA_COOLDOWN_MS));
                const quotaErr = new LLMError(`[Gemini 429] Cuota excedida. ${error.message}`);
                quotaErr.isQuotaError = true;
                throw quotaErr;
            }
            if (this.isNetworkError(error)) {
                logger.warn({ err: error.message }, '[Gemini] Error de red en streaming.');
                const netErr = new LLMError(`[Gemini network] ${error.message}`);
                netErr.isNetworkError = true;
                throw netErr;
            }
            logger.error({ err: error }, 'Error en streaming con Gemini');
            throw new LLMError(`Error al generar respuesta streaming: ${error.message}`);
        }
    }

    /**
     * Gemini es un servicio cloud — no necesita precalentamiento.
     */
    async warmupModel(_model) {
        logger.info('Proveedor Gemini: warmup no necesario (servicio cloud)');
    }
}
