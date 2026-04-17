import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY, GEMINI_MODEL, GEMINI_TIMEOUT } from '../config/gemini.js';
import { LLMError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import { AIProvider } from './AIProvider.js';

export class GeminiProvider extends AIProvider {
    constructor() {
        super();
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY no configurada. Agregala al .env (AI_PROVIDER=gemini requiere esta clave).');
        }
        this._client = new GoogleGenerativeAI(GEMINI_API_KEY);
    }

    /**
     * Genera texto libre con Gemini.
     * Las opciones model, numCtx y keepAlive no aplican a Gemini y son ignoradas.
     */
    async generate(prompt, options = {}) {
        if (!prompt || typeof prompt !== 'string') {
            throw new LLMError('El prompt no puede estar vacío');
        }

        const timeout = options.timeout ?? GEMINI_TIMEOUT;
        const model = this._client.getGenerativeModel({
            model: GEMINI_MODEL,
            generationConfig: {
                temperature: options.temperature ?? 0.2,
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
            return result.response.text().trim();
        } catch (error) {
            if (error instanceof LLMError) throw error;
            logger.error({ err: error }, 'Error comunicando con Gemini');
            throw new LLMError(`Error al generar respuesta: ${error.message}`);
        }
    }

    /**
     * Genera JSON estructurado con Gemini usando el JSON mode nativo
     * (responseMimeType: 'application/json'). Más confiable que parsear texto libre.
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
            if (error instanceof LLMError) {
                logger.warn({ err: error.message }, 'Gemini generateJSON timeout');
            } else {
                logger.warn({ err: error.message }, 'Error en Gemini generateJSON');
            }
            return fallback;
        }
    }

    /**
     * Gemini es un servicio cloud — no necesita precalentamiento.
     */
    async warmupModel(_model) {
        logger.info('Proveedor Gemini: warmup no necesario (servicio cloud)');
    }
}
