/**
 * chatController.integration.test.js
 *
 * Actualizado en refactor 2026-06: chatController ahora delega al chatOrchestrator.
 * Este test mockea chatOrchestrator directamente en lugar del pipeline anterior
 * (dataService + responseService + embeddingService + HybridSearchService).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    orchestratorAsk: vi.fn(),
    orchestratorAskStream: vi.fn(),
    initSSE: vi.fn(),
}));

vi.mock('../modules/chat/ChatOrchestrator.js', () => ({
    chatOrchestrator: {
        ask: mocks.orchestratorAsk,
        askStream: mocks.orchestratorAskStream,
    },
}));

vi.mock('../modules/chat/StreamResponse.js', () => ({
    initSSE: mocks.initSSE,
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
    });

    it('ask delega al chatOrchestrator con candidateId=requesterId=userId', async () => {
        mocks.orchestratorAsk.mockResolvedValue({
            answer: 'respuesta final',
            routed: 'with_data',
            cached: false,
        });
        const req = createReq();
        const res = createRes();
        const next = vi.fn();

        await ask(req, res, next);

        expect(mocks.orchestratorAsk).toHaveBeenCalledWith(
            expect.objectContaining({
                candidateId: 11,
                requesterId: 11,
                message: 'Cuéntame de tu experiencia',
            }),
        );
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            answer: 'respuesta final',
            userId: 11,
            routed: 'with_data',
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('ask retorna error via next() si el orchestrator falla', async () => {
        mocks.orchestratorAsk.mockRejectedValue(new Error('LLM timeout'));
        const req = createReq();
        const res = createRes();
        const next = vi.fn();

        await ask(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(res.json).not.toHaveBeenCalled();
    });

    it('ask lanza ValidationError para pregunta vacía', async () => {
        const req = createReq({ question: '' });
        const res = createRes();
        const next = vi.fn();

        await ask(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringMatching(/vacía/),
        }));
        expect(mocks.orchestratorAsk).not.toHaveBeenCalled();
    });

    it('askStream delega al orchestrator y transmite tokens via SSE', async () => {
        const sse = createSSE();
        mocks.initSSE.mockReturnValue(sse);
        mocks.orchestratorAskStream.mockImplementation(async ({ onToken }) => {
            onToken('hola');
            onToken(' mundo');
            return { routed: 'with_data', metrics: { ttfbMs: 100, totalMs: 500 } };
        });

        const req = createReq();
        const res = createRes();
        const next = vi.fn();

        await askStream(req, res, next);

        expect(sse.sendAck).toHaveBeenCalled();
        expect(sse.startHeartbeat).toHaveBeenCalled();
        expect(sse.sendToken).toHaveBeenCalledWith('hola');
        expect(sse.sendToken).toHaveBeenCalledWith(' mundo');
        expect(sse.finish).toHaveBeenCalledWith({ routed: 'with_data' });
        expect(next).not.toHaveBeenCalled();
    });
});
