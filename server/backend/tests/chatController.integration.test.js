import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    classify: vi.fn(),
    getUserData: vi.fn(),
    generateResponse: vi.fn(),
    generateResponseStream: vi.fn(),
    semanticSearch: vi.fn(),
    initSSE: vi.fn(),
    hybridSearch: vi.fn(),
}));

vi.mock('../services/routerService.js', () => ({
    classify: mocks.classify,
}));

vi.mock('../services/dataService.js', () => ({
    getUserData: mocks.getUserData,
}));

vi.mock('../services/responseService.js', () => ({
    generateResponse: mocks.generateResponse,
    generateResponseStream: mocks.generateResponseStream,
}));

vi.mock('../services/embeddingService.js', () => ({
    search: mocks.semanticSearch,
}));

vi.mock('../modules/chat/StreamResponse.js', () => ({
    initSSE: mocks.initSSE,
}));

vi.mock('../services/HybridSearchService.js', () => ({
    HybridSearchService: vi.fn().mockImplementation(() => ({
        search: mocks.hybridSearch,
    })),
}));

import { ask, askStream } from '../controllers/chatController.js';

function createReq({ question = 'Cuéntame de tu experiencia' } = {}) {
    return {
        body: { question },
        user: { id: 11, nombre: 'Ada', apellido: 'Lovelace' },
        on: vi.fn(),
    };
}

function createRes() {
    return {
        json: vi.fn(),
        end: vi.fn(),
        headersSent: true,
    };
}

function createSSE() {
    return {
        requestId: 'req-stream-1',
        sendAck: vi.fn(),
        startHeartbeat: vi.fn(),
        sendStatus: vi.fn(),
        sendToken: vi.fn(),
        sendMetrics: vi.fn(),
        finish: vi.fn(),
        sendError: vi.fn(),
        stopHeartbeat: vi.fn(),
    };
}

describe('chatController integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.classify.mockResolvedValue({
            intent: 'cv_experience',
            needs_db: true,
            fields_required: ['experiencia_laboral'],
        });
        mocks.getUserData.mockResolvedValue({
            usuario: { id: 11, nombre: 'Ada', apellido: 'Lovelace' },
            experiencia_laboral: [{ puesto: 'Ingeniera', empresa: 'Analytical Engines' }],
        });
        mocks.semanticSearch.mockResolvedValue(['sem-1', 'sem-2']);
        mocks.hybridSearch.mockReturnValue({
            results: ['hyb-1'],
            method: 'hybrid',
        });
        mocks.generateResponse.mockResolvedValue('respuesta final');
        mocks.generateResponseStream.mockImplementation(async (_userName, _question, _userData, _embeddings, onToken) => {
            onToken('hola');
            onToken(' mundo');
        });
    });

    it('ask ejecuta flujo completo y responde payload with_data', async () => {
        const req = createReq();
        const res = createRes();
        const next = vi.fn();

        await ask(req, res, next);

        expect(mocks.classify).toHaveBeenCalledWith('Cuéntame de tu experiencia', 'Ada Lovelace');
        expect(mocks.getUserData).toHaveBeenCalledWith(11, ['experiencia_laboral']);
        expect(mocks.semanticSearch).toHaveBeenCalledWith('Cuéntame de tu experiencia', 11, 2);
        expect(mocks.generateResponse).toHaveBeenCalledWith(
            'Ada Lovelace',
            'Cuéntame de tu experiencia',
            expect.any(Object),
            ['hyb-1'],
        );
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            answer: 'respuesta final',
            userId: 11,
            routed: 'with_data',
            intent: 'cv_experience',
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('askStream ejecuta flujo SSE end-to-end y finaliza stream', async () => {
        const req = createReq();
        const res = createRes();
        const next = vi.fn();
        const sse = createSSE();

        mocks.initSSE.mockReturnValue(sse);

        await askStream(req, res, next);

        expect(mocks.initSSE).toHaveBeenCalledWith(res);
        expect(sse.sendAck).toHaveBeenCalled();
        expect(sse.startHeartbeat).toHaveBeenCalled();
        expect(sse.sendStatus).toHaveBeenCalledWith('thinking');
        expect(mocks.generateResponseStream).toHaveBeenCalledWith(
            'Ada Lovelace',
            'Cuéntame de tu experiencia',
            expect.any(Object),
            ['hyb-1'],
            expect.any(Function),
        );
        expect(sse.sendToken).toHaveBeenCalledWith('hola');
        expect(sse.sendToken).toHaveBeenCalledWith(' mundo');
        expect(sse.sendMetrics).toHaveBeenCalledWith(expect.objectContaining({
            routed: 'with_data',
            intent: 'cv_experience',
            usedEmbeddings: 1,
        }));
        expect(sse.finish).toHaveBeenCalledWith({ routed: 'with_data' });
        expect(next).not.toHaveBeenCalled();
    });
});
