/**
 * chatController.js — Flujo A: chat autenticado del owner con su propio perfil.
 *
 * Refactorizado: delega al ChatOrchestrator con candidateId = requesterId = userId.
 * CandidateAggregateService ya maneja acceso del owner via SQL (u.id = ?).
 *
 * Pipeline anterior eliminado — ver git history para la versión legada.
 */
import { ValidationError } from '../middlewares/errorHandler.js';
import { initSSE } from '../modules/chat/StreamResponse.js';
import { chatOrchestrator } from '../modules/chat/ChatOrchestrator.js';
import { isRetryableError } from '../utils/retryUtils.js';
import metricsAggregator from '../config/metricsAggregator.js';
import logger from '../utils/logger.js';

function validateQuestion(question) {
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        throw new ValidationError('La pregunta no puede estar vacía');
    }
    if (question.trim().length > 2000) {
        throw new ValidationError('La pregunta no puede superar los 2000 caracteres');
    }
    return question.trim();
}

/**
 * POST /api/chat/ask
 */
export async function ask(req, res, next) {
    try {
        const trimmedQuestion = validateQuestion(req.body.question);
        const userId = req.user.id;

        const result = await chatOrchestrator.ask({
            candidateId: userId,
            message: trimmedQuestion,
            requesterId: userId,
            requestId: null,
        });

        res.json({
            answer: result.answer,
            userId,
            routed: result.routed,
            cached: result.cached ?? false,
        });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/chat/ask/stream
 *
 * Formato de eventos SSE:
 *   data: {"token":"hola"}\n\n
 *   data: {"done":true,"routed":"with_data"}\n\n
 */
export async function askStream(req, res, next) {
    let trimmedQuestion;
    try {
        trimmedQuestion = validateQuestion(req.body.question);
    } catch (error) {
        return next(error);
    }

    const userId = req.user.id;
    const sse = initSSE(res);

    let clientGone = false;
    req.on('close', () => {
        clientGone = true;
        sse.stopHeartbeat();
    });

    try {
        sse.sendAck({ phase: 'accepted' });
        sse.startHeartbeat();
        sse.sendStatus('thinking');

        const result = await chatOrchestrator.askStream({
            candidateId: userId,
            message: trimmedQuestion,
            requesterId: userId,
            requestId: sse.requestId,
            onToken: (token) => {
                if (!clientGone) sse.sendToken(token);
            },
            onStatus: (status) => {
                if (!clientGone) sse.sendStatus(status.status, { label: status.label, sections: status.sections });
            },
        });

        if (!clientGone) {
            const metrics = result.metrics ?? {};
            sse.sendMetrics({
                routed: result.routed,
                intent: result.intent,
                ttfbMs: metrics.ttfbMs,
                totalMs: metrics.totalMs,
            });
            sse.sendStatus('finalizing');
            sse.finish({ routed: result.routed });

            metricsAggregator.recordTelemetry({
                scope: 'chat:authenticated:stream',
                totalMs: metrics.totalMs,
                ttftMs: metrics.ttfbMs,
                route: 'chat/ask/stream',
                intent: result.intent,
                promptChars: metrics.promptChars,
            });
        }
    } catch (error) {
        if (clientGone) return;
        logger.error({ err: error, userId }, 'chat:authenticated:stream error');
        if (res.headersSent) {
            sse.sendError('Error interno al procesar el stream', isRetryableError(error));
            res.end();
        } else {
            next(error);
        }
    }
}
