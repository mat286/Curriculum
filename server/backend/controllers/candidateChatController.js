import { ValidationError } from '../middlewares/errorHandler.js';
import { chatOrchestrator } from '../modules/chat/ChatOrchestrator.js';
import { initSSE } from '../modules/chat/StreamResponse.js';

/**
 * POST /api/chat/candidate/:id
 * Chat público con el avatar de un candidato específico.
 * El candidato debe tener is_public = 1.
 */
export async function askCandidate(req, res, next) {
    try {
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
        });

        res.json(payload);
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
    const { send, finish } = initSSE(res);

    let clientGone = false;
    req.on('close', () => { clientGone = true; });

    try {
        const result = await chatOrchestrator.askStream({
            candidateId,
            message: trimmed,
            requesterId: req.user?.id,
            onToken: (token) => {
                if (!clientGone) send({ token });
            },
        });

        if (!clientGone) finish({ routed: result.routed, cached: result.cached });
    } catch (error) {
        if (clientGone) return;
        if (res.headersSent) {
            send({ error: error.message || 'Error interno del servidor' });
            res.end();
        } else {
            next(error);
        }
    }
}
