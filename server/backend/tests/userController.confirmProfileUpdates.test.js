import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    connQuery: vi.fn(),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
    indexUserData: vi.fn(),
}));

vi.mock('../config/db.js', () => ({
    pool: {
        query: mocks.query,
        getConnection: vi.fn().mockResolvedValue({
            query: mocks.connQuery,
            beginTransaction: mocks.beginTransaction,
            commit: mocks.commit,
            rollback: mocks.rollback,
            release: mocks.release,
        }),
    },
}));

vi.mock('../services/embeddingService.js', () => ({ indexUserData: mocks.indexUserData }));
vi.mock('../services/dataService.js', () => ({ getFullProfile: vi.fn().mockResolvedValue({ usuario: {} }) }));
vi.mock('../modules/candidate/CandidateContextSnapshotService.js', () => ({
    CandidateContextSnapshotService: class { upsertSnapshot() { return Promise.resolve(); } },
}));
vi.mock('../utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { confirmProfileUpdates } from '../controllers/userController.js';

function createRes() {
    return { json: vi.fn() };
}

describe('userController.confirmProfileUpdates', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.indexUserData.mockResolvedValue(true);
        mocks.connQuery.mockResolvedValue([[{ id: 5, empresa: 'Acme', puesto: 'Dev' }]]);
    });

    it('rechaza acceso a un userId distinto del autenticado', async () => {
        const req = { params: { id: '2' }, user: { id: 1 }, body: {} };
        const res = createRes();
        const next = vi.fn();

        await confirmProfileUpdates(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('basicFields solo no toca ninguna tabla de sección', async () => {
        const req = {
            params: { id: '1' },
            user: { id: 1 },
            body: { basicFields: { puestoActual: 'Analista Senior' } },
        };
        const res = createRes();
        const next = vi.fn();

        await confirmProfileUpdates(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(mocks.connQuery).toHaveBeenCalledTimes(1);
        expect(mocks.connQuery).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE usuarios SET puesto_actual = ?'),
            ['Analista Senior', 1],
        );
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, basicFieldsUpdated: true, sections: [] }));
    });

    it('sections create reusa buildCreateSectionData y hace INSERT', async () => {
        const req = {
            params: { id: '1' },
            user: { id: 1 },
            body: { sections: [{ sectionKey: 'habilidades', action: 'create', payload: { nombre: 'Python' } }] },
        };
        const res = createRes();
        const next = vi.fn();

        await confirmProfileUpdates(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(mocks.connQuery).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO habilidades'),
            [1, 'python', null, null],
        );
        expect(mocks.commit).toHaveBeenCalledTimes(1);
    });

    it('sections update busca el item existente y hace UPDATE', async () => {
        mocks.connQuery.mockResolvedValueOnce([[{ id: 5, empresa: 'Acme', puesto: 'Dev', descripcion: null, fecha_inicio: null, fecha_fin: null, actualmente: 0 }]]);
        const req = {
            params: { id: '1' },
            user: { id: 1 },
            body: { sections: [{ sectionKey: 'experiencia_laboral', action: 'update', itemId: 5, payload: { puesto: 'Lead Dev' } }] },
        };
        const res = createRes();
        const next = vi.fn();

        await confirmProfileUpdates(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(mocks.connQuery).toHaveBeenCalledWith(expect.stringContaining('UPDATE experiencia_laboral SET'), expect.any(Array));
    });

    it('dispara reindexado (indexUserData) exactamente una vez tras confirmar', async () => {
        const req = {
            params: { id: '1' },
            user: { id: 1 },
            body: { sections: [{ sectionKey: 'habilidades', action: 'create', payload: { nombre: 'SQL' } }] },
        };
        const res = createRes();
        const next = vi.fn();

        await confirmProfileUpdates(req, res, next);
        await new Promise((resolve) => setImmediate(resolve));

        expect(mocks.indexUserData).toHaveBeenCalledTimes(1);
        expect(mocks.indexUserData).toHaveBeenCalledWith(1);
    });

    it('hace rollback si una sección falla', async () => {
        const req = {
            params: { id: '1' },
            user: { id: 1 },
            body: { sections: [{ sectionKey: 'invalido', action: 'create', payload: {} }] },
        };
        const res = createRes();
        const next = vi.fn();

        await confirmProfileUpdates(req, res, next);

        expect(mocks.rollback).toHaveBeenCalledTimes(1);
        expect(mocks.commit).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
});
