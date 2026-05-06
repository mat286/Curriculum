import logger from '../utils/logger.js';

/**
 * ReRankingService
 * 
 * Re-rankea resultados de búsqueda usando embeddings de Gemini.
 * Mejora precision filtrando resultados de baja relevancia.
 * 
 * Estrategia:
 * 1. Usar Gemini embeddings API (lightweight, compartir quota con LLM)
 * 2. Re-rankear top-5 resultados por relevancia a pregunta + contexto
 * 3. Filtrar results con score < threshold
 * 4. Loguear decisiones para auditoría
 * 
 * Cost: ~10 tokens por reranking (embeddings), offset by precision gain
 * Latency: +20-50ms (parallelizable con LLM generation)
 */
export class ReRankingService {
    constructor() {
        this.enableReranking = process.env.ENABLE_RERANKING !== 'false';
        this.relevanceThreshold = parseFloat(process.env.RERANKING_THRESHOLD || '0.4');
        this.useGeminiEmbeddings = process.env.RERANKING_USE_GEMINI_EMBEDDINGS !== 'false';
        this.maxRerankedResults = parseInt(process.env.RERANKING_MAX_RESULTS || '4', 10);
    }

    /**
     * Calcula similitud coseno entre dos vectores de embeddings.
     * Usa producto punto normalizado.
     */
    _cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

        if (magnitudeA === 0 || magnitudeB === 0) return 0;
        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * Calcula puntuación de relevancia basada en:
     * - Similitud semántica entre result y question
     * - Proximidad contextual (si hay contexto previo)
     * - Longitud y densidad del resultado
     * 
     * Score final: [0, 1]
     */
    _computeRelevanceScore(
        resultText,
        question,
        resultEmbedding,
        questionEmbedding,
        contextEmbedding = null,
    ) {
        let score = 0.5; // Baseline

        // Componente 1: Similitud semántica directa (peso 70%)
        if (resultEmbedding && questionEmbedding) {
            const similarity = this._cosineSimilarity(resultEmbedding, questionEmbedding);
            score += similarity * 0.7;
        } else {
            // Fallback: similitud textual simple
            const queryTerms = new Set(
                String(question || '')
                    .toLowerCase()
                    .split(/\s+/)
                    .filter((w) => w.length > 2),
            );
            const resultTerms = String(resultText || '')
                .toLowerCase()
                .split(/\s+/)
                .filter((w) => w.length > 2);

            const matches = resultTerms.filter((t) => queryTerms.has(t)).length;
            const textSimilarity = matches / Math.max(queryTerms.size, resultTerms.length, 1);
            score += textSimilarity * 0.7;
        }

        // Componente 2: Contexto (si existe) - peso 20%
        if (contextEmbedding && resultEmbedding) {
            const contextSimilarity = this._cosineSimilarity(resultEmbedding, contextEmbedding);
            score += contextSimilarity * 0.2;
        }

        // Componente 3: Heurística de densidad (peso 10%)
        // Resultados más largos y con más información tienen mayor score
        const textLength = String(resultText || '').length;
        const wordCount = textLength / 5; // Estimación: 5 chars por palabra
        const densityScore = Math.min(1, wordCount / 50); // Normalizar a [0,1], 50 palabras = 1.0
        score += densityScore * 0.1;

        // Clamp a [0, 1]
        return Math.max(0, Math.min(1, score));
    }

    /**
     * Filtra resultados por relevancia threshold.
     * Descarta resultados con score < threshold.
     */
    filterByRelevance(rankedResults, threshold = null) {
        const filterThreshold = threshold !== null ? threshold : this.relevanceThreshold;
        const filtered = rankedResults.filter((r) => r.relevanceScore >= filterThreshold);

        const stats = {
            originalCount: rankedResults.length,
            filteredCount: filtered.length,
            removedCount: rankedResults.length - filtered.length,
            threshold: filterThreshold,
        };

        logger.debug(stats, 'Results filtered by relevance threshold');

        return { filtered, stats };
    }

    /**
     * Re-rankea resultados usando relevancia semántica.
     * Retorna { rankedResults, stats }
     * 
     * rankedResults: array de { text, score, relevanceScore, source }
     */
    rerank({
        results = [],
        question,
        resultEmbeddings = [],
        questionEmbedding,
        contextEmbedding = null,
        candidateId,
        requestId,
    }) {
        if (!this.enableReranking || results.length === 0) {
            return {
                rankedResults: results.map((text) => ({
                    text,
                    relevanceScore: 0.5,
                    source: 'bypass',
                })),
                stats: { method: 'bypass', reason: 'reranking disabled or no results' },
            };
        }

        const started = Date.now();
        const rankedResults = [];

        // Re-rankear cada resultado
        for (let i = 0; i < results.length; i++) {
            const text = results[i];
            const embedding = resultEmbeddings[i] || null;

            const relevanceScore = this._computeRelevanceScore(
                text,
                question,
                embedding,
                questionEmbedding,
                contextEmbedding,
            );

            rankedResults.push({
                text,
                relevanceScore: parseFloat(relevanceScore.toFixed(3)),
                rank: i + 1, // Original rank
                source: 'reranked',
            });
        }

        // Ordenar por relevance score descendente
        rankedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Actualizar ranks después de reordenar
        for (let i = 0; i < rankedResults.length; i++) {
            rankedResults[i].newRank = i + 1;
        }

        // Filtrar por threshold
        const { filtered, stats: filterStats } = this.filterByRelevance(rankedResults);

        // Top-N
        const topResults = filtered.slice(0, this.maxRerankedResults);

        const stats = {
            requestId,
            candidateId,
            method: 'reranking',
            originalCount: results.length,
            rerankedCount: rankedResults.length,
            filteredCount: filtered.length,
            topCount: topResults.length,
            durationMs: Date.now() - started,
            averageRelevanceScore: (
                topResults.reduce((sum, r) => sum + r.relevanceScore, 0) / Math.max(topResults.length, 1)
            ).toFixed(3),
            filterStats,
        };

        logger.info(stats, 'Re-ranking completed');

        return {
            rankedResults: topResults,
            stats,
        };
    }

    /**
     * Ejecuta re-ranking sin dependencia de embeddings Gemini.
     * Useful para fallback si Gemini API no disponible.
     */
    rerankWithoutEmbeddings({
        results = [],
        question,
        candidateId,
        requestId,
    }) {
        logger.debug({ candidateId }, 'Re-ranking without Gemini embeddings (fallback)');

        return this.rerank({
            results,
            question,
            resultEmbeddings: [],
            questionEmbedding: null,
            contextEmbedding: null,
            candidateId,
            requestId,
        });
    }
}
