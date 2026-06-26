import { describe, it, expect, beforeEach } from 'vitest';
import { ReRankingService } from '../services/ReRankingService.js';

describe('ReRankingService', () => {
    let service;

    beforeEach(() => {
        service = new ReRankingService();
        process.env.ENABLE_RERANKING = 'true';
    });

    it('debería calcular similitud coseno correctamente (vía textUtils)', async () => {
        // _cosineSimilarity eliminado en refactor; la función está en utils/textUtils.js
        const { cosineSimilarity } = await import('../utils/textUtils.js');
        const vec1 = [1, 0, 0];
        const vec2 = [1, 0, 0];
        const vec3 = [0, 1, 0];

        expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0);
        expect(cosineSimilarity(vec1, vec3)).toBeCloseTo(0.0);
    });

    it('debería computar relevance score entre 0 y 1', () => {
        const score = service._computeRelevanceScore(
            'React development expertise',
            'Tell me about your React experience',
        );

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
    });

    it('debería filtrar resultados por relevance threshold', () => {
        const rankedResults = [
            { text: 'High relevance result', relevanceScore: 0.95, source: 'semantic' },
            { text: 'Medium relevance result', relevanceScore: 0.65, source: 'semantic' },
            { text: 'Low relevance result', relevanceScore: 0.25, source: 'semantic' },
        ];

        const { filtered, stats } = service.filterByRelevance(rankedResults, 0.5);

        expect(filtered.length).toBeLessThan(rankedResults.length);
        expect(filtered.every((r) => r.relevanceScore >= 0.5)).toBe(true);
        expect(stats.removedCount).toBeGreaterThan(0);
    });

    it('debería re-rankear resultados por relevancia', () => {
        const results = [
            'First result not very relevant',
            'Second result highly relevant to question',
            'Third result somewhat relevant',
        ];

        const reranked = service.rerank({
            results,
            question: 'relevant question about topic',
            resultEmbeddings: [],
            questionEmbedding: null,
        });

        expect(reranked.rankedResults.length).toBeLessThanOrEqual(results.length);
        expect(reranked.rankedResults[0]).toHaveProperty('text');
        expect(reranked.rankedResults[0]).toHaveProperty('relevanceScore');
        expect(reranked.stats.method).toBe('reranking');
    });

    it('debería loguear stats de re-ranking', () => {
        const results = [
            'Result about React',
            'Result about backend',
        ];

        const reranked = service.rerank({
            results,
            question: 'React experience',
            candidateId: 'test-123',
            requestId: 'req-456',
        });

        expect(reranked.stats.originalCount).toBe(2);
        expect(reranked.stats.filteredCount).toBeGreaterThanOrEqual(0);
        expect(reranked.stats.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('debería bypass si reranking está deshabilitado', () => {
        process.env.ENABLE_RERANKING = 'false';
        const disabledService = new ReRankingService();

        const results = ['Result 1', 'Result 2'];
        const reranked = disabledService.rerank({
            results,
            question: 'test',
        });

        expect(reranked.stats.method).toBe('bypass');
    });
});
