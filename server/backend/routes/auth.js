import express from 'express';
import { loginWithGoogle } from '../controllers/authController.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.post('/google', authLimiter, loginWithGoogle);

export default router;
