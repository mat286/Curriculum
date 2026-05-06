import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    collectionQuery: vi.fn(),
    getOrCreateCollection: vi.fn(),
    getEmbedding: vi.fn(),
    recordQueryTelemetry: vi.fn(),
    hybridSearch: vi.fn(),
}));

vi.mock('../config/chroma.js', () => ({
    getOrCreateCollection: mocks.getOrCreateCollection,
    getOrCreateGlobalCollection: vi.fn(),
}));

vi.mock('../services/ollamaService.js', () => ({
    getEmbedding: mocks.getEmbedding,
}));

vi.mock('../services/EmbeddingMetadataRepository.js', () => ({
    embeddingMetadataRepository: {
        recordQueryTelemetry: mocks.recordQueryTelemetry,
        markCandidateDocsInactive: vi.fn(),
        upsertDocumentsMetadata: vi.fn(),
    },
}));

vi.mock('../services/HybridSearchService.js', () => ({
    HybridSearchService: vi.fn().mockImplementation(() => ({
        search: mocks.hybridSearch,
    })),
}));

import { search } from '../services/embeddingService.js';

describe('embeddingService.search', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.getOrCreateCollection.mockResolvedValue({ query: mocks.collectionQuery });
        mocks.getEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
        mocks.collectionQuery.mockResolvedValue({
            documents: [['doc-sem-1', 'doc-sem-2']],
        });
        mocks.recordQueryTelemetry.mockResolvedValue();
        mocks.hybridSearch.mockReturnValue({
            results: ['doc-hybrid-1'],
            method: 'hybrid',
        });
    });

    it('retorna resultados semánticos cuando no hay profileContext', async () => {
        const result = await search('node js', 7, 2);

        expect(result).toEqual(['doc-sem-1', 'doc-sem-2']);
        expect(mocks.collectionQuery).toHaveBeenCalledWith({
            queryEmbeddings: [[0.1, 0.2, 0.3]],
            nResults: 2,
        });
        expect(mocks.hybridSearch).not.toHaveBeenCalled();
        expect(mocks.recordQueryTelemetry).toHaveBeenCalledWith(expect.objectContaining({
            candidateId: 7,
            method: 'semantic',
            hits: 2,
        }));
    });

    it('activa flujo hybrid cuando options.profileContext está presente', async () => {
        const profileContext = { habilidades: [{ nombre: 'Node.js' }] };

        const result = await search('node js', 9, {
            topK: 3,
            profileContext,
            requestId: 'req-1',
        });

        expect(mocks.hybridSearch).toHaveBeenCalledWith(expect.objectContaining({
            query: 'node js',
            profileContext,
            semanticResults: ['doc-sem-1', 'doc-sem-2'],
            candidateId: 9,
            requestId: 'req-1',
        }));
        expect(result).toEqual(['doc-hybrid-1']);
        expect(mocks.recordQueryTelemetry).toHaveBeenCalledWith(expect.objectContaining({
            requestId: 'req-1',
            candidateId: 9,
            method: 'hybrid',
            hits: 1,
        }));
    });
});
