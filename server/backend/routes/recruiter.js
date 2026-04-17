import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { recruiterChat } from '../controllers/recruiterController.js';

const recruiterLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip,
    message: {
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el límite de búsquedas por minuto. Intenta de nuevo en un momento.',
    },
});

const router = Router();

// POST /api/recruiter/chat
router.post('/chat', autenticarUsuario, recruiterLimiter, recruiterChat);

export default router;
