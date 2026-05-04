import logger from '../../utils/logger.js';

export class MetricsAggregatorService {
    constructor() {
        this.startTime = Date.now();
        this.records = []; // Array de objetos con timestamp
        this.maxRecords = 1000;
    }

    /**
     * Registra datos de telemetría desde ChatTelemetry.flush()
     * @param {Object} telemetryObject - { scope, totalMs, marks, candidateId, requesterId, route, intent, confidence, cacheHit, similarity, ... }
     */
    recordTelemetry(telemetryObject) {
        try {
            const record = {
                timestamp: Date.now(),
                ...telemetryObject,
            };
            this.records.push(record);

            // Mantener solo los últimos N registros
            if (this.records.length > this.maxRecords) {
                this.records.shift();
            }
        } catch (error) {
            logger.error({ err: error, telemetryObject }, 'Error registrando telemetría');
        }
    }

    /**
     * Calcula percentil de un array de números
     * @private
     */
    _percentile(arr, p) {
        if (!arr || arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const index = Math.ceil(sorted.length * p) - 1;
        return sorted[Math.max(0, index)] || 0;
    }

    /**
     * Retorna métricas agregadas en tiempo real
     * @returns {Object}
     */
    getMetrics() {
        const now = Date.now();
        const uptime = now - this.startTime;

        if (this.records.length === 0) {
            return {
                uptime,
                totalRequests: 0,
                avgLatencyMs: 0,
                p95LatencyMs: 0,
                p99LatencyMs: 0,
                errorRate: 0,
                routes: {},
                avgCacheHitRate: 0,
                topIntents: {},
                lastHour: { requests: 0, avgLatencyMs: 0 },
                lastMinute: { requests: 0, errors: 0 },
            };
        }

        const oneHourAgo = now - 3600000;
        const oneMinuteAgo = now - 60000;

        // Filtrar registros por tiempo
        const recordsLastHour = this.records.filter(r => r.timestamp >= oneHourAgo);
        const recordsLastMinute = this.records.filter(r => r.timestamp >= oneMinuteAgo);

        // Latencias
        const latencies = this.records
            .filter(r => typeof r.totalMs === 'number' && r.totalMs >= 0)
            .map(r => r.totalMs);
        const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length
            : 0;
        const p95Latency = this._percentile(latencies, 0.95);
        const p99Latency = this._percentile(latencies, 0.99);

        // Routes
        const routesCounts = {};
        this.records.forEach(r => {
            if (r.route) {
                routesCounts[r.route] = (routesCounts[r.route] || 0) + 1;
            }
        });

        // Cache hit rate
        const cacheableRecords = this.records.filter(r => typeof r.cacheHit === 'boolean');
        const cacheHits = cacheableRecords.filter(r => r.cacheHit).length;
        const avgCacheHitRate = cacheableRecords.length > 0
            ? Math.round((cacheHits / cacheableRecords.length) * 100)
            : 0;

        // Top intents
        const intentCounts = {};
        this.records.forEach(r => {
            if (r.intent) {
                intentCounts[r.intent] = (intentCounts[r.intent] || 0) + 1;
            }
        });
        const topIntents = Object.entries(intentCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .reduce((obj, [intent, count]) => {
                obj[intent] = count;
                return obj;
            }, {});

        // Error rate (detectar por scope con 'error' o por totalMs > threshold)
        const errorRecords = this.records.filter(r =>
            (r.scope && r.scope.includes('error')) ||
            (r.error === true)
        );
        const errorRate = this.records.length > 0
            ? Math.round((errorRecords.length / this.records.length) * 100)
            : 0;

        // Last hour stats
        const lastHourLatencies = recordsLastHour
            .filter(r => typeof r.totalMs === 'number' && r.totalMs >= 0)
            .map(r => r.totalMs);
        const lastHourAvgLatency = lastHourLatencies.length > 0
            ? Math.round(lastHourLatencies.reduce((a, b) => a + b, 0) / lastHourLatencies.length)
            : 0;

        // Last minute stats
        const lastMinuteErrors = recordsLastMinute.filter(r =>
            (r.scope && r.scope.includes('error')) ||
            (r.error === true)
        ).length;

        return {
            uptime,
            totalRequests: this.records.length,
            avgLatencyMs: Math.round(avgLatency),
            p95LatencyMs: Math.round(p95Latency),
            p99LatencyMs: Math.round(p99Latency),
            errorRate,
            routes: routesCounts,
            avgCacheHitRate,
            topIntents,
            lastHour: {
                requests: recordsLastHour.length,
                avgLatencyMs: lastHourAvgLatency,
            },
            lastMinute: {
                requests: recordsLastMinute.length,
                errors: lastMinuteErrors,
            },
        };
    }

    /**
     * Limpia todos los registros de telemetría
     */
    reset() {
        this.records = [];
        this.startTime = Date.now();
        logger.info('Métricas de telemetría reseteadas');
    }

    /**
     * Retorna el número de registros almacenados
     */
    getRecordCount() {
        return this.records.length;
    }

    /**
     * Retorna registros sin procesar (útil para debugging)
     */
    getRawRecords(limit = 100) {
        return this.records.slice(-limit);
    }
}
