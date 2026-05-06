import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/db.js', () => ({
    pool: {
        query: vi.fn(),
        getConnection: vi.fn(),
    },
}));

vi.mock('../services/embeddingService.js', () => ({
    indexUserData: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/dataService.js', () => ({
    getFullProfile: vi.fn(),
}));

vi.mock('../modules/candidate/CandidateContextSnapshotService.js', () => ({
    CandidateContextSnapshotService: class {
        upsertSnapshot() {
            return Promise.resolve();
        }
    },
}));

vi.mock('../utils/logger.js', () => ({
    default: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

import { ValidationError } from '../middlewares/errorHandler.js';
import { __testables } from '../controllers/userController.js';

const { normalizeNullableDate, buildUpdateSectionData } = __testables;

describe('userController section date normalization', () => {
    it('acepta Date en current para update parcial y lo serializa como YYYY-MM-DD', () => {
        const current = {
            empresa: 'Acme',
            puesto: 'Backend Engineer',
            descripcion: 'Trabajo actual',
            fecha_inicio: new Date(2024, 0, 15),
            fecha_fin: new Date(2025, 3, 20),
            actualmente: 0,
        };

        const payload = {
            descripcion: 'Actualizado',
        };

        const data = buildUpdateSectionData('experiencia_laboral', payload, current);

        expect(data.descripcion).toBe('Actualizado');
        expect(data.fecha_inicio).toBe('2024-01-15');
        expect(data.fecha_fin).toBe('2025-04-20');
    });

    it('rechaza string de fecha invalido', () => {
        expect(() => normalizeNullableDate('2026-13-40', 'fecha_inicio')).toThrow(ValidationError);
        expect(() => normalizeNullableDate('2026-13-40', 'fecha_inicio')).toThrow(/YYYY-MM-DD/);
    });
});
