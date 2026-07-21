import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    generateStream: vi.fn(),
    extractProfileUpdates: vi.fn(),
    getFullProfile: vi.fn(),
    memoryGet: vi.fn(),
    memoryAddTurn: vi.fn(),
}));

vi.mock('../ai/index.js', () => ({ default: { generateStream: mocks.generateStream } }));
vi.mock('../services/profileExtractionService.js', () => ({ extractProfileUpdates: mocks.extractProfileUpdates }));
vi.mock('../services/dataService.js', () => ({ getFullProfile: mocks.getFullProfile }));
vi.mock('../modules/memory/ConversationMemoryService.js', () => ({
    ConversationMemoryService: class {
        get(...args) { return mocks.memoryGet(...args); }
        addTurn(...args) { return mocks.memoryAddTurn(...args); }
    },
}));
vi.mock('../utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { ProfileFillOrchestrator } from '../modules/chat/ProfileFillOrchestrator.js';

describe('ProfileFillOrchestrator', () => {
    let orchestrator;

    beforeEach(() => {
        vi.clearAllMocks();
        orchestrator = new ProfileFillOrchestrator();
        mocks.memoryGet.mockResolvedValue({ summary: '', messages: [] });
        mocks.memoryAddTurn.mockResolvedValue(true);
        mocks.getFullProfile.mockResolvedValue({ usuario: {} });
        mocks.extractProfileUpdates.mockResolvedValue({ candidateFields: {}, sections: {} });
        mocks.generateStream.mockImplementation(async (_prompt, _options, onChunk) => {
            onChunk('Hola ');
            onChunk('¿en qué empresa trabajaste?');
            return 'Hola ¿en qué empresa trabajaste?';
        });
    });

    it('usa la sessionKey session:{userId}:candidate:{userId} (misma fórmula que ChatOrchestrator)', async () => {
        expect(orchestrator.getSessionKey(42)).toBe('session:42:candidate:42');
    });

    it('transmite tokens via onToken y devuelve la propuesta extraída en paralelo', async () => {
        mocks.extractProfileUpdates.mockResolvedValue({
            candidateFields: {},
            sections: { habilidades: [{ nombre: 'python' }], experiencia_laboral: [], educacion: [], cursos: [], proyectos: [], idiomas: [] },
        });

        const tokens = [];
        const result = await orchestrator.askStream({
            userId: 1,
            message: 'Trabajé en Acme como analista',
            onToken: (t) => tokens.push(t),
        });

        expect(tokens.join('')).toBe('Hola ¿en qué empresa trabajaste?');
        expect(result.reply).toBe('Hola ¿en qué empresa trabajaste?');
        expect(result.proposedUpdate.sections.habilidades).toEqual([{ nombre: 'python' }]);
        expect(mocks.extractProfileUpdates).toHaveBeenCalledWith(expect.objectContaining({
            sourceText: 'Trabajé en Acme como analista',
            mode: 'chat',
        }));
    });

    it('persiste ambos turnos (user + assistant) en memoria tras responder', async () => {
        await orchestrator.askStream({ userId: 7, message: 'hola', onToken: () => {} });
        await new Promise((resolve) => setImmediate(resolve));

        expect(mocks.memoryAddTurn).toHaveBeenCalledWith(expect.objectContaining({
            sessionKey: 'session:7:candidate:7', candidateId: 7, requesterId: 7, role: 'user', content: 'hola',
        }));
        expect(mocks.memoryAddTurn).toHaveBeenCalledWith(expect.objectContaining({
            sessionKey: 'session:7:candidate:7', candidateId: 7, requesterId: 7, role: 'assistant',
        }));
    });
});
