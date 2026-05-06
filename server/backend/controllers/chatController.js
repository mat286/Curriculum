import { getUserData } from '../services/dataService.js';
import { generateResponseFromPrompt, generateResponseStreamFromPrompt } from '../services/responseService.js';
import { search as semanticSearch } from '../services/embeddingService.js';
import { PromptAssembler } from '../modules/prompt/PromptAssembler.js';
import { ValidationError, NotFoundError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import { withTimeout, createCache } from '../utils/chatHelpers.js';
import { initSSE } from '../modules/chat/StreamResponse.js';
import { HybridSearchService } from '../services/HybridSearchService.js';
import { isRetryableError } from '../utils/retryUtils.js';
import metricsAggregator from '../config/metricsAggregator.js';

const hybridSearch = new HybridSearchService();
const promptAssembler = new PromptAssembler();

export function enrichWithHybrid(query, semanticHits, userData, candidateId, requestId) {
    if (!userData || semanticHits.length === 0) return semanticHits;
    try {
        const result = hybridSearch.search({
            query,
            profileContext: userData,
            semanticResults: semanticHits,
            candidateId,
            requestId,
        });
        logger.info(
            { candidateId, requestId, method: result.method, beforeCount: semanticHits.length, afterCount: result.results.length },
            'retrieval:hybrid applied'
        );
        return result.results;
    } catch (err) {
        logger.warn({ err, candidateId }, 'Hybrid enrichment falló, usando solo resultados semánticos');
        return semanticHits;
    }
}

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
 * Endpoint principal del chat con enfoque retrieval-first.
 */
export async function ask(req, res, next) {
    try {
        const { question } = req.body;

        if (!question || typeof question !== 'string' || question.trim().length === 0) {
            throw new ValidationError('La pregunta no puede estar vacía');
        }

        const trimmedQuestion = question.trim();
        if (trimmedQuestion.length > 2000) {
            throw new ValidationError('La pregunta no puede superar los 2000 caracteres');
        }
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

        const [userDataResult, embeddingResult] = await Promise.allSettled([
            getUserData(userId, []),
            withTimeout(semanticSearch(trimmedQuestion, userId, 2), 900, []),
        ]);

        if (userDataResult.status === 'rejected') {
            throw userDataResult.reason;
        }

        const userData = userDataResult.value;
        if (!userData) {
            throw new NotFoundError('Usuario no encontrado');
        }

        const semanticHits = embeddingResult.status === 'fulfilled' ? embeddingResult.value : [];
        if (embeddingResult.status === 'rejected') {
            logger.debug({ userId }, 'Embeddings no disponibles, continuando sin ellos');
        }

        const embeddingResults = enrichWithHybrid(trimmedQuestion, semanticHits, userData, userId, null);
        const promptBuildResult = promptAssembler.build({
            candidateName: userName,
            profileContext: userData,
            semanticContext: embeddingResults,
            conversationMemory: null,
            faqHit: null,
            selectedSections: [],
            question: trimmedQuestion,
            requestId: null,
        });
        const systemInstruction = promptBuildResult?.systemInstruction ?? null;
        const userPrompt = String(promptBuildResult?.userPrompt ?? promptBuildResult?.prompt ?? '').trim() || trimmedQuestion;
        const compressionStats = promptBuildResult?.compressionStats ?? null;

        logger.debug({ userId, promptChars: userPrompt.length, compressionStats }, 'chat:prompt built');
        const answer = await generateResponseFromPrompt(userPrompt, systemInstruction);

        const payload = {
            answer,
            userId,
            routed: 'with_data',
            intent: 'retrieval_direct',
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
    if (trimmedQuestion.length > 2000) {
        return next(new ValidationError('La pregunta no puede superar los 2000 caracteres'));
    }

    const startMs = Date.now();
    let firstTokenMs = null;

    const userId = req.user.id;
    const userName = `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() || 'Candidato';
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

        const fastResponse = getFastDirectResponse(trimmedQuestion, userName);
        if (fastResponse) {
            sse.sendStatus('generating', { source: 'fast-direct' });
            sse.sendToken(fastResponse);
            sse.sendStatus('finalizing');
            sse.finish({ routed: 'fast-direct' });
            return;
        }

        sse.sendStatus('retrieving');

        const [userDataResult, embeddingResult] = await Promise.allSettled([
            getUserData(userId, []),
            withTimeout(semanticSearch(trimmedQuestion, userId, 2), 900, []),
        ]);

        if (userDataResult.status === 'rejected') {
            sse.sendError(userDataResult.reason || 'Error al obtener datos del usuario', isRetryableError(userDataResult.reason));
            res.end();
            return;
        }

        const userData = userDataResult.value;
        if (!userData) {
            sse.sendError('Usuario no encontrado', false);
            res.end();
            return;
        }

        const semanticHits = embeddingResult.status === 'fulfilled' ? embeddingResult.value : [];
        if (embeddingResult.status === 'rejected') {
            logger.debug({ userId, requestId: sse.requestId }, 'Embeddings no disponibles en stream, continuando sin ellos');
        }

        const enrichedEmbeddings = enrichWithHybrid(trimmedQuestion, semanticHits, userData, userId, sse.requestId);
        sse.sendStatus('generating', { embeddings: enrichedEmbeddings.length });

        const streamPromptBuildResult = promptAssembler.build({
            candidateName: userName,
            profileContext: userData,
            semanticContext: enrichedEmbeddings,
            conversationMemory: null,
            faqHit: null,
            selectedSections: [],
            question: trimmedQuestion,
            requestId: sse.requestId,
        });
        const streamSysInstruction = streamPromptBuildResult?.systemInstruction ?? null;
        const streamUserPrompt = String(streamPromptBuildResult?.userPrompt ?? streamPromptBuildResult?.prompt ?? '').trim() || trimmedQuestion;
        const streamCompressionStats = streamPromptBuildResult?.compressionStats ?? null;
        logger.debug({ userId, requestId: sse.requestId, promptChars: streamUserPrompt.length, streamCompressionStats }, 'chat:stream prompt built');

        await generateResponseStreamFromPrompt(
            streamUserPrompt,
            (token) => {
                if (!clientGone) {
                    if (firstTokenMs === null) firstTokenMs = Date.now();
                    sse.sendToken(token);
                }
            },
            streamSysInstruction,
        );

        if (!clientGone) {
            const totalMs = Date.now() - startMs;
            const ttfbMs = firstTokenMs !== null ? firstTokenMs - startMs : undefined;

            sse.sendMetrics({
                routed: 'with_data',
                intent: 'retrieval_direct',
                usedEmbeddings: enrichedEmbeddings.length,
                ttfbMs,
                totalMs,
            });
            sse.sendStatus('finalizing');
            sse.finish({ routed: 'with_data' });

            metricsAggregator.recordTelemetry({
                scope: 'chat:authenticated:stream',
                totalMs,
                ttftMs: ttfbMs,
                route: 'chat/ask/stream',
                intent: 'retrieval_direct',
                promptChars: streamUserPrompt.length,
            });
        }
    } catch (error) {
        if (clientGone) return;
        if (res.headersSent) {
            sse.sendError('Error interno al procesar el stream', isRetryableError(error));
            res.end();
        } else {
            next(error);
        }
    }
}
