import { AuthError, ValidationError } from '../middlewares/errorHandler.js';
import { profileFillOrchestrator } from '../modules/chat/ProfileFillOrchestrator.js';
import { initSSE } from '../modules/chat/StreamResponse.js';
import logger from '../utils/logger.js';
import { isRetryableError } from '../utils/retryUtils.js';

/**
 * POST /api/chat/profile-fill/:id/stream
 * Chat de autocompletado del propio perfil — solo el dueño del perfil puede usarlo.
 * Igual que askCandidateStream pero delega en profileFillOrchestrator y adjunta
 * la propuesta de actualización estructurada (proposedUpdate) en el evento final.
 */
export async function askProfileFillStream(req, res, next) {
    const candidateId = parseInt(req.params.id, 10);
    if (isNaN(candidateId) || candidateId <= 0) {
        return next(new ValidationError('ID de usuario inválido'));
    }
    if (candidateId !== req.user?.id) {
        return next(new AuthError('Solo podés usar el chat de autocompletado de tu propio perfil'));
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
            { requestId, scope: 'profile-fill-chat-stream', userId: candidateId, totalMs: Date.now() - streamStartedAt },
            'profile fill chat stream client disconnected',
        );
    });

    try {
        logger.info({ requestId, scope: 'profile-fill-chat-stream', userId: candidateId }, 'profile fill chat stream started');

        sse.sendAck({ phase: 'accepted' });
        sse.startHeartbeat();
        sse.sendStatus('thinking');
        sse.sendStatus('generating');

        const result = await profileFillOrchestrator.askStream({
            userId: candidateId,
            message: trimmed,
            onToken: (token) => {
                if (!clientGone) sse.sendToken(token);
            },
        });

        if (!clientGone) {
            sse.sendStatus('finalizing');
            sse.finish({ proposedUpdate: result.proposedUpdate });
            logger.info(
                { requestId, scope: 'profile-fill-chat-stream', userId: candidateId, totalMs: Date.now() - streamStartedAt },
                'profile fill chat stream completed',
            );
        }
    } catch (error) {
        if (clientGone) return;
        if (res.headersSent) {
            logger.error({ requestId, scope: 'profile-fill-chat-stream', userId: candidateId, err: error }, 'profile fill chat stream failed');
            sse.sendError(error, isRetryableError(error));
            res.end();
        } else {
            next(error);
        }
    }
}
