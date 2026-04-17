import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * GET /api/candidates
 * Retorna todos los candidatos con perfil público (is_public=1),
 * incluyendo sus top 5 habilidades.
 */
export async function getCandidates(req, res, next) {
    try {
        const [candidates] = await pool.query(
            `SELECT id, nombre, apellido, puesto_actual, resumen,
                    linkedin_url, github_url, portfolio_url
             FROM usuarios
             WHERE is_public = 1
             ORDER BY updated_at DESC`
        );

        if (candidates.length === 0) {
            return res.json([]);
        }

        const ids = candidates.map(c => c.id);
        const placeholders = ids.map(() => '?').join(',');
        const [skills] = await pool.query(
            `SELECT user_id, nombre, categoria
             FROM habilidades
             WHERE user_id IN (${placeholders})
             ORDER BY user_id, id`,
            ids
        );

        // Agrupar habilidades por user_id (top 5)
        const skillsMap = {};
        for (const skill of skills) {
            if (!skillsMap[skill.user_id]) skillsMap[skill.user_id] = [];
            if (skillsMap[skill.user_id].length < 5) {
                skillsMap[skill.user_id].push(skill.nombre);
            }
        }

        const result = candidates.map(c => ({
            id: c.id,
            nombre: `${c.nombre} ${c.apellido}`.trim(),
            puestoActual: c.puesto_actual || null,
            resumen: c.resumen || null,
            habilidades: skillsMap[c.id] || [],
            linkedinUrl: c.linkedin_url || null,
            githubUrl: c.github_url || null,
            portfolioUrl: c.portfolio_url || null,
        }));

        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Error al obtener candidatos públicos');
        next(error);
    }
}
