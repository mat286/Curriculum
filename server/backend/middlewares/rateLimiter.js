import rateLimit from 'express-rate-limit';

/**
 * Limiter global — capa de defensa general contra floods de toda la API.
 * 200 req/min por IP. Es el techo máximo antes de los limiters específicos.
 */
export const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `ip:${req.ip}`,
    message: {
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el límite global de solicitudes. Intenta de nuevo en un momento.',
    },
});

/**
 * Limiter genérico para endpoints de chat con candidato.
 * 20 req/min por usuario autenticado o por IP.
 */
export const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`,
    message: {
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el límite de 20 preguntas por minuto. Intenta de nuevo en un momento.',
    },
});

/**
 * Limiter para el endpoint de autenticación (POST /api/user/google).
 * Previene abuso / fuerza bruta. 10 intentos por ventana de 15 min por IP.
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `ip:${req.ip}`,
    message: {
        error: 'Demasiados intentos de autenticación',
        message: 'Has excedido el límite de intentos. Intenta de nuevo en 15 minutos.',
    },
    skipSuccessfulRequests: true,
});

/**
 * Limiter para endpoints de FAQs por candidato.
 * 60 req/min para operaciones de lectura/escritura de FAQs.
 */
export const faqLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`,
    message: {
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el límite de operaciones por minuto. Intenta de nuevo en un momento.',
    },
});
