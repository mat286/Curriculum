import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/chroma.js', () => ({
    getOrCreateCollection: vi.fn(),
}));

vi.mock('../services/ollamaService.js', () => ({
    getEmbedding: vi.fn(),
}));

import { getOrCreateCollection } from '../config/chroma.js';
import { getEmbedding } from '../services/ollamaService.js';
import { TargetedSemanticRetriever } from '../modules/semantic/TargetedSemanticRetriever.js';

describe('TargetedSemanticRetriever', () => {
    it('dedupe elimina duplicados y conserva orden', async () => {
        const queryMock = vi.fn(async () => ({
            documents: [[
                'React y Node para APIs',
                'react y node para apis!!!',
                'Arquitectura de microservicios',
                'REACT y NODE para APIs',
            ]],
            metadatas: [[
                { type: 'habilidades', embedding_domain: 'candidate_skills_embedding' },
                { type: 'habilidades', embedding_domain: 'candidate_skills_embedding' },
                { type: 'habilidades', embedding_domain: 'candidate_skills_embedding' },
                { type: 'habilidades', embedding_domain: 'candidate_skills_embedding' },
            ]],
            distances: [[0.1, 0.2, 0.25, 0.12]],
        }));

        getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        getOrCreateCollection.mockResolvedValue({ query: queryMock });

        const retriever = new TargetedSemanticRetriever();
        const result = await retriever.retrieve({
            candidateId: 7,
            query: 'stack principal',
            includeSections: ['habilidades'],
            topK: 4,
            timeoutMs: 300,
            minSimilarity: 0,
        });

        expect(result.reason).toBe('ok');
        expect(result.chunks).toEqual([
            'React y Node para APIs',
            'Arquitectura de microservicios',
        ]);
        expect(result.chunkStats.beforeDedupe).toBe(4);
        expect(result.chunkStats.afterDedupe).toBe(2);
    });
});