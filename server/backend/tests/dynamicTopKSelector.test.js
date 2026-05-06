import { describe, it, expect, beforeEach } from 'vitest';
import { DynamicTopKSelector } from '../services/DynamicTopKSelector.js';

describe('DynamicTopKSelector', () => {
    let selector;

    beforeEach(() => {
        selector = new DynamicTopKSelector();
    });

    it('debería seleccionar top-k bajo para alta confianza', () => {
        const freshSelector = new DynamicTopKSelector();
        const result = freshSelector.selectTopK({
            intentConfidence: 0.95,
            semanticSimilarities: [0.95, 0.92],
            questionLength: 25,
            intent: 'experience',
            candidateId: 'test-123',
            requestId: 'req-456',
        });

        // Con alta confianza, debería seleccionar top-k bajo
        expect(result.confidenceScore).toBeGreaterThanOrEqual(0.85);
        expect(result.topK).toBeLessThanOrEqual(3);
    });

    it('debería seleccionar top-k=3 para confianza media (70-90%)', () => {
        const result = selector.selectTopK({
            intentConfidence: 0.80,
            semanticSimilarities: [0.8],
            questionLength: 30,
            intent: 'skills',
            candidateId: 'test-123',
            requestId: 'req-456',
        });

        expect(result.topK).toBeGreaterThanOrEqual(2);
        expect(result.decision).toBe('balanced-retrieval');
    });

    it('debería seleccionar top-k=4 para baja confianza (50-70%)', () => {
        const result = selector.selectTopK({
            intentConfidence: 0.60,
            semanticSimilarities: [],
            questionLength: 20,
            intent: 'general',
            candidateId: 'test-123',
            requestId: 'req-456',
        });

        expect(result.topK).toBeGreaterThanOrEqual(3);
        expect(result.decision).toBe('expanded-retrieval');
    });

    it('debería desactivar RAG para confianza muy baja (<30%)', () => {
        process.env.DISABLE_RAG_BELOW_CONFIDENCE = '0.25';
        const freshSelector = new DynamicTopKSelector();

        const result = freshSelector.selectTopK({
            intentConfidence: 0.15,
            semanticSimilarities: [0.1],
            questionLength: 3,
            intent: null,
            candidateId: 'test-123',
            requestId: 'req-456',
        });

        expect(result.decision).toBe('disable-rag');
    });

    it('debería evaluar confidence desde múltiples señales', () => {
        const confidenceData = selector.evaluateConfidence({
            intentConfidence: 0.8,
            semanticSimilarities: [0.9, 0.85, 0.8],
            questionLength: 50,
            historicalHitRate: 0.75,
        });

        expect(confidenceData.confidenceScore).toBeGreaterThan(0);
        expect(confidenceData.confidenceScore).toBeLessThanOrEqual(1);
        expect(confidenceData.intentSignal).toBeDefined();
        expect(confidenceData.semanticSignal).toBeDefined();
    });

    it('debería aplicar override via ENV', () => {
        process.env.SEMANTIC_TOPK_OVERRIDE = '7';
        const freshSelector = new DynamicTopKSelector();

        const selectedTopK = freshSelector.selectTopK({
            intentConfidence: 0.95,
            questionLength: 20,
            candidateId: 'test',
            requestId: 'req',
        }).topK;

        const effective = freshSelector.getEffectiveTopK(selectedTopK);

        expect(effective).toBe(7);
        delete process.env.SEMANTIC_TOPK_OVERRIDE;
    });
});
