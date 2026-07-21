import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../config/db.js', () => ({ pool: { query: mocks.query } }));
vi.mock('../modules/chat/ChatOrchestrator.js', () => ({ chatOrchestrator: { ask: vi.fn(), askStream: vi.fn() } }));
vi.mock('../modules/chat/ProfileFillOrchestrator.js', () => ({ profileFillOrchestrator: { askStream: vi.fn() } }));
vi.mock('../utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { listMyConversations } from '../controllers/candidateChatController.js';

function createRes() {
    return { json: vi.fn() };
}

describe('candidateChatController.listMyConversations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('excluye al propio requester de la lista y ordena por más reciente', async () => {
        mocks.query.mockResolvedValue([[
            {
                candidate_id: 3, nombre: 'Ana', apellido: 'Gómez', puesto_actual: 'Dev',
                profile_photo_url: null, updated_at: '2026-07-16T10:00:00Z',
                last_messages: JSON.stringify([{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'todo bien, gracias' }]),
            },
        ]]);

        const req = { user: { id: 1 } };
        const res = createRes();
        const next = vi.fn();

        await listMyConversations(req, res, next);

        expect(mocks.query).toHaveBeenCalledWith(
            expect.stringContaining('WHERE ccm.requester_id = ? AND ccm.candidate_id <> ?'),
            [1, 1],
        );
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            conversations: [expect.objectContaining({
                candidateId: 3,
                nombre: 'Ana',
                lastMessageSnippet: 'todo bien, gracias',
            })],
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('devuelve snippet vacío si last_messages viene vacío o corrupto', async () => {
        mocks.query.mockResolvedValue([[
            { candidate_id: 4, nombre: 'Beto', apellido: null, puesto_actual: null, profile_photo_url: null, updated_at: '2026-07-16T10:00:00Z', last_messages: 'no-es-json' },
        ]]);

        const req = { user: { id: 1 } };
        const res = createRes();
        const next = vi.fn();

        await listMyConversations(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            conversations: [expect.objectContaining({ candidateId: 4, lastMessageSnippet: '' })],
        });
    });

    it('delega errores de DB a next()', async () => {
        mocks.query.mockRejectedValue(new Error('DB caída'));
        const req = { user: { id: 1 } };
        const res = createRes();
        const next = vi.fn();

        await listMyConversations(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(Error));
        expect(res.json).not.toHaveBeenCalled();
    });
});
