import express from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { chatLimiter } from '../middlewares/rateLimiter.js';
import { ask } from '../controllers/chatController.js';

const router = express.Router();

router.post('/ask', autenticarUsuario, chatLimiter, ask);

export default router;
