import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    getFullProfile: vi.fn(),
    extractProfileUpdates: vi.fn(),
    extractTextFromUpload: vi.fn(),
}));

vi.mock('../services/dataService.js', () => ({ getFullProfile: mocks.getFullProfile }));
vi.mock('../services/profileExtractionService.js', () => ({ extractProfileUpdates: mocks.extractProfileUpdates }));
vi.mock('../utils/fileTextExtractor.js', () => ({ extractTextFromUpload: mocks.extractTextFromUpload }));
vi.mock('../config/db.js', () => ({ pool: { query: vi.fn(), getConnection: vi.fn() } }));
vi.mock('../utils/logger.js', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { extractProfileFromCV } from '../controllers/profileImportController.js';

function createRes() {
    return { json: vi.fn() };
}

describe('profileImportController.extractProfileFromCV', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getFullProfile.mockResolvedValue({ usuario: {} });
        mocks.extractProfileUpdates.mockResolvedValue({ candidateFields: {}, sections: {} });
    });

    it('rechaza si el id del path no coincide con el usuario autenticado', async () => {
        const req = { params: { id: '2' }, user: { id: 1 }, body: {}, file: undefined };
        const res = createRes();
        const next = vi.fn();

        await extractProfileFromCV(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
        expect(mocks.extractProfileUpdates).not.toHaveBeenCalled();
    });

    it('extrae texto del archivo subido cuando hay req.file', async () => {
        mocks.extractTextFromUpload.mockResolvedValue('texto del pdf');
        const req = {
            params: { id: '1' },
            user: { id: 1 },
            body: {},
            file: { buffer: Buffer.from('x'), mimetype: 'application/pdf', originalname: 'cv.pdf' },
        };
        const res = createRes();
        const next = vi.fn();

        await extractProfileFromCV(req, res, next);

        expect(mocks.extractTextFromUpload).toHaveBeenCalledWith(req.file.buffer, 'application/pdf', 'cv.pdf');
        expect(mocks.extractProfileUpdates).toHaveBeenCalledWith(expect.objectContaining({
            sourceText: 'texto del pdf',
            mode: 'cv',
        }));
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        expect(next).not.toHaveBeenCalled();
    });

    it('usa cvText pegado cuando no hay archivo', async () => {
        const req = { params: { id: '1' }, user: { id: 1 }, body: { cvText: '  texto pegado  ' }, file: undefined };
        const res = createRes();
        const next = vi.fn();

        await extractProfileFromCV(req, res, next);

        expect(mocks.extractTextFromUpload).not.toHaveBeenCalled();
        expect(mocks.extractProfileUpdates).toHaveBeenCalledWith(expect.objectContaining({ sourceText: 'texto pegado' }));
    });

    it('lanza ValidationError si no hay archivo ni texto', async () => {
        const req = { params: { id: '1' }, user: { id: 1 }, body: {}, file: undefined };
        const res = createRes();
        const next = vi.fn();

        await extractProfileFromCV(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
        expect(mocks.extractProfileUpdates).not.toHaveBeenCalled();
    });

    it('nunca escribe en la base de datos (solo extrae y propone)', async () => {
        const { pool } = await import('../config/db.js');
        const req = { params: { id: '1' }, user: { id: 1 }, body: { cvText: 'algo' }, file: undefined };
        const res = createRes();
        const next = vi.fn();

        await extractProfileFromCV(req, res, next);

        expect(pool.query).not.toHaveBeenCalled();
        expect(pool.getConnection).not.toHaveBeenCalled();
    });
});
