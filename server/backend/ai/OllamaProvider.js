import {
    OLLAMA_URL,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT,
    OLLAMA_KEEP_ALIVE,
    OLLAMA_NUM_PREDICT,
    OLLAMA_NUM_CTX,
    OLLAMA_TEMPERATURE,
    OLLAMA_NUM_THREAD,
} from '../config/ollama.js';
import { LLMError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import { AIProvider } from './AIProvider.js';

export class OllamaProvider extends AIProvider {
    async generate(prompt, options = {}) {
        const model = options.model || OLLAMA_MODEL;
        const timeout = options.timeout || OLLAMA_TIMEOUT;

        if (!prompt || typeof prompt !== 'string') {
            throw new LLMError('El prompt no puede estar vacío');
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        const requestOptions = {
            temperature: options.temperature ?? OLLAMA_TEMPERATURE,
            num_predict: options.numPredict ?? OLLAMA_NUM_PREDICT,
            num_ctx: options.numCtx ?? OLLAMA_NUM_CTX,
        };

        const threadCount = options.numThread ?? OLLAMA_NUM_THREAD;
        if (Number.isInteger(threadCount) && threadCount > 0) {
            requestOptions.num_thread = threadCount;
        }

        try {
            const response = await fetch(`${OLLAMA_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt: prompt.trim(),
                    stream: true,
                    keep_alive: options.keepAlive || OLLAMA_KEEP_ALIVE,
                    options: requestOptions,
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new LLMError(`Ollama respondió con status ${response.status}`);
            }
            if (!response.body) {
                throw new LLMError('No se recibió respuesta de Ollama');
            }

            let result = '';
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(Boolean);

                for (const line of lines) {
                    try {
                        const json = JSON.parse(line);
                        if (json.response) result += json.response;
                        if (json.done) break;
                    } catch {
                        // Ignorar líneas que no son JSON válido
                    }
                }
            }

            return result.trim();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new LLMError(`Ollama timeout después de ${timeout}ms`);
            }
            if (error instanceof LLMError) throw error;
            logger.error({ err: error }, 'Error comunicando con Ollama');
            throw new LLMError(`Error al generar respuesta: ${error.message}`);
        } finally {
            clearTimeout(timer);
        }
    }

    async generateJSON(prompt, fallback = null, options = {}) {
        const raw = await this.generate(prompt, {
            temperature: 0,
            numPredict: 80,
            numCtx: 1024,
            ...options,
        });

        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                logger.warn({ raw }, 'No se encontró JSON en la respuesta de Ollama');
                return fallback;
            }
            return JSON.parse(jsonMatch[0]);
        } catch (err) {
            logger.warn({ raw, err: err.message }, 'Error parseando JSON de Ollama');
            return fallback;
        }
    }

    async warmupModel(model = OLLAMA_MODEL) {
        try {
            await this.generate('Responde solo: ok', {
                model,
                temperature: 0,
                numPredict: 8,
                numCtx: 256,
                timeout: Math.min(OLLAMA_TIMEOUT, 45000),
                keepAlive: OLLAMA_KEEP_ALIVE,
            });
            logger.info({ model }, 'Ollama precalentado');
        } catch (error) {
            logger.warn({ err: error, model }, 'No se pudo precalentar Ollama');
        }
    }
}
