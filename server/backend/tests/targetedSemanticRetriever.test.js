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
    it('ajusta minSimilarity efectivo para consultas factuales', async () => {
        const queryMock = vi.fn(async () => ({
            documents: [['Email: ana@example.com', 'Resumen general de experiencia']],
            metadatas: [[
                { type: 'datos_personales', embedding_domain: 'candidate_summary_embedding' },
                { type: 'sobre_mi', embedding_domain: 'candidate_summary_embedding' },
            ]],
            distances: [[0.28, 0.31]], // similarities: 0.72 y 0.69
        }));

        getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        getOrCreateCollection.mockResolvedValue({ query: queryMock });

        const retriever = new TargetedSemanticRetriever();
        const result = await retriever.retrieve({
            candidateId: 8,
            query: 'Cual es tu email?',
            includeSections: ['usuario'],
            topK: 3,
            timeoutMs: 300,
            minSimilarity: 0.66,
            intent: 'contact',
            intentConfidence: 0.95,
            queryType: 'fact',
        });

        expect(result.reason).toBe('ok');
        expect(result.chunkStats.effectiveMinSimilarity).toBeGreaterThan(0.7);
        expect(result.chunkStats.droppedBySimilarity).toBeGreaterThanOrEqual(1);
    });

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

    it('dedupe near-duplicate elimina chunks semanticamente casi iguales', async () => {
        const queryMock = vi.fn(async () => ({
            documents: [[
                'Desarrolle APIs en Node.js con observabilidad y tracing distribuido',
                'Node.js APIs con tracing distribuido y observabilidad en produccion',
                'Lidere un equipo para migracion a microservicios',
            ]],
            metadatas: [[
                { type: 'experiencia_laboral', embedding_domain: 'candidate_experience_embedding' },
                { type: 'experiencia_laboral', embedding_domain: 'candidate_experience_embedding' },
                { type: 'experiencia_laboral', embedding_domain: 'candidate_experience_embedding' },
            ]],
            distances: [[0.15, 0.16, 0.2]],
        }));

        getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        getOrCreateCollection.mockResolvedValue({ query: queryMock });

        // Jaccard entre los dos chunks similares ≈ 0.75; bajamos threshold a 0.7 para detectarlo
        process.env.SEMANTIC_NEAR_DUPLICATE_THRESHOLD = '0.7';
        const retriever = new TargetedSemanticRetriever();
        const result = await retriever.retrieve({
            candidateId: 9,
            query: 'Que experiencia tenes en backend?',
            includeSections: ['experiencia_laboral'],
            topK: 4,
            timeoutMs: 300,
            minSimilarity: 0,
            queryType: 'detail',
        });
        delete process.env.SEMANTIC_NEAR_DUPLICATE_THRESHOLD;

        expect(result.reason).toBe('ok');
        expect(result.chunkStats.droppedByNearDuplicate).toBeGreaterThanOrEqual(1);
        expect(result.chunks.length).toBeLessThan(3);
    });
});