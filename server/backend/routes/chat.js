import express from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { authenticatedLimiter, chatLimiter } from '../middlewares/rateLimiter.js';
import { ask, askStream } from '../controllers/chatController.js';

const router = express.Router();

router.post('/ask', autenticarUsuario, authenticatedLimiter, chatLimiter, ask);
router.post('/ask/stream', autenticarUsuario, authenticatedLimiter, chatLimiter, askStream);

export default router;
