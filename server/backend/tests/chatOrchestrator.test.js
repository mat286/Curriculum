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

function createOrchestrator({ include = ['usuario', 'habilidades'] } = {}) {
    const orchestrator = new ChatOrchestrator();

    orchestrator.normalizeService = {
        normalize: vi.fn((text) => text),
    };
    orchestrator.intentClassifier = {
        classify: vi.fn(() => ({ intent: 'general', confidence: 0.6 })),
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
    const pickFromProfileSpy = vi.fn(() => ({ usuario: { nombre: 'Ana' } }));
    orchestrator.contextSelector = {
        select: vi.fn(() => ({ include })),
        pickFromProfile: pickFromProfileSpy,
    };
    const buildPromptSpy = vi.fn(() => 'prompt listo');
    orchestrator.promptAssembler = {
        build: buildPromptSpy,
    };

    return { orchestrator, pickFromProfileSpy, buildPromptSpy };
}

describe('ChatOrchestrator (selección determinística por intención, sin RAG)', () => {
    it('propaga requesterId al aggregate service', async () => {
        const { orchestrator } = createOrchestrator();

        await orchestrator.prepareContext({ candidateId: 10, requesterId: 20, message: 'contame experiencia' });

        expect(orchestrator.aggregateService.getAccessibleCandidateAggregate).toHaveBeenCalledTimes(1);
        expect(orchestrator.aggregateService.getAccessibleCandidateAggregate).toHaveBeenCalledWith(10, 20);
    });

    it('llama pickFromProfile una sola vez (sin recompute redundante)', async () => {
        const { orchestrator, pickFromProfileSpy } = createOrchestrator();

        await orchestrator.prepareContext({ candidateId: 10, requesterId: 20, message: 'contame experiencia' });

        expect(pickFromProfileSpy).toHaveBeenCalledTimes(1);
    });

    it('arma el prompt sin semanticContext, usando el perfil seleccionado por intención', async () => {
        const { orchestrator, buildPromptSpy } = createOrchestrator({ include: ['experiencia_laboral'] });

        await orchestrator.prepareContext({ candidateId: 10, requesterId: 20, message: 'contame experiencia' });

        expect(buildPromptSpy).toHaveBeenCalledTimes(1);
        const args = buildPromptSpy.mock.calls[0][0];
        expect(args).not.toHaveProperty('semanticContext');
        expect(args.selectedSections).toEqual(['experiencia_laboral']);
    });

    it('invoca onStatus con un label basado en las secciones seleccionadas', async () => {
        const { orchestrator } = createOrchestrator({ include: ['experiencia_laboral', 'habilidades'] });
        const onStatus = vi.fn();

        await orchestrator.prepareContext({
            candidateId: 10,
            requesterId: 20,
            message: 'contame experiencia',
            onStatus,
        });

        expect(onStatus).toHaveBeenCalledTimes(1);
        expect(onStatus).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'retrieving',
                label: 'Buscando experiencias...',
                sections: ['experiencia_laboral', 'habilidades'],
            }),
        );
    });

    describe('getSessionKey (aislamiento de visitantes anónimos)', () => {
        it('usa requesterId cuando el visitante está logueado', () => {
            const { orchestrator } = createOrchestrator();
            const key = orchestrator.getSessionKey({ requesterId: 20, anonSessionId: 'anon-uuid-1', candidateId: 10 });
            expect(key).toBe('session:20:candidate:10');
        });

        it('usa anonSessionId cuando no hay requesterId, para no mezclar visitantes anónimos', () => {
            const { orchestrator } = createOrchestrator();
            const keyA = orchestrator.getSessionKey({ anonSessionId: 'anon-uuid-A', candidateId: 10 });
            const keyB = orchestrator.getSessionKey({ anonSessionId: 'anon-uuid-B', candidateId: 10 });
            expect(keyA).not.toBe(keyB);
            expect(keyA).toBe('session:anon-uuid-A:candidate:10');
        });

        it('cae a "anon" solo si tampoco hay anonSessionId', () => {
            const { orchestrator } = createOrchestrator();
            const key = orchestrator.getSessionKey({ candidateId: 10 });
            expect(key).toBe('session:anon:candidate:10');
        });
    });
});
