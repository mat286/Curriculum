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
     * Retorna estadisticas basicas de un arreglo numerico
     * @private
     */
    _buildStats(values) {
        if (!values || values.length === 0) {
            return {
                count: 0,
                p50Ms: 0,
                p95Ms: 0,
                avgMs: 0,
            };
        }

        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return {
            count: values.length,
            p50Ms: Math.round(this._percentile(values, 0.5)),
            p95Ms: Math.round(this._percentile(values, 0.95)),
            avgMs: Math.round(avg),
        };
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
                stageLatencies: {
                    ttfb: { count: 0, p50Ms: 0, p95Ms: 0, avgMs: 0 },
                    semantic: { count: 0, p50Ms: 0, p95Ms: 0, avgMs: 0 },
                    prompt: { count: 0, p50Ms: 0, p95Ms: 0, avgMs: 0 },
                },
                promptStats: {
                    count: 0,
                    avgChars: 0,
                    p95Chars: 0,
                },
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

        const ttfbLatencies = this.records
            .map(r => r?.marks?.ttfb?.ttfbMs ?? r?.marks?.ttfb?.ms)
            .filter(v => typeof v === 'number' && v >= 0);

        const semanticLatencies = this.records
            .map(r => r?.marks?.semantic?.semanticMs ?? r?.marks?.semantic?.ms)
            .filter(v => typeof v === 'number' && v >= 0);

        const promptLatencies = this.records
            .map(r => r?.marks?.prompt?.ms)
            .filter(v => typeof v === 'number' && v >= 0);

        const promptChars = this.records
            .map(r => r?.marks?.prompt?.promptChars)
            .filter(v => typeof v === 'number' && v >= 0);

        const promptAvgChars = promptChars.length > 0
            ? Math.round(promptChars.reduce((a, b) => a + b, 0) / promptChars.length)
            : 0;

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
            stageLatencies: {
                ttfb: this._buildStats(ttfbLatencies),
                semantic: this._buildStats(semanticLatencies),
                prompt: this._buildStats(promptLatencies),
            },
            promptStats: {
                count: promptChars.length,
                avgChars: promptAvgChars,
                p95Chars: Math.round(this._percentile(promptChars, 0.95)),
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
     * Snapshot específico para /internal/chat/metrics
     * No modifica la forma de getMetrics() — compatibilidad garantizada.
     * @returns {Object}
     */
    getChatMetricsSnapshot() {
        const latencies = this.records
            .filter(r => typeof r.totalMs === 'number' && r.totalMs >= 0)
            .map(r => r.totalMs);

        // TTFB backend: tiempo hasta que el LLM empieza a generar (vía ChatOrchestrator marks)
        const ttfbLatencies = this.records
            .map(r => r?.marks?.ttfb?.ttfbMs ?? r?.marks?.ttfb?.ms)
            .filter(v => typeof v === 'number' && v >= 0);

        // TTFT E2E: tiempo hasta el primer token enviado al cliente
        // Registrado directamente como r.ttftMs por chatController y ChatOrchestrator
        const ttftLatencies = this.records
            .map(r => r?.ttftMs)
            .filter(v => typeof v === 'number' && v >= 0);

        const promptChars = this.records
            .map(r => r?.marks?.prompt?.promptChars ?? r?.promptChars)
            .filter(v => typeof v === 'number' && v >= 0);

        const semanticRecords = this.records.filter(r => typeof r.cacheHit === 'boolean');
        const semanticHits = semanticRecords.filter(r => r.cacheHit).length;

        const faqRecords = this.records.filter(r => typeof r.faqHit === 'boolean');
        const faqHits = faqRecords.filter(r => r.faqHit).length;

        const avgPromptChars = promptChars.length > 0
            ? Math.round(promptChars.reduce((a, b) => a + b, 0) / promptChars.length)
            : 0;

        const avgLatency = latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : 0;

        return {
            latency: {
                avgMs: avgLatency,
                p50Ms: Math.round(this._percentile(latencies, 0.5)),
                p95Ms: Math.round(this._percentile(latencies, 0.95)),
            },
            ttfb: this._buildStats(ttfbLatencies),
            ttft: this._buildStats(ttftLatencies),
            promptSize: {
                avgChars: avgPromptChars,
                p95Chars: Math.round(this._percentile(promptChars, 0.95)),
                avgTokensEstimated: Math.round(avgPromptChars / 4),
            },
            faqHitRatio: faqRecords.length > 0
                ? { value: Math.round((faqHits / faqRecords.length) * 100), unit: 'percent' }
                : { value: null, note: 'faqHit not yet instrumented in telemetry' },
            semanticHitRatio: semanticRecords.length > 0
                ? { value: Math.round((semanticHits / semanticRecords.length) * 100), unit: 'percent' }
                : { value: null, note: 'no cacheable records in window' },
            rankingEffectiveness: {
                value: null,
                note: 'requires labeled evaluation data — not yet instrumented',
            },
            totalRequests: this.records.length,
        };
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
