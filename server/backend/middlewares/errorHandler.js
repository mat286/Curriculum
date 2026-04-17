import logger from '../utils/logger.js';

export class AppError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

export class ValidationError extends AppError {
    constructor(message) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

export class AuthError extends AppError {
    constructor(message = 'No autorizado') {
        super(message, 403, 'AUTH_ERROR');
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Recurso no encontrado') {
        super(message, 404, 'NOT_FOUND');
    }
}

export class LLMError extends AppError {
    constructor(message = 'Error en el servicio de IA') {
        super(message, 502, 'LLM_ERROR');
    }
}

export function errorHandler(err, req, res, _next) {
    if (err instanceof AppError) {
        logger.warn({ code: err.code, path: req.path }, err.message);
        return res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
        });
    }

    logger.error({ err, path: req.path }, 'Error no manejado');
    res.status(500).json({
        error: 'Error interno del servidor',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
}
