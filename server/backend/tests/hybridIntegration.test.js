import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    hybridSearch: vi.fn(),
}));

vi.mock('../services/routerService.js', () => ({
    classify: vi.fn(),
}));

vi.mock('../services/dataService.js', () => ({
    getUserData: vi.fn(),
}));

vi.mock('../services/responseService.js', () => ({
    generateResponse: vi.fn(),
    generateResponseStream: vi.fn(),
}));

vi.mock('../services/embeddingService.js', () => ({
    search: vi.fn(),
}));

vi.mock('../modules/chat/StreamResponse.js', () => ({
    initSSE: vi.fn(),
}));

vi.mock('../services/HybridSearchService.js', () => ({
    HybridSearchService: vi.fn().mockImplementation(() => ({
        search: mocks.hybridSearch,
    })),
}));

import { enrichWithHybrid } from '../controllers/chatController.js';

describe('chatController.enrichWithHybrid', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('retorna semantic original cuando semanticHits está vacío', () => {
        const semanticHits = [];
        const result = enrichWithHybrid('node', semanticHits, { usuario: { id: 1 } }, 1, 'req-1');

        expect(result).toBe(semanticHits);
        expect(mocks.hybridSearch).not.toHaveBeenCalled();
    });

    it('retorna resultado híbrido cuando hay hits semánticos', () => {
        mocks.hybridSearch.mockReturnValue({
            results: ['hyb-a', 'hyb-b'],
        });

        const semanticHits = ['sem-a', 'sem-b'];
        const profileContext = { habilidades: [{ nombre: 'Node.js' }] };
        const result = enrichWithHybrid('node', semanticHits, profileContext, 44, 'req-2');

        expect(mocks.hybridSearch).toHaveBeenCalledWith(expect.objectContaining({
            query: 'node',
            profileContext,
            semanticResults: ['sem-a', 'sem-b'],
            candidateId: 44,
            requestId: 'req-2',
        }));
        expect(result).toEqual(['hyb-a', 'hyb-b']);
    });

    it('hace fallback a semantic cuando hybrid falla', () => {
        mocks.hybridSearch.mockImplementation(() => {
            throw new Error('hybrid failed');
        });

        const semanticHits = ['sem-x'];
        const result = enrichWithHybrid('node', semanticHits, { usuario: { id: 7 } }, 7, 'req-3');

        expect(result).toEqual(['sem-x']);
    });
});
