import { describe, it, expect, vi } from 'vitest';

vi.mock('../services/ollamaService.js', () => ({
    getEmbedding: vi.fn(async () => [0.1, 0.2, 0.3]),
}));

vi.mock('../modules/llm/DefaultLLMProvider.js', () => ({
    DefaultLLMProvider: class {
        async generate() {
            return 'ok';
        }

        async generateStream(_prompt, _options, onToken) {
            onToken?.('ok');
        }
    },
}));

import { ChatOrchestrator } from '../modules/chat/ChatOrchestrator.js';

function createOrchestratorForTopK(confidence) {
    const orchestrator = new ChatOrchestrator();

    orchestrator.normalizeService = {
        normalize: vi.fn((text) => text),
    };
    orchestrator.intentClassifier = {
        classify: vi.fn(() => ({ intent: 'general', confidence })),
    };
    orchestrator.aggregateService = {
        getAccessibleCandidateAggregate: vi.fn(async () => ({
            candidateName: 'Ana Test',
            profile: { usuario: { nombre: 'Ana' } },
            snapshot: { json: { usuario: { nombre: 'Ana' } }, context: '', updatedAt: null },
        })),
    };
    orchestrator.cache = {
        getGreeting: vi.fn(() => null),
        buildKey: vi.fn(() => 'cache-key'),
        getResponse: vi.fn(() => null),
        setResponse: vi.fn(),
    };
    orchestrator.faqRetriever = {
        findBestMatch: vi.fn(async () => ({ hit: false, similarity: 0 })),
    };
    orchestrator.memory = {
        get: vi.fn(async () => ({ summary: '', messages: [] })),
    };
    orchestrator.contextSelector = {
        select: vi.fn(() => ({ include: ['usuario', 'habilidades'] })),
        pickFromProfile: vi.fn(() => ({ usuario: { nombre: 'Ana' } })),
    };

    const retrieveSpy = vi.fn(async () => ({
        chunks: ['chunk 1'],
        reason: 'ok',
        durationMs: 1,
        chunkStats: { beforeDedupe: 1, afterDedupe: 1 },
    }));

    orchestrator.semantic = { retrieve: retrieveSpy };
    orchestrator.promptAssembler = {
        build: vi.fn(() => 'prompt listo'),
    };

    return { orchestrator, retrieveSpy };
}

describe('ChatOrchestrator dynamic top-k policy', () => {
    it('propaga requesterId al aggregate service', async () => {
        const { orchestrator } = createOrchestratorForTopK(0.81);

        await orchestrator.prepareContext({ candidateId: 10, requesterId: 20, message: 'contame experiencia' });

        expect(orchestrator.aggregateService.getAccessibleCandidateAggregate).toHaveBeenCalledTimes(1);
        expect(orchestrator.aggregateService.getAccessibleCandidateAggregate).toHaveBeenCalledWith(10, 20);
    });

    it('usa top-k=3 con confidence media-alta (0.8)', async () => {
        const { orchestrator, retrieveSpy } = createOrchestratorForTopK(0.81);

        await orchestrator.prepareContext({ candidateId: 10, requesterId: 20, message: 'contame experiencia' });

        expect(retrieveSpy).toHaveBeenCalledTimes(1);
        expect(retrieveSpy.mock.calls[0][0].topK).toBe(3);
    });

    it('usa top-k=4 con confidence entre 0.5 y 0.79', async () => {
        const { orchestrator, retrieveSpy } = createOrchestratorForTopK(0.65);

        await orchestrator.prepareContext({ candidateId: 10, requesterId: 20, message: 'contame educación' });

        expect(retrieveSpy).toHaveBeenCalledTimes(1);
        expect(retrieveSpy.mock.calls[0][0].topK).toBe(4);
    });

    it('usa top-k=5 con confidence < 0.5', async () => {
        const { orchestrator, retrieveSpy } = createOrchestratorForTopK(0.3);

        await orchestrator.prepareContext({ candidateId: 10, requesterId: 20, message: 'tema ambiguo' });

        expect(retrieveSpy).toHaveBeenCalledTimes(1);
        expect(retrieveSpy.mock.calls[0][0].topK).toBe(5);
    });

    it('aplica override por env cuando está presente', async () => {
        const previous = process.env.SEMANTIC_TOPK_OVERRIDE;
        process.env.SEMANTIC_TOPK_OVERRIDE = '9';

        try {
            const { orchestrator, retrieveSpy } = createOrchestratorForTopK(0.9);
            await orchestrator.prepareContext({ candidateId: 10, requesterId: 20, message: 'otro mensaje' });

            expect(retrieveSpy).toHaveBeenCalledTimes(1);
            expect(retrieveSpy.mock.calls[0][0].topK).toBe(9);
        } finally {
            if (previous === undefined) delete process.env.SEMANTIC_TOPK_OVERRIDE;
            else process.env.SEMANTIC_TOPK_OVERRIDE = previous;
        }
    });
});