import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/db.js', () => ({
    pool: {
        query: vi.fn(),
    },
}));

import { pool } from '../config/db.js';
import { NotFoundError } from '../middlewares/errorHandler.js';
import { CandidateAggregateService } from '../modules/candidate/CandidateAggregateService.js';

function buildRow(overrides = {}) {
    return {
        id: 1,
        nombre: 'Ana',
        apellido: 'Owner',
        email: 'ana@example.com',
        telefono: null,
        nacionalidad: null,
        direccion: null,
        resumen: null,
        puesto_actual: null,
        objetivo_profesional: null,
        disponibilidad: null,
        modalidad_preferida: null,
        pretension_salarial: null,
        linkedin_url: null,
        github_url: null,
        portfolio_url: null,
        is_public: 0,
        sobre_mi_descripcion: null,
        experiencia_laboral: '[]',
        educacion: '[]',
        cursos: '[]',
        proyectos: '[]',
        habilidades: '[]',
        idiomas: '[]',
        respuestas_entrevista: '[]',
        snapshot_json: null,
        compiled_context: '',
        snapshot_updated_at: null,
        ...overrides,
    };
}

describe('CandidateAggregateService access policy', () => {
    const service = new CandidateAggregateService();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('permite owner con perfil no publico', async () => {
        pool.query.mockResolvedValueOnce([[buildRow({ id: 1, is_public: 0 })]]);

        const result = await service.getAccessibleCandidateAggregate(1, 1);

        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(pool.query.mock.calls[0][1]).toEqual([1, 1, 1]);
        expect(result.candidateId).toBe(1);
        expect(result.profile.usuario.is_public).toBe(0);
    });

    it('deniega tercero con perfil no publico', async () => {
        pool.query.mockResolvedValueOnce([[]]);

        await expect(service.getAccessibleCandidateAggregate(1, 2)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('permite perfil publico para terceros', async () => {
        pool.query.mockResolvedValueOnce([[buildRow({ id: 3, is_public: 1 })]]);

        const result = await service.getAccessibleCandidateAggregate(3, 999);

        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(pool.query.mock.calls[0][1]).toEqual([3, 999, 999]);
        expect(result.candidateId).toBe(3);
        expect(result.profile.usuario.is_public).toBe(1);
    });
});
