import { Router } from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { authenticatedLimiter, chatLimiter } from '../middlewares/rateLimiter.js';
import { askCandidate, askCandidateStream, listMyConversations } from '../controllers/candidateChatController.js';
import { askProfileFillStream } from '../controllers/profileFillChatController.js';

const router = Router();

// POST /api/chat/candidate/:id — chat con candidato (respuesta completa)
router.post('/candidate/:id', autenticarUsuario, authenticatedLimiter, chatLimiter, askCandidate);
// POST /api/chat/candidate/:id/stream — chat con candidato via SSE streaming
router.post('/candidate/:id/stream', autenticarUsuario, authenticatedLimiter, chatLimiter, askCandidateStream);
// POST /api/chat/profile-fill/:id/stream — chat de autocompletado del propio perfil
router.post('/profile-fill/:id/stream', autenticarUsuario, authenticatedLimiter, chatLimiter, askProfileFillStream);
// GET /api/chat/my-conversations — candidatos con los que hablé (para el sidebar del chat propio)
router.get('/my-conversations', autenticarUsuario, authenticatedLimiter, listMyConversations);

export default router;
