import express from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import {
	getProfile,
	getBasicData,
	updateProfile,
	uploadOnboardingPhoto,
	saveOnboardingStep,
	completeOnboarding,
} from '../controllers/userController.js';

const router = express.Router();

router.get('/:id', autenticarUsuario, getProfile);
router.get('/:id/data', autenticarUsuario, getBasicData);
router.put('/:id/data', autenticarUsuario, updateProfile);
router.post('/:id/photo', autenticarUsuario, uploadOnboardingPhoto);
router.put('/:id/onboarding', autenticarUsuario, saveOnboardingStep);
router.put('/:id/onboarding/complete', autenticarUsuario, completeOnboarding);

export default router;
