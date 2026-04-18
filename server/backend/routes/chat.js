import express from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { chatLimiter } from '../middlewares/rateLimiter.js';
import { ask, askStream } from '../controllers/chatController.js';

const router = express.Router();

router.post('/ask', autenticarUsuario, chatLimiter, ask);
router.post('/ask/stream', autenticarUsuario, chatLimiter, askStream);

export default router;
