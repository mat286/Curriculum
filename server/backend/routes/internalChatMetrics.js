import express from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { authenticatedLimiter } from '../middlewares/rateLimiter.js';
import { getChatMetrics } from '../controllers/internalChatMetricsController.js';

const router = express.Router();

/**
 * GET /internal/chat/metrics
 * Métricas E2E de chat (latency, TTFB/TTFT, prompt size, hit ratios, tokens).
 * Requiere autenticación JWT.
 */
router.get('/chat/metrics', autenticarUsuario, authenticatedLimiter, getChatMetrics);

export default router;
