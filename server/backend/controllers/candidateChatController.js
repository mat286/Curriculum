import { classify } from '../services/routerService.js';
import { getUserData } from '../services/dataService.js';
import { generateResponse, generateResponseStream } from '../services/responseService.js';
import { search as semanticSearch } from '../services/embeddingService.js';
import { pool } from '../config/db.js';
import { ValidationError, NotFoundError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import { withTimeout, createCache } from '../utils/chatHelpers.js';

// Todos los campos del CV — usados en el stream para evitar la llamada al router
const ALL_FIELDS = [
    'sobre_mi', 'experiencia_laboral', 'educacion', 'cursos',
    'proyectos', 'habilidades', 'idiomas', 'respuestas_entrevista',
];

const QUICK_RESPONSES = [
    {
        pattern: /^(hola|holi|hey|buenas|buenos dias|buenos días|buenas tardes|buenas noches)[!.?\s]*$/i,
        getMessage: (name) => `¡Hola! Soy el avatar de ${name}. Estoy listo para responder tus preguntas sobre mi perfil profesional.`,
    },
    {
        pattern: /^(gracias|muchas gracias|genial|perfecto|ok)[!.?\s]*$/i,
        getMessage: () => '¡Con gusto! Podés seguir preguntándome sobre mi experiencia, habilidades o proyectos.',
    },
];

const candidateCache = createCache(10 * 60 * 1000);

function getCacheKey(candidateId, question) {
    return `candidate:${candidateId}:${question.trim().toLowerCase()}`;
}

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

        const trimmed = message.trim();

        // Verificar que el candidato existe y es público
        const [rows] = await pool.query(
            'SELECT id, nombre, apellido, is_public FROM usuarios WHERE id = ?',
            [candidateId]
        );
        if (rows.length === 0 || !rows[0].is_public) {
            throw new NotFoundError('Candidato no encontrado o no disponible');
        }

        const candidate = rows[0];
        const candidateName = `${candidate.nombre} ${candidate.apellido}`.trim();

        // Fast-path: saludos
        const quickEntry = QUICK_RESPONSES.find(({ pattern }) => pattern.test(trimmed));
        if (quickEntry) {
            return res.json({ answer: quickEntry.getMessage(candidateName), candidateId, routed: 'fast-direct' });
        }

        // Cache compartida (igual pregunta → igual candidato → misma respuesta para todos)
        const cacheKey = getCacheKey(candidateId, trimmed);
        const cached = candidateCache.get(cacheKey);
        if (cached) {
            return res.json({ ...cached, cached: true });
        }

        // Router LLM
        const decision = await classify(trimmed, candidateName);
        logger.info({ candidateId, intent: decision.intent, needs_db: decision.needs_db }, 'Candidate chat: router decision');

        if (!decision.needs_db && decision.direct_response) {
            return res.json({ answer: decision.direct_response, candidateId, routed: 'direct' });
        }

        // Obtener datos del candidato en paralelo con embeddings
        const [dataResult, embeddingResult] = await Promise.allSettled([
            getUserData(candidateId, decision.fields_required || []),
            withTimeout(semanticSearch(trimmed, candidateId, 2), 900, []),
        ]);

        if (dataResult.status === 'rejected') throw dataResult.reason;

        const userData = dataResult.value;
        if (!userData) throw new NotFoundError('Candidato no encontrado');

        const embeddingResults = embeddingResult.status === 'fulfilled' ? embeddingResult.value : [];

        const answer = await generateResponse(candidateName, trimmed, userData, embeddingResults);

        const payload = { answer, candidateId, routed: 'with_data', intent: decision.intent };
        candidateCache.set(cacheKey, payload);
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

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.socket?.setNoDelay(true);

    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    const finish = (meta = {}) => { send({ done: true, ...meta }); res.end(); };

    let clientGone = false;
    req.on('close', () => { clientGone = true; });

    try {
        // Verificar que el candidato existe y es público
        const [rows] = await pool.query(
            'SELECT id, nombre, apellido, is_public FROM usuarios WHERE id = ?',
            [candidateId]
        );
        if (rows.length === 0 || !rows[0].is_public) {
            send({ error: 'Candidato no encontrado o no disponible' });
            res.end();
            return;
        }

        const candidate = rows[0];
        const candidateName = `${candidate.nombre} ${candidate.apellido}`.trim();

        // Fast-path: saludos y respuestas rápidas
        const quickEntry = QUICK_RESPONSES.find(({ pattern }) => pattern.test(trimmed));
        if (quickEntry) {
            send({ token: quickEntry.getMessage(candidateName) });
            finish({ routed: 'fast-direct' });
            return;
        }

        // Cache hit: reproducir la respuesta guardada sin llamar al LLM
        const cacheKey = getCacheKey(candidateId, trimmed);
        const cached = candidateCache.get(cacheKey);
        if (cached) {
            logger.info({ candidateId }, 'Candidate stream: cache hit');
            // Enviar en trozos de ~3 palabras para imitar streaming
            const tokens = cached.answer.match(/\S+\s*/g) || [];
            for (let i = 0; i < tokens.length; i += 3) {
                if (clientGone) break;
                send({ token: tokens.slice(i, i + 3).join('') });
            }
            finish({ routed: cached.routed, cached: true });
            return;
        }

        // Sin router: lanzar datos + embeddings en paralelo directamente
        // (evita una llamada LLM extra antes del streaming)
        const [dataResult, embeddingResult] = await Promise.allSettled([
            getUserData(candidateId, ALL_FIELDS),
            withTimeout(semanticSearch(trimmed, candidateId, 2), 900, []),
        ]);

        if (dataResult.status === 'rejected') {
            send({ error: dataResult.reason?.message || 'Error al obtener datos del candidato' });
            res.end();
            return;
        }

        const userData = dataResult.value;
        if (!userData) {
            send({ error: 'Candidato no encontrado' });
            res.end();
            return;
        }

        const embeddingResults = embeddingResult.status === 'fulfilled' ? embeddingResult.value : [];

        logger.info({ candidateId }, 'Candidate stream: iniciando generación directa (sin router)');

        // Stream + acumular respuesta completa para guardar en caché
        let fullResponse = '';
        await generateResponseStream(
            candidateName,
            trimmed,
            userData,
            embeddingResults,
            (token) => {
                if (!clientGone) send({ token });
                fullResponse += token;
            },
        );

        // Guardar en caché para peticiones idénticas futuras
        if (fullResponse) {
            candidateCache.set(cacheKey, { answer: fullResponse, routed: 'with_data' });
        }

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
