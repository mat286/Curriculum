import { collectJobProfile, rankCandidates, buildQueryText } from '../services/recruiterService.js';
import { searchCandidates } from '../services/embeddingService.js';
import { pool } from '../config/db.js';
import { ValidationError } from '../middlewares/errorHandler.js';
import logger from '../utils/logger.js';

const TOP_CANDIDATES_LIMIT = 8;

/**
 * POST /api/recruiter/chat
 *
 * Body:
 *   { message, conversationHistory: [], phase: 'collect'|'search', jobProfile: {} }
 *
 * Respuesta fase 'collect':
 *   { phase: 'collect', message: "...", jobProfile: {} }
 *   { phase: 'results', message: "...", candidates: [{id, nombre, puestoActual, score, reason, habilidades}] }
 */
export async function recruiterChat(req, res, next) {
    try {
        const { message, conversationHistory = [], phase = 'collect', jobProfile = {} } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            throw new ValidationError('El mensaje no puede estar vacío');
        }

        const trimmed = message.trim();

        // ── Fase collect: construir el job profile conversacionalmente ──
        if (phase === 'collect') {
            const result = await collectJobProfile(trimmed, conversationHistory, jobProfile);

            if (!result.complete) {
                return res.json({
                    phase: 'collect',
                    message: result.question || '¿Podés contarme más sobre el perfil que buscás?',
                    jobProfile: result.jobProfile || jobProfile,
                });
            }

            // Profile completo → trigger search automático
            return await performSearch(result.jobProfile, res);
        }

        // ── Fase search: buscar con el job profile ya definido ──
        if (phase === 'search') {
            if (!jobProfile.role) {
                throw new ValidationError('Se requiere un job profile con al menos el campo "role"');
            }
            return await performSearch(jobProfile, res);
        }

        throw new ValidationError('Phase inválida. Usar: collect | search');
    } catch (error) {
        next(error);
    }
}

async function performSearch(jobProfile, res) {
    const queryText = buildQueryText(jobProfile);
    logger.info({ queryText, jobProfile }, 'Recruiter: iniciando búsqueda semántica');

    // Búsqueda semántica en colección global
    const semanticResults = await searchCandidates(queryText, TOP_CANDIDATES_LIMIT * 2);

    if (semanticResults.length === 0) {
        return res.json({
            phase: 'results',
            message: 'No encontré candidatos indexados aún. Los candidatos aparecen aquí cuando activan su perfil público.',
            candidates: [],
            jobProfile,
        });
    }

    // Obtener únicamente candidatos con is_public = 1
    const candidateIds = semanticResults.map(r => r.userId);
    const placeholders = candidateIds.map(() => '?').join(',');

    const [candidates] = await pool.query(
        `SELECT u.id, u.nombre, u.apellido, u.puesto_actual, u.resumen
         FROM usuarios u
         WHERE u.id IN (${placeholders}) AND u.is_public = 1`,
        candidateIds
    );

    if (candidates.length === 0) {
        return res.json({
            phase: 'results',
            message: 'Los candidatos encontrados no tienen perfil público activo.',
            candidates: [],
            jobProfile,
        });
    }

    // Enriquecer con habilidades
    const pubIds = candidates.map(c => c.id);
    const pubPlaceholders = pubIds.map(() => '?').join(',');
    const [skills] = await pool.query(
        `SELECT user_id, nombre FROM habilidades WHERE user_id IN (${pubPlaceholders}) ORDER BY user_id, id`,
        pubIds
    );
    const skillsMap = {};
    for (const s of skills) {
        if (!skillsMap[s.user_id]) skillsMap[s.user_id] = [];
        skillsMap[s.user_id].push(s.nombre);
    }

    const enriched = candidates.map(c => ({
        id: c.id,
        nombre: `${c.nombre} ${c.apellido}`.trim(),
        puestoActual: c.puesto_actual || null,
        resumen: c.resumen || null,
        habilidades: skillsMap[c.id] || [],
        experiencia_laboral: [],
    }));

    // Rankear con LLM
    const ranked = await rankCandidates(jobProfile, enriched);

    // Mezclar scores con datos
    const finalCandidates = ranked
        .slice(0, TOP_CANDIDATES_LIMIT)
        .map(rank => {
            const profile = enriched.find(c => c.id === rank.id);
            return {
                id: rank.id,
                nombre: profile?.nombre || `Candidato ${rank.id}`,
                puestoActual: profile?.puestoActual || null,
                resumen: profile?.resumen || null,
                habilidades: profile?.habilidades || [],
                score: Math.round((rank.score || 0) * 100),
                reason: rank.reason || '',
            };
        });

    const topName = finalCandidates[0]?.nombre || 'candidatos';
    const message = finalCandidates.length === 0
        ? 'No encontré candidatos que encajen con ese perfil.'
        : `Encontré ${finalCandidates.length} candidato${finalCandidates.length > 1 ? 's' : ''} que encajan con tu búsqueda. El más relevante es ${topName}.`;

    res.json({
        phase: 'results',
        message,
        candidates: finalCandidates,
        jobProfile,
    });
}
