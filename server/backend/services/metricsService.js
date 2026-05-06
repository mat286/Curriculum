import { pool } from '../config/db.js';
import metricsAggregator from '../config/metricsAggregator.js';

const DEFAULT_HOURS = 24;

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function buildEmptyByMethod() {
    return {
        semantic: 0,
        hybrid: 0,
        bm25: 0,
        other: 0,
    };
}

function buildEmptyJobs() {
    return {
        pending: 0,
        running: 0,
        done: 0,
        error: 0,
    };
}

async function safeQuery(sql, params = [], fallbackRows = []) {
    try {
        return await pool.query(sql, params);
    } catch (error) {
        if (error?.code === 'ER_NO_SUCH_TABLE') {
            return [fallbackRows, []];
        }
        throw error;
    }
}

async function getEmbeddingAggregate(hours) {
    const [rows] = await safeQuery(
        `SELECT
            COUNT(*) AS total,
            AVG(duration_ms) AS avgDurationMs,
            AVG(hit_count) AS avgHits
         FROM embedding_query_telemetry
         WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)`,
        [hours],
        [{ total: 0, avgDurationMs: 0, avgHits: 0 }],
    );

    return rows[0] || { total: 0, avgDurationMs: 0, avgHits: 0 };
}

async function getEmbeddingByMethod(hours) {
    const [rows] = await safeQuery(
        `SELECT method, COUNT(*) AS total
         FROM embedding_query_telemetry
         WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)
         GROUP BY method`,
        [hours],
        [],
    );

    const byMethod = buildEmptyByMethod();
    for (const row of rows) {
        const method = String(row.method || '').toLowerCase();
        const total = toFiniteNumber(row.total, 0);

        if (method === 'semantic' || method === 'hybrid' || method === 'bm25') {
            byMethod[method] = total;
        } else {
            byMethod.other += total;
        }
    }

    return byMethod;
}

async function getApproxDurationPercentiles(hours, totalRows) {
    if (totalRows <= 0) {
        return { p50DurationMs: 0, p95DurationMs: 0 };
    }

    const p50Offset = Math.max(0, Math.ceil(totalRows * 0.50) - 1);
    const p95Offset = Math.max(0, Math.ceil(totalRows * 0.95) - 1);

    const [[p50Rows], [p95Rows]] = await Promise.all([
        safeQuery(
            `SELECT duration_ms
             FROM embedding_query_telemetry
             WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)
             ORDER BY duration_ms
             LIMIT ?, 1`,
            [hours, p50Offset],
            [],
        ),
        safeQuery(
            `SELECT duration_ms
             FROM embedding_query_telemetry
             WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? HOUR)
             ORDER BY duration_ms
             LIMIT ?, 1`,
            [hours, p95Offset],
            [],
        ),
    ]);

    return {
        p50DurationMs: Math.round(toFiniteNumber(p50Rows[0]?.duration_ms, 0)),
        p95DurationMs: Math.round(toFiniteNumber(p95Rows[0]?.duration_ms, 0)),
    };
}

async function getJobsByStatus() {
    const [rows] = await safeQuery(
        `SELECT status, COUNT(*) AS total
         FROM embedding_index_jobs
         GROUP BY status`,
        [],
        [],
    );

    const jobs = buildEmptyJobs();
    for (const row of rows) {
        const status = String(row.status || '').toLowerCase();
        if (Object.hasOwn(jobs, status)) {
            jobs[status] = toFiniteNumber(row.total, 0);
        }
    }

    return jobs;
}

function getTtftFromInMemoryTelemetry() {
    const realtimeMetrics = metricsAggregator.getMetrics();
    const ttfbStats = realtimeMetrics?.stageLatencies?.ttfb || {};

    const p50 = toFiniteNumber(ttfbStats.p50Ms, 0);
    const p95 = toFiniteNumber(ttfbStats.p95Ms, 0);

    return {
        p50,
        p95,
        source: 'in-memory-telemetry',
    };
}

export async function getMetricsOverview({ hours = DEFAULT_HOURS } = {}) {
    const safeHours = Number.isInteger(hours) ? hours : DEFAULT_HOURS;

    const [embeddingAggregate, byMethod, jobs] = await Promise.all([
        getEmbeddingAggregate(safeHours),
        getEmbeddingByMethod(safeHours),
        getJobsByStatus(),
    ]);

    const total = toFiniteNumber(embeddingAggregate.total, 0);
    const { p50DurationMs, p95DurationMs } = await getApproxDurationPercentiles(safeHours, total);

    return {
        ttft: getTtftFromInMemoryTelemetry(),
        embeddingQueries: {
            total,
            avgDurationMs: Math.round(toFiniteNumber(embeddingAggregate.avgDurationMs, 0)),
            p50DurationMs,
            p95DurationMs,
            avgHits: Number(toFiniteNumber(embeddingAggregate.avgHits, 0).toFixed(2)),
            byMethod,
        },
        jobs,
        cache: {
            hitRate: null,
            totalHits: null,
            totalMisses: null,
            note: 'cache telemetry pending',
        },
        period: {
            hours: safeHours,
            window: 'last_hours',
            generatedAt: new Date().toISOString(),
        },
    };
}
