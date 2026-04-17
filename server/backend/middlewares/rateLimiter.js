import rateLimit from 'express-rate-limit';

export const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: {
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el límite de 20 preguntas por minuto. Intenta de nuevo en un momento.',
    },
});
