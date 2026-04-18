import { Router } from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { chatLimiter } from '../middlewares/rateLimiter.js';
import { askCandidate, askCandidateStream } from '../controllers/candidateChatController.js';

const router = Router();

// POST /api/chat/candidate/:id — chat con candidato (respuesta completa)
router.post('/candidate/:id', autenticarUsuario, chatLimiter, askCandidate);
// POST /api/chat/candidate/:id/stream — chat con candidato via SSE streaming
router.post('/candidate/:id/stream', autenticarUsuario, chatLimiter, askCandidateStream);

export default router;
