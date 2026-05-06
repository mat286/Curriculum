import { randomUUID } from 'node:crypto';
import { ValidationError } from '../middlewares/errorHandler.js';
import { chatOrchestrator } from '../modules/chat/ChatOrchestrator.js';
import { initSSE } from '../modules/chat/StreamResponse.js';
import logger from '../utils/logger.js';
import { isRetryableError } from '../utils/retryUtils.js';

/**
 * POST /api/chat/candidate/:id
 * Chat público con el avatar de un candidato específico.
 * El candidato debe tener is_public = 1.
 */
export async function askCandidate(req, res, next) {
    try {
        const requestId = randomUUID();
        const candidateId = parseInt(req.params.id, 10);
        if (isNaN(candidateId) || candidateId <= 0) {
            throw new ValidationError('ID de candidato inválido');
        }

        const { message } = req.body;
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            throw new ValidationError('El mensaje no puede estar vacío');
        }
        const payload = await chatOrchestrator.ask({
            candidateId,
            message: message.trim(),
            requesterId: req.user?.id,
            requestId,
        });

        logger.info(
            {
                requestId,
                scope: 'candidate-chat-http',
                candidateId,
                requesterId: req.user?.id,
                routed: payload.routed,
                cached: Boolean(payload.cached),
            },
            'candidate chat response sent',
        );

        res.json({ ...payload, requestId });
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/chat/candidate/:id/stream
 * Igual que askCandidate() pero transmite la respuesta token a token via SSE.
 * Optimizado: no llama al router LLM, busca todos los campos directo.
 * Respuestas cacheadas se reproducen token a token desde caché (sin LLM).
 *
 * Formato de eventos:
 *   data: {"token":"hola"}\n\n
 *   data: {"done":true}\n\n
 */
export async function askCandidateStream(req, res, next) {
    const candidateId = parseInt(req.params.id, 10);
    if (isNaN(candidateId) || candidateId <= 0) {
        return next(new ValidationError('ID de candidato inválido'));
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return next(new ValidationError('El mensaje no puede estar vacío'));
    }

    const trimmed = message.trim();
    const sse = initSSE(res);
    const requestId = sse.requestId;
    const streamStartedAt = Date.now();

    let clientGone = false;
    req.on('close', () => {
        clientGone = true;
        sse.stopHeartbeat();
        logger.info(
            {
                requestId,
                scope: 'candidate-chat-stream',
                candidateId,
                requesterId: req.user?.id,
                totalMs: Date.now() - streamStartedAt,
            },
            'candidate chat stream client disconnected',
        );
    });

    try {
        logger.info(
            {
                requestId,
                scope: 'candidate-chat-stream',
                candidateId,
                requesterId: req.user?.id,
            },
            'candidate chat stream started',
        );

        sse.sendAck({ phase: 'accepted' });
        sse.startHeartbeat();
        sse.sendStatus('thinking');
        sse.sendStatus('retrieving', { source: 'candidate_orchestrator' });
        sse.sendStatus('generating');

        const result = await chatOrchestrator.askStream({
            candidateId,
            message: trimmed,
            requesterId: req.user?.id,
            requestId,
            onToken: (token) => {
                if (!clientGone) sse.sendToken(token);
            },
        });

        if (!clientGone) {
            sse.sendMetrics(result.metrics || { routed: result.routed, cached: Boolean(result.cached) });
            sse.sendStatus('finalizing');
            sse.finish({ routed: result.routed, cached: result.cached });
            logger.info(
                {
                    requestId,
                    scope: 'candidate-chat-stream',
                    candidateId,
                    requesterId: req.user?.id,
                    ...result.metrics,
                },
                'candidate chat stream completed',
            );
        }
    } catch (error) {
        if (clientGone) return;
        if (res.headersSent) {
            logger.error(
                {
                    requestId,
                    scope: 'candidate-chat-stream',
                    candidateId,
                    requesterId: req.user?.id,
                    err: error,
                },
                'candidate chat stream failed',
            );
            sse.sendError(error, isRetryableError(error));
            res.end();
        } else {
            next(error);
        }
    }
}
