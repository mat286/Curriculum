import { Router } from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { getCandidates } from '../controllers/candidatesController.js';

const router = Router();

// GET /api/candidates — lista de candidatos públicos
router.get('/', autenticarUsuario, getCandidates);

export default router;
