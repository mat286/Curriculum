import { randomUUID } from 'node:crypto';
import { ValidationError } from '../middlewares/errorHandler.js';
import { chatOrchestrator } from '../modules/chat/ChatOrchestrator.js';
import { initSSE } from '../modules/chat/StreamResponse.js';
import { pool } from '../config/db.js';
import logger from '../utils/logger.js';
import { isRetryableError } from '../utils/retryUtils.js';

function buildLastMessageSnippet(lastMessages) {
    try {
        const parsed = typeof lastMessages === 'string' ? JSON.parse(lastMessages || '[]') : (lastMessages || []);
        const last = Array.isArray(parsed) && parsed.length > 0 ? parsed[parsed.length - 1] : null;
        if (!last?.content) return '';
        return String(last.content).slice(0, 140);
    } catch {
        return '';
    }
}

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

/**
 * GET /api/chat/my-conversations
 * Lista los candidatos con los que el usuario autenticado charló (como
 * visitante, no como dueño del perfil), para el sidebar del chat propio.
 */
export async function listMyConversations(req, res, next) {
    try {
        const requesterId = req.user.id;

        const [rows] = await pool.query(
            `SELECT ccm.candidate_id, ccm.updated_at, ccm.last_messages,
                    u.nombre, u.apellido, u.profile_photo_url, u.puesto_actual
             FROM candidate_conversation_memory ccm
             JOIN usuarios u ON u.id = ccm.candidate_id
             WHERE ccm.requester_id = ? AND ccm.candidate_id <> ?
             ORDER BY ccm.updated_at DESC`,
            [requesterId, requesterId],
        );

        const conversations = rows.map((row) => ({
            candidateId: row.candidate_id,
            nombre: row.nombre,
            apellido: row.apellido,
            puestoActual: row.puesto_actual,
            profilePhotoUrl: row.profile_photo_url,
            updatedAt: row.updated_at,
            lastMessageSnippet: buildLastMessageSnippet(row.last_messages),
        }));

        res.json({ success: true, conversations });
    } catch (error) {
        next(error);
    }
}
