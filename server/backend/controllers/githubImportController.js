import { ValidationError, AuthError } from '../middlewares/errorHandler.js';
import { getFullProfile } from '../services/dataService.js';
import { buildGithubImportProposal } from '../services/githubImportService.js';
import logger from '../utils/logger.js';

function validateOwnUserId(paramId, authUserId) {
    const userId = parseInt(paramId, 10);
    if (isNaN(userId) || userId <= 0) throw new ValidationError('ID de usuario inválido');
    if (authUserId !== userId) throw new AuthError('Solo puedes importar datos a tu propio perfil');
    return userId;
}

/**
 * POST /api/user/:id/github/import
 * Trae datos públicos de un usuario de GitHub (bio, repos, lenguajes) y
 * devuelve una propuesta de campos de perfil para que el usuario confirme.
 * NO escribe nada en la base.
 */
export async function importFromGithub(req, res, next) {
    try {
        const userId = validateOwnUserId(req.params.id, req.user.id);
        const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';

        if (!username) {
            throw new ValidationError('Ingresá tu username de GitHub');
        }

        const existingProfile = await getFullProfile(userId);
        const proposal = await buildGithubImportProposal({ username, existingProfile });

        logger.info({ userId, username }, 'GitHub analizado, propuesta generada');

        res.json({ success: true, proposal });
    } catch (error) {
        next(error);
    }
}
