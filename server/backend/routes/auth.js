import express from 'express';
import { loginWithGoogle, refreshToken, logout } from '../controllers/authController.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.post('/google', authLimiter, loginWithGoogle);
router.post('/login', authLimiter, loginWithGoogle);
router.post('/refresh', authLimiter, refreshToken);
router.post('/logout', authLimiter, logout);

export default router;
