import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/metricsService.js', () => ({
    getMetricsOverview: vi.fn(),
}));

import { getOverview } from '../controllers/metricsController.js';
import { getMetricsOverview } from '../services/metricsService.js';

function createRes() {
    return {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    };
}

describe('metricsController.getOverview', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('usa 24h por defecto y devuelve shape estable', async () => {
        getMetricsOverview.mockResolvedValue({
            ttft: { p50: 100, p95: 220 },
            embeddingQueries: {
                total: 10,
                avgDurationMs: 58,
                p95DurationMs: 120,
                avgHits: 1.3,
                byMethod: { semantic: 7, hybrid: 2, bm25: 1, other: 0 },
            },
            jobs: { pending: 1, running: 0, done: 4, error: 0 },
            cache: { hitRate: null, totalHits: null, totalMisses: null, note: 'cache telemetry pending' },
            period: { hours: 24, window: 'last_hours', generatedAt: '2026-01-01T00:00:00.000Z' },
        });

        const req = { query: {} };
        const res = createRes();
        const next = vi.fn();

        await getOverview(req, res, next);

        expect(getMetricsOverview).toHaveBeenCalledWith({ hours: 24 });
        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledTimes(1);

        const payload = res.json.mock.calls[0][0];
        expect(payload).toHaveProperty('ttft');
        expect(payload).toHaveProperty('embeddingQueries');
        expect(payload).toHaveProperty('jobs');
        expect(payload).toHaveProperty('cache');
        expect(payload).toHaveProperty('period');
        expect(next).not.toHaveBeenCalled();
    });

    it('rechaza hours fuera de rango', async () => {
        const req = { query: { hours: '169' } };
        const res = createRes();
        const next = vi.fn();

        await getOverview(req, res, next);

        expect(getMetricsOverview).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            error: 'Parámetro inválido',
        }));
        expect(next).not.toHaveBeenCalled();
    });
});
