import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/metricsAggregator.js', () => ({
    default: {
        getChatMetricsSnapshot: vi.fn(),
    },
}));

vi.mock('../services/metricsService.js', () => ({
    getMetricsOverview: vi.fn(),
}));

import { getChatMetrics } from '../controllers/internalChatMetricsController.js';
import metricsAggregator from '../config/metricsAggregator.js';
import { getMetricsOverview } from '../services/metricsService.js';

const SNAPSHOT_FIXTURE = {
    latency: { avgMs: 350, p50Ms: 300, p95Ms: 800 },
    ttfb: { count: 10, p50Ms: 120, p95Ms: 400, avgMs: 180 },
    ttft: { count: 10, p50Ms: 120, p95Ms: 400, avgMs: 180 },
    promptSize: { avgChars: 800, p95Chars: 1400, avgTokensEstimated: 200 },
    faqHitRatio: { value: null, note: 'faqHit not yet instrumented in telemetry' },
    semanticHitRatio: { value: 72, unit: 'percent' },
    rankingEffectiveness: { value: null, note: 'requires labeled evaluation data — not yet instrumented' },
    totalRequests: 42,
};

const OVERVIEW_FIXTURE = {
    ttft: { p50: 115, p95: 390, source: 'in-memory-telemetry' },
    embeddingQueries: {
        total: 120,
        avgDurationMs: 58,
        p50DurationMs: 45,
        p95DurationMs: 130,
        byMethod: { semantic: 90, hybrid: 20, bm25: 10, other: 0 },
    },
    jobs: { pending: 0, running: 0, done: 5, error: 0 },
    cache: { hitRate: null },
    period: { hours: 24, window: 'last_hours', generatedAt: '2026-01-01T00:00:00.000Z' },
};

function createRes() {
    return {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
    };
}

describe('internalChatMetricsController.getChatMetrics', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        metricsAggregator.getChatMetricsSnapshot.mockReturnValue(SNAPSHOT_FIXTURE);
        getMetricsOverview.mockResolvedValue(OVERVIEW_FIXTURE);
    });

    it('responde 200 con shape completo', async () => {
        const req = {};
        const res = createRes();
        const next = vi.fn();

        await getChatMetrics(req, res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledTimes(1);
        expect(next).not.toHaveBeenCalled();

        const payload = res.json.mock.calls[0][0];

        // Campos obligatorios
        expect(payload).toHaveProperty('latency');
        expect(payload).toHaveProperty('ttfb');
        expect(payload).toHaveProperty('ttft');
        expect(payload).toHaveProperty('promptSize');
        expect(payload).toHaveProperty('faqHitRatio');
        expect(payload).toHaveProperty('semanticHitRatio');
        expect(payload).toHaveProperty('rankingEffectiveness');
        expect(payload).toHaveProperty('tokensEstimated');
        expect(payload).toHaveProperty('embeddingQueries');
        expect(payload).toHaveProperty('totalRequests');
        expect(payload).toHaveProperty('period');
    });

    it('latency expone avg, p50 y p95', async () => {
        const req = {};
        const res = createRes();
        const next = vi.fn();

        await getChatMetrics(req, res, next);

        const { latency } = res.json.mock.calls[0][0];
        expect(latency).toMatchObject({ avgMs: 350, p50Ms: 300, p95Ms: 800 });
    });

    it('rankingEffectiveness siempre retorna value: null + note', async () => {
        const req = {};
        const res = createRes();
        const next = vi.fn();

        await getChatMetrics(req, res, next);

        const { rankingEffectiveness } = res.json.mock.calls[0][0];
        expect(rankingEffectiveness.value).toBeNull();
        expect(rankingEffectiveness.note).toEqual(expect.any(String));
    });

    it('tokensEstimated es número', async () => {
        const req = {};
        const res = createRes();
        const next = vi.fn();

        await getChatMetrics(req, res, next);

        const { tokensEstimated } = res.json.mock.calls[0][0];
        expect(typeof tokensEstimated).toBe('number');
    });

    it('faqHitRatio expone null con note cuando no hay datos', async () => {
        const req = {};
        const res = createRes();
        const next = vi.fn();

        await getChatMetrics(req, res, next);

        const { faqHitRatio } = res.json.mock.calls[0][0];
        expect(faqHitRatio.value).toBeNull();
        expect(faqHitRatio).toHaveProperty('note');
    });

    it('propaga errores al siguiente middleware', async () => {
        getMetricsOverview.mockRejectedValue(new Error('DB unavailable'));

        const req = {};
        const res = createRes();
        const next = vi.fn();

        await getChatMetrics(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'DB unavailable' }));
        expect(res.json).not.toHaveBeenCalled();
    });

    it('ttft usa datos de overview cuando están disponibles', async () => {
        const req = {};
        const res = createRes();
        const next = vi.fn();

        await getChatMetrics(req, res, next);

        const { ttft } = res.json.mock.calls[0][0];
        expect(ttft.p50Ms).toBe(115);
        expect(ttft.p95Ms).toBe(390);
    });

    it('embeddingQueries incluye byMethod', async () => {
        const req = {};
        const res = createRes();
        const next = vi.fn();

        await getChatMetrics(req, res, next);

        const { embeddingQueries } = res.json.mock.calls[0][0];
        expect(embeddingQueries.byMethod).toMatchObject({ semantic: 90, hybrid: 20, bm25: 10 });
    });
});
