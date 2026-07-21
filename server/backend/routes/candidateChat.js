import { Router } from 'express';
import { autenticarUsuario, autenticarUsuarioOpcional } from '../middlewares/authMiddleware.js';
import { authenticatedLimiter, chatLimiter } from '../middlewares/rateLimiter.js';
import { askCandidate, askCandidateStream, listMyConversations } from '../controllers/candidateChatController.js';
import { askProfileFillStream } from '../controllers/profileFillChatController.js';

const router = Router();

// Chat con candidato — público (sin login), para que un link compartido
// funcione directo. CandidateAggregateService ya resuelve el acceso con
// is_public=1 OR self, y chatLimiter cae a rate-limit por IP si no hay user.
// POST /api/chat/candidate/:id — chat con candidato (respuesta completa)
router.post('/candidate/:id', autenticarUsuarioOpcional, authenticatedLimiter, chatLimiter, askCandidate);
// POST /api/chat/candidate/:id/stream — chat con candidato via SSE streaming
router.post('/candidate/:id/stream', autenticarUsuarioOpcional, authenticatedLimiter, chatLimiter, askCandidateStream);
// POST /api/chat/profile-fill/:id/stream — chat de autocompletado del propio perfil
router.post('/profile-fill/:id/stream', autenticarUsuario, authenticatedLimiter, chatLimiter, askProfileFillStream);
// GET /api/chat/my-conversations — candidatos con los que hablé (para el sidebar del chat propio)
router.get('/my-conversations', autenticarUsuario, authenticatedLimiter, listMyConversations);

export default router;
