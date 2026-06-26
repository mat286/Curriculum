import express from 'express';
import metricsAggregator from '../config/metricsAggregator.js';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { authenticatedLimiter } from '../middlewares/rateLimiter.js';
import { getOverview } from '../controllers/metricsController.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.get('/overview', autenticarUsuario, authenticatedLimiter, getOverview);

/**
 * GET /api/metrics
 * Retorna métricas agregadas en tiempo real
 * Requiere autenticación — expone datos operativos internos
 */
router.get('/', autenticarUsuario, authenticatedLimiter, (req, res) => {
    try {
        const metrics = metricsAggregator.getMetrics();
        res.json(metrics);
    } catch (error) {
        logger.error({ err: error }, 'Error obteniendo métricas');
        res.status(500).json({
            error: 'Error obteniendo métricas',
            message: error.message,
        });
    }
});

/**
 * GET /api/metrics/health
 * Verificación de estado del servicio de métricas
 * Público - sin autenticación requerida
 */
router.get('/health', (req, res) => {
    try {
        const recordCount = metricsAggregator.getRecordCount();
        res.json({
            status: 'ok',
            recordsStored: recordCount,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error({ err: error }, 'Error en health check de métricas');
        res.status(500).json({
            error: 'Error en health check',
            message: error.message,
        });
    }
});

/**
 * GET /api/metrics/raw
 * Retorna registros sin procesar (últimos N)
 * Requiere autenticación
 */
router.get('/raw', autenticarUsuario, authenticatedLimiter, (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '100'), 500);
        const rawRecords = metricsAggregator.getRawRecords(limit);
        res.json({
            limit,
            count: rawRecords.length,
            records: rawRecords,
        });
    } catch (error) {
        logger.error({ err: error }, 'Error obteniendo registros sin procesar');
        res.status(500).json({
            error: 'Error obteniendo registros',
            message: error.message,
        });
    }
});

/**
 * POST /api/metrics/reset
 * Limpia todas las métricas
 * Requiere autenticación
 */
router.post('/reset', autenticarUsuario, authenticatedLimiter, (req, res) => {
    try {
        // Validar que sea administrador (role: 'recruiter' o similar)
        // Por ahora, cualquier usuario autenticado puede hacer reset
        // Si necesitas restringir más, verifica req.user.role
        metricsAggregator.reset();
        res.json({
            message: 'Métricas reseteadas exitosamente',
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logger.error({ err: error }, 'Error reseteando métricas');
        res.status(500).json({
            error: 'Error reseteando métricas',
            message: error.message,
        });
    }
});

export default router;
