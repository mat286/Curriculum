import multer from 'multer';
import { SUPPORTED_CV_MIME_TYPES } from '../utils/fileTextExtractor.js';
import { ValidationError } from './errorHandler.js';

const storage = multer.memoryStorage();

/**
 * Carga de CV — se procesa en memoria y se descarta al terminar el request,
 * nunca se escribe a disco (el contenedor backend no tiene volumen persistente).
 */
export const cvUpload = multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!SUPPORTED_CV_MIME_TYPES.includes(file.mimetype)) {
            cb(new ValidationError(`Formato no soportado: ${file.mimetype}. Subí un PDF, Word (.docx) o texto plano.`));
            return;
        }
        cb(null, true);
    },
});
