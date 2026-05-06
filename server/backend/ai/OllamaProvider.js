import {
    OLLAMA_URL,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT,
    OLLAMA_GENERATE_TIMEOUT,
    OLLAMA_KEEP_ALIVE,
    OLLAMA_NUM_PREDICT,
    OLLAMA_NUM_CTX,
    OLLAMA_TEMPERATURE,
    OLLAMA_NUM_THREAD,
    OLLAMA_RETRY_ATTEMPTS,
    OLLAMA_RETRY_BASE_DELAY_MS,
} from '../config/ollama.js';
import { LLMError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import { AIProvider } from './AIProvider.js';
import { isRetryableError } from '../utils/retryUtils.js';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeRetryAttempts(value) {
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return parsed;
}

function isRetryableStatus(status) {
    return status === 408 || status === 429 || status >= 500;
}

function toTimeoutError(timeout) {
    const err = new LLMError(`Ollama timeout después de ${timeout}ms`);
    err.retryable = true;
    err.isTimeout = true;
    return err;
}

function toHttpError(status) {
    const err = new LLMError(`Ollama respondió con status ${status}`);
    err.statusCode = status;
    err.retryable = isRetryableStatus(status);
    return err;
}

export class OllamaProvider extends AIProvider {
    buildRequestOptions(options = {}) {
        const requestOptions = {
            temperature: options.temperature ?? OLLAMA_TEMPERATURE,
            num_predict: options.numPredict ?? OLLAMA_NUM_PREDICT,
            num_ctx: options.numCtx ?? OLLAMA_NUM_CTX,
        };

        const threadCount = options.numThread ?? OLLAMA_NUM_THREAD;
        if (Number.isInteger(threadCount) && threadCount > 0) {
            requestOptions.num_thread = threadCount;
        }

        return requestOptions;
    }

    parseNdjsonChunkBuffer(buffer, onItem) {
        let pending = buffer;
        let stop = false;

        while (!stop) {
            const newlineIndex = pending.indexOf('\n');
            if (newlineIndex < 0) break;

            const line = pending.slice(0, newlineIndex).trim();
            pending = pending.slice(newlineIndex + 1);

            if (!line) continue;

            try {
                const item = JSON.parse(line);
                stop = onItem(item) === true;
            } catch {
                // Mantener compatibilidad: ignorar líneas no parseables
            }
        }

        return { pending, stop };
    }

    async streamGenerate({ prompt, model, timeout, options = {}, onChunk }) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${OLLAMA_URL}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    prompt: prompt.trim(),
                    stream: true,
                    keep_alive: options.keepAlive || OLLAMA_KEEP_ALIVE,
                    options: this.buildRequestOptions(options),
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw toHttpError(response.status);
            }

            if (!response.body) {
                throw new LLMError('No se recibió respuesta de Ollama');
            }

            let result = '';
            let pending = '';
            let shouldStop = false;
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');

            const handleItem = (json) => {
                if (json.error) {
                    throw new LLMError(`Ollama devolvió error: ${json.error}`);
                }

                if (json.response) {
                    result += json.response;
                    if (onChunk) onChunk(json.response);
                }

                return json.done === true;
            };

            while (!shouldStop) {
                const { done, value } = await reader.read();
                if (done) break;

                pending += decoder.decode(value, { stream: true });
                const parsed = this.parseNdjsonChunkBuffer(pending, handleItem);
                pending = parsed.pending;
                shouldStop = parsed.stop;
            }

            pending += decoder.decode();
            const finalParsed = this.parseNdjsonChunkBuffer(pending, handleItem);
            pending = finalParsed.pending;

            const tail = pending.trim();
            if (tail) {
                try {
                    handleItem(JSON.parse(tail));
                } catch {
                    logger.debug({ tailLength: tail.length }, 'Chunk NDJSON final incompleto o no parseable en Ollama');
                }
            }

            return result.trim();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw toTimeoutError(timeout);
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    }

    async generateWithRetry(prompt, options = {}, onChunk) {
        const model = options.model || OLLAMA_MODEL;
        const timeout = options.timeout ?? OLLAMA_GENERATE_TIMEOUT ?? OLLAMA_TIMEOUT;
        const maxRetries = normalizeRetryAttempts(options.retryAttempts ?? OLLAMA_RETRY_ATTEMPTS);
        const baseDelayMs = Math.max(0, Number.parseInt(String(options.retryBaseDelayMs ?? OLLAMA_RETRY_BASE_DELAY_MS), 10) || 0);

        let lastError;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await this.streamGenerate({ prompt, model, timeout, options, onChunk });
            } catch (error) {
                lastError = error;
                const shouldRetry = attempt < maxRetries && isRetryableError(error);

                if (!shouldRetry) {
                    break;
                }

                const backoffMs = baseDelayMs * (2 ** attempt);
                logger.warn({
                    attempt: attempt + 1,
                    maxRetries,
                    backoffMs,
                    err: error.message,
                }, 'Fallo transitorio en Ollama /api/generate, reintentando');

                if (backoffMs > 0) {
                    await sleep(backoffMs);
                }
            }
        }

        if (lastError instanceof LLMError) {
            throw lastError;
        }

        logger.error({ err: lastError }, 'Error comunicando con Ollama');
        throw new LLMError(`Error al generar respuesta: ${lastError?.message || 'error desconocido'}`);
    }

    async generate(prompt, options = {}) {
        if (!prompt || typeof prompt !== 'string') {
            throw new LLMError('El prompt no puede estar vacío');
        }

        return this.generateWithRetry(prompt, options);
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

    /**
     * Igual que generate() pero llama a onChunk(token) por cada fragmento recibido,
     * permitiendo streaming hacia el cliente.
     */
    async generateStream(prompt, options = {}, onChunk) {
        if (!prompt || typeof prompt !== 'string') {
            throw new LLMError('El prompt no puede estar vacío');
        }

        return this.generateWithRetry(prompt, options, onChunk);
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
