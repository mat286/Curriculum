import { ValidationError, AuthError } from '../middlewares/errorHandler.js';
import { getFullProfile } from '../services/dataService.js';
import { extractProfileUpdates } from '../services/profileExtractionService.js';
import { extractTextFromUpload } from '../utils/fileTextExtractor.js';
import logger from '../utils/logger.js';

function validateOwnUserId(paramId, authUserId) {
    const userId = parseInt(paramId, 10);
    if (isNaN(userId) || userId <= 0) throw new ValidationError('ID de usuario inválido');
    if (authUserId !== userId) throw new AuthError('Solo puedes cargar tu propio CV');
    return userId;
}

/**
 * POST /api/user/:id/cv/extract
 * Extrae texto de un CV (archivo o texto pegado) y devuelve una propuesta de
 * campos de perfil para que el usuario confirme. NO escribe nada en la base.
 */
export async function extractProfileFromCV(req, res, next) {
    try {
        const userId = validateOwnUserId(req.params.id, req.user.id);

        const rawText = req.file
            ? await extractTextFromUpload(req.file.buffer, req.file.mimetype, req.file.originalname)
            : (typeof req.body?.cvText === 'string' ? req.body.cvText.trim() : '');

        if (!rawText) {
            throw new ValidationError('Debés subir un archivo o pegar el texto de tu CV');
        }

        const existingProfile = await getFullProfile(userId);
        const proposal = await extractProfileUpdates({ sourceText: rawText, mode: 'cv', existingProfile });

        logger.info({ userId, textLength: rawText.length }, 'CV analizado, propuesta generada');

        res.json({
            success: true,
            proposal,
            sourceMeta: {
                fileName: req.file?.originalname || null,
                textLength: rawText.length,
            },
        });
    } catch (error) {
        next(error);
    }
}
