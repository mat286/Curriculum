import { getMetricsOverview } from '../services/metricsService.js';

const DEFAULT_HOURS = 24;
const MAX_HOURS = 168;

function parseHours(rawHours) {
    if (typeof rawHours === 'undefined') {
        return { ok: true, value: DEFAULT_HOURS };
    }

    const parsed = Number.parseInt(rawHours, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_HOURS) {
        return { ok: false };
    }

    return { ok: true, value: parsed };
}

export async function getOverview(req, res, next) {
    try {
        const hoursParsed = parseHours(req.query.hours);
        if (!hoursParsed.ok) {
            return res.status(400).json({
                error: 'Parámetro inválido',
                message: 'hours debe ser un entero entre 1 y 168',
            });
        }

        const payload = await getMetricsOverview({ hours: hoursParsed.value });
        return res.json(payload);
    } catch (error) {
        return next(error);
    }
}
