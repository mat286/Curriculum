import { classify } from '../services/routerService.js';
import { getUserData } from '../services/dataService.js';
import { generateResponse, generateResponseStream } from '../services/responseService.js';
import { search as semanticSearch } from '../services/embeddingService.js';
import { ValidationError, NotFoundError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import { withTimeout, createCache } from '../utils/chatHelpers.js';

const QUICK_RESPONSES = [
    {
        pattern: /^(hola|holi|hey|buenas|buenos dias|buenos días|buenas tardes|buenas noches)[!.?\s]*$/i,
        getMessage: (userName) => `¡Hola${userName ? ` ${userName.split(' ')[0]}` : ''}! Estoy listo para ayudarte con tu perfil y tus entrevistas.`,
    },
    {
        pattern: /^(gracias|muchas gracias|genial|perfecto|ok)[!.?\s]*$/i,
        getMessage: () => '¡Con gusto! Si quieres, puedo ayudarte a practicar respuestas o resumir tu experiencia.',
    },
];

const answerCache = createCache(5 * 60 * 1000);

function getCacheKey(userId, question) {
    return `${userId}:${question.trim().toLowerCase()}`;
}

function getFastDirectResponse(question, userName) {
    const entry = QUICK_RESPONSES.find(({ pattern }) => pattern.test(question.trim()));
    return entry ? entry.getMessage(userName) : null;
}

/**
 * POST /api/chat/ask
 * Endpoint principal del chat con routing inteligente.
 */
export async function ask(req, res, next) {
    try {
        const { question } = req.body;

        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            throw new ValidationError('La pregunta no puede estar vacía');
        }

        const trimmedQuestion = question.trim();
        const userId = req.user.id;
        const userName = `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || 'Candidato';

        const fastResponse = getFastDirectResponse(trimmedQuestion, userName);
        if (fastResponse) {
            return res.json({ answer: fastResponse, userId, routed: 'fast-direct' });
        }

        const cacheKey = getCacheKey(userId, trimmedQuestion);
        const cachedPayload = answerCache.get(cacheKey);
        if (cachedPayload) {
            return res.json({ ...cachedPayload, cached: true });
        }

        // Paso 1: Router LLM — clasificar intención
        const decision = await classify(trimmedQuestion, userName);

        logger.info({ userId, intent: decision.intent, needs_db: decision.needs_db }, 'Chat: decisión del router');

        // Caso A: Respuesta directa (saludo, charla casual)
        if (!decision.needs_db && decision.direct_response) {
            return res.json({ answer: decision.direct_response, userId, routed: 'direct' });
        }

        // Caso B: Necesita datos de la base de datos
        const [userDataResult, embeddingResult] = await Promise.allSettled([
            getUserData(userId, decision.fields_required || []),
            withTimeout(semanticSearch(trimmedQuestion, userId, 2), 900, []),
        ]);

        if (userDataResult.status === 'rejected') {
            throw userDataResult.reason;
        }

        const userData = userDataResult.value;
        if (!userData) {
            throw new NotFoundError('Usuario no encontrado');
        }

        const embeddingResults = embeddingResult.status === 'fulfilled' ? embeddingResult.value : [];
        if (embeddingResult.status === 'rejected') {
            logger.debug({ userId }, 'Embeddings no disponibles, continuando sin ellos');
        }

        // Paso 3: Segunda llamada a LLM con datos del CV
        const answer = await generateResponse(userName, trimmedQuestion, userData, embeddingResults);

        const payload = {
            answer,
            userId,
            routed: 'with_data',
            intent: decision.intent,
        };

        answerCache.set(cacheKey, payload);
        res.json(payload);
    } catch (error) {
        next(error);
    }
}

/**
 * POST /api/chat/ask/stream
 * Igual que ask() pero transmite la respuesta token a token via SSE.
 * El cliente puede mostrar los tokens a medida que llegan, sin esperar el final.
 *
 * Formato de eventos:
 *   data: {"token":"hola"}\n\n
 *   data: {"token":" mundo"}\n\n
 *   data: {"done":true,"routed":"with_data"}\n\n
 */
export async function askStream(req, res, next) {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return next(new ValidationError('La pregunta no puede estar vacía'));
    }

    const trimmedQuestion = question.trim();
    const userId = req.user.id;
    const userName = `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || 'Candidato';

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Desactiva el algoritmo de Nagle para que cada res.write() se envíe
    // inmediatamente sin esperar a que se llene el buffer TCP.
    res.socket?.setNoDelay(true);

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const finish = (meta = {}) => { send({ done: true, ...meta }); res.end(); };

    // Detectar si el cliente se desconectó
    let clientGone = false;
    req.on('close', () => { clientGone = true; });

    try {
        // Fast path
        const fastResponse = getFastDirectResponse(trimmedQuestion, userName);
        if (fastResponse) {
            send({ token: fastResponse });
            finish({ routed: 'fast-direct' });
            return;
        }

        // Clasificación de intención
        const decision = await classify(trimmedQuestion, userName);
        logger.info({ userId, intent: decision.intent, needs_db: decision.needs_db }, 'Stream: decisión del router');

        if (!decision.needs_db && decision.direct_response) {
            send({ token: decision.direct_response });
            finish({ routed: 'direct' });
            return;
        }

        // Obtener datos
        const [userDataResult, embeddingResult] = await Promise.allSettled([
            getUserData(userId, decision.fields_required || []),
            withTimeout(semanticSearch(trimmedQuestion, userId, 2), 900, []),
        ]);

        if (userDataResult.status === 'rejected') {
            send({ error: userDataResult.reason?.message || 'Error al obtener datos del usuario' });
            res.end();
            return;
        }

        const userData = userDataResult.value;
        if (!userData) {
            send({ error: 'Usuario no encontrado' });
            res.end();
            return;
        }

        const embeddingResults = embeddingResult.status === 'fulfilled' ? embeddingResult.value : [];

        // Streaming de la respuesta
        await generateResponseStream(
            userName,
            trimmedQuestion,
            userData,
            embeddingResults,
            (token) => { if (!clientGone) send({ token }); },
        );

        if (!clientGone) finish({ routed: 'with_data' });
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
