import metricsAggregator from '../config/metricsAggregator.js';
import { getMetricsOverview } from '../services/metricsService.js';

const OVERVIEW_HOURS = 24;

/**
 * GET /internal/chat/metrics
 * Métricas detalladas de chat para uso interno/operacional.
 * Requiere autenticación (autenticarUsuario aplicado en la ruta).
 */
export async function getChatMetrics(req, res, next) {
    try {
        const [snapshot, overview] = await Promise.all([
            Promise.resolve(metricsAggregator.getChatMetricsSnapshot()),
            getMetricsOverview({ hours: OVERVIEW_HOURS }),
        ]);

        const payload = {
            latency: snapshot.latency,
            ttfb: snapshot.ttfb,
            ttft: {
                p50Ms: overview.ttft.p50 ?? snapshot.ttft.p50Ms,
                p95Ms: overview.ttft.p95 ?? snapshot.ttft.p95Ms,
                source: overview.ttft.source ?? 'in-memory-telemetry',
            },
            promptSize: snapshot.promptSize,
            faqHitRatio: snapshot.faqHitRatio,
            semanticHitRatio: snapshot.semanticHitRatio,
            rankingEffectiveness: snapshot.rankingEffectiveness,
            tokensEstimated: snapshot.promptSize.avgTokensEstimated,
            embeddingQueries: {
                total: overview.embeddingQueries.total,
                avgDurationMs: overview.embeddingQueries.avgDurationMs,
                p50DurationMs: overview.embeddingQueries.p50DurationMs,
                p95DurationMs: overview.embeddingQueries.p95DurationMs,
                byMethod: overview.embeddingQueries.byMethod,
            },
            totalRequests: snapshot.totalRequests,
            period: {
                hours: OVERVIEW_HOURS,
                generatedAt: new Date().toISOString(),
            },
        };

        return res.json(payload);
    } catch (error) {
        return next(error);
    }
}
