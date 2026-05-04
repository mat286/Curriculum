import logger from '../../utils/logger.js';
import metricsAggregator from '../../config/metricsAggregator.js';

export class ChatTelemetry {
    constructor(scope, base = {}) {
        this.scope = scope;
        this.base = base;
        this.start = Date.now();
        this.marks = {};
    }

    mark(name, extra = {}) {
        this.marks[name] = { ms: Date.now() - this.start, ...extra };
    }

    /**
     * Envía datos de telemetría al MetricsAggregatorService
     * @param {Object} aggregator - instancia de MetricsAggregatorService (optional)
     */
    recordTo(aggregator = metricsAggregator) {
        if (!aggregator) return;
        try {
            const telemetryData = {
                scope: this.scope,
                totalMs: Date.now() - this.start,
                marks: this.marks,
                ...this.base,
            };
            aggregator.recordTelemetry(telemetryData);
        } catch (error) {
            logger.error({ err: error }, 'Error registrando telemetría en agregador');
        }
    }

    flush(extra = {}) {
        const telemetryData = {
            scope: this.scope,
            totalMs: Date.now() - this.start,
            marks: this.marks,
            ...this.base,
            ...extra,
        };

        logger.info(telemetryData, 'chat telemetry');

        // Registrar automáticamente en el agregador de métricas
        this.recordTo(metricsAggregator);
    }
}
