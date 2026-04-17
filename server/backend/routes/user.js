import express from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { getProfile, getBasicData, updateProfile } from '../controllers/userController.js';

const router = express.Router();

router.get('/:id', autenticarUsuario, getProfile);
router.get('/:id/data', autenticarUsuario, getBasicData);
router.put('/:id/data', autenticarUsuario, updateProfile);

export default router;
