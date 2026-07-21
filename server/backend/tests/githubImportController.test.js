import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    getFullProfile: vi.fn(),
    buildGithubImportProposal: vi.fn(),
}));

vi.mock('../services/dataService.js', () => ({ getFullProfile: mocks.getFullProfile }));
vi.mock('../services/githubImportService.js', () => ({ buildGithubImportProposal: mocks.buildGithubImportProposal }));
vi.mock('../config/db.js', () => ({ pool: { query: vi.fn(), getConnection: vi.fn() } }));
vi.mock('../utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { importFromGithub } from '../controllers/githubImportController.js';

function createRes() {
    return { json: vi.fn() };
}

describe('githubImportController.importFromGithub', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getFullProfile.mockResolvedValue({ usuario: {} });
        mocks.buildGithubImportProposal.mockResolvedValue({ candidateFields: {}, sections: {} });
    });

    it('rechaza si el id del path no coincide con el usuario autenticado', async () => {
        const req = { params: { id: '2' }, user: { id: 1 }, body: { username: 'x' } };
        const res = createRes();
        const next = vi.fn();

        await importFromGithub(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        expect(mocks.buildGithubImportProposal).not.toHaveBeenCalled();
    });

    it('lanza ValidationError si no viene username', async () => {
        const req = { params: { id: '1' }, user: { id: 1 }, body: {} };
        const res = createRes();
        const next = vi.fn();

        await importFromGithub(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
        expect(mocks.buildGithubImportProposal).not.toHaveBeenCalled();
    });

    it('pasa el perfil existente al servicio y devuelve la propuesta', async () => {
        mocks.getFullProfile.mockResolvedValue({ sobre_mi: [] });
        mocks.buildGithubImportProposal.mockResolvedValue({
            candidateFields: { githubUrl: 'https://github.com/devana' },
            sections: { proyectos: [], habilidades: [] },
        });
        const req = { params: { id: '1' }, user: { id: 1 }, body: { username: 'devana' } };
        const res = createRes();
        const next = vi.fn();

        await importFromGithub(req, res, next);

        expect(mocks.buildGithubImportProposal).toHaveBeenCalledWith({
            username: 'devana',
            existingProfile: { sobre_mi: [] },
        });
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            proposal: {
                candidateFields: { githubUrl: 'https://github.com/devana' },
                sections: { proyectos: [], habilidades: [] },
            },
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('nunca escribe en la base de datos (solo consulta y propone)', async () => {
        const { pool } = await import('../config/db.js');
        const req = { params: { id: '1' }, user: { id: 1 }, body: { username: 'devana' } };
        const res = createRes();
        const next = vi.fn();

        await importFromGithub(req, res, next);

        expect(pool.query).not.toHaveBeenCalled();
        expect(pool.getConnection).not.toHaveBeenCalled();
    });
});
