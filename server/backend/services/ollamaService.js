/**
 * Shim de compatibilidad — Strategy Pattern para proveedores de IA.
 *
 * Este módulo re-exporta generate, generateJSON y warmupModel desde el
 * proveedor activo (Gemini u Ollama según AI_PROVIDER en .env).
 * Todos los servicios y controladores importan desde aquí sin saber
 * qué proveedor está activo.
 *
 * IMPORTANTE: getEmbedding siempre usa Ollama directamente,
 * independientemente del AI_PROVIDER configurado.
 */
import provider from '../ai/index.js';
import { LLMError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import { OLLAMA_URL, OLLAMA_TIMEOUT, EMBEDDING_MODEL as DEFAULT_EMBEDDING_MODEL } from '../config/ollama.js';

// ── Delegación al proveedor activo ────────────────────────────────────────────

export const generate = (prompt, options) => provider.generate(prompt, options);
export const generateJSON = (prompt, fallback, options) => provider.generateJSON(prompt, fallback, options);
export const generateStream = (prompt, options, onChunk) => provider.generateStream(prompt, options, onChunk);
export const warmupModel = (model) => provider.warmupModel(model);

// ── Embeddings: SIEMPRE Ollama (nomic-embed-text) ─────────────────────────────
// Los embeddings deben mantenerse en Ollama para no romper las colecciones
// existentes en ChromaDB (las dimensiones del vector deben ser consistentes).

export async function getEmbedding(text, model) {
    const embeddingModel = model || DEFAULT_EMBEDDING_MODEL;
    const timeout = OLLAMA_TIMEOUT;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: embeddingModel, prompt: text }),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new LLMError(`Error generando embedding: status ${response.status}`);
        }

        const data = await response.json();
        return data.embedding;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new LLMError(`Embedding timeout después de ${timeout}ms`);
        }
        if (error instanceof LLMError) throw error;
        throw new LLMError(`Error generando embedding: ${error.message}`);
    } finally {
        clearTimeout(timer);
    }
}

export async function getEmbeddings(texts, model) {
    const embeddingModel = model || DEFAULT_EMBEDDING_MODEL;
    const timeout = OLLAMA_TIMEOUT;
    const values = Array.isArray(texts) ? texts.map((item) => String(item || '')) : [];

    if (values.length === 0) return [];
    if (values.length === 1) {
        const single = await getEmbedding(values[0], embeddingModel);
        return [single];
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(`${OLLAMA_URL}/api/embed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: embeddingModel,
                input: values,
                keep_alive: process.env.OLLAMA_EMBEDDING_KEEP_ALIVE || process.env.OLLAMA_KEEP_ALIVE || '30m',
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new LLMError(`Error generando embeddings batch: status ${response.status}`);
        }

        const data = await response.json();
        const embeddings = Array.isArray(data?.embeddings) ? data.embeddings : [];

        if (embeddings.length !== values.length) {
            logger.warn(
                { expected: values.length, got: embeddings.length, model: embeddingModel },
                'Embeddings batch con longitud inesperada, aplicando fallback individual',
            );
            return Promise.all(values.map((item) => getEmbedding(item, embeddingModel)));
        }

        return embeddings;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new LLMError(`Embeddings batch timeout después de ${timeout}ms`);
        }

        // Fallback compatible: versiones antiguas de Ollama o respuestas parciales
        logger.warn({ err: error, model: embeddingModel }, 'Fallo en /api/embed, fallback a /api/embeddings individual');
        return Promise.all(values.map((item) => getEmbedding(item, embeddingModel)));
    } finally {
        clearTimeout(timer);
    }
}

