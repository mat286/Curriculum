import { getOrCreateCollection } from '../../config/chroma.js';
import { getEmbedding } from '../../services/ollamaService.js';
import logger from '../../utils/logger.js';
import { withTimeout } from '../../utils/chatHelpers.js';

export class SemanticSearchService {
    constructor(cacheService) {
        this.cacheService = cacheService;
        this.embeddingCache = new Map();
        this.embeddingTtlMs = 10 * 60 * 1000;
        this.embeddingMaxSize = 1000;
        this.failureCount = 0;
        this.openUntil = 0;
    }

    isOpen() {
        return Date.now() < this.openUntil;
    }

    markFailure() {
        this.failureCount += 1;
        if (this.failureCount >= 5) {
            this.openUntil = Date.now() + 30000;
            logger.warn('SemanticSearch circuit breaker abierto por fallas de embedding');
        }
    }

    markSuccess() {
        this.failureCount = 0;
        this.openUntil = 0;
    }

    getCachedEmbedding(query) {
        const key = query.trim().toLowerCase();
        const entry = this.embeddingCache.get(key);
        if (!entry) return null;
        if (Date.now() - entry.ts > this.embeddingTtlMs) {
            this.embeddingCache.delete(key);
            return null;
        }
        return entry.embedding;
    }

    setCachedEmbedding(query, embedding) {
        const key = query.trim().toLowerCase();
        if (this.embeddingCache.size >= this.embeddingMaxSize) {
            const oldest = this.embeddingCache.keys().next().value;
            this.embeddingCache.delete(oldest);
        }
        this.embeddingCache.set(key, { embedding, ts: Date.now() });
    }

    async search({ candidateId, query, topK = 2, timeoutMs = 500 }) {
        const started = Date.now();
        if (this.isOpen()) {
            return { chunks: [], degraded: true, reason: 'circuit-open', durationMs: Date.now() - started };
        }

        const semanticKey = `sem:${candidateId}:${query.trim().toLowerCase()}`;
        const cachedSemantic = this.cacheService.getSemantic(semanticKey);
        if (cachedSemantic) {
            return { chunks: cachedSemantic, degraded: false, reason: 'semantic-cache', durationMs: Date.now() - started };
        }

        try {
            const collection = await getOrCreateCollection(candidateId);
            let embedding = this.getCachedEmbedding(query);
            if (!embedding) {
                embedding = await withTimeout(getEmbedding(query), timeoutMs, null);
                if (!embedding) {
                    return { chunks: [], degraded: true, reason: 'embedding-timeout', durationMs: Date.now() - started };
                }
                this.setCachedEmbedding(query, embedding);
            }

            const result = await withTimeout(
                collection.query({ queryEmbeddings: [embedding], nResults: topK }),
                timeoutMs,
                null,
            );

            const chunks = result?.documents?.[0] || [];
            this.cacheService.setSemantic(semanticKey, chunks);
            this.markSuccess();
            return { chunks, degraded: false, reason: 'ok', durationMs: Date.now() - started };
        } catch (error) {
            this.markFailure();
            logger.warn({ err: error, candidateId }, 'SemanticSearch fallback sin contexto semántico');
            return { chunks: [], degraded: true, reason: 'error', durationMs: Date.now() - started };
        }
    }
}
