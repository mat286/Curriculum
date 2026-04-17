import { classify } from '../services/routerService.js';
import { getUserData } from '../services/dataService.js';
import { generateResponse } from '../services/responseService.js';
import { search as semanticSearch } from '../services/embeddingService.js';
import { pool } from '../config/db.js';
import { ValidationError, NotFoundError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';
import { withTimeout, createCache } from '../utils/chatHelpers.js';

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
