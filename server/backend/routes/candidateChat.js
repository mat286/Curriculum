import { Router } from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { chatLimiter } from '../middlewares/rateLimiter.js';
import { askCandidate } from '../controllers/candidateChatController.js';

const router = Router();

// POST /api/chat/candidate/:id — chat con candidato público específico
router.post('/candidate/:id', autenticarUsuario, chatLimiter, askCandidate);

export default router;
