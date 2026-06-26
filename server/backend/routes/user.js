import express from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
import { authenticatedLimiter } from '../middlewares/rateLimiter.js';
import {
	getProfile,
	getBasicData,
	updateProfile,
	createProfileSectionItem,
	updateProfileSectionItem,
	deleteProfileSectionItem,
	uploadOnboardingPhoto,
	saveOnboardingStep,
	completeOnboarding,
	updateUserRole,
} from '../controllers/userController.js';

const router = express.Router();

router.get('/:id', autenticarUsuario, authenticatedLimiter, getProfile);
router.get('/:id/data', autenticarUsuario, authenticatedLimiter, getBasicData);
router.put('/:id/data', autenticarUsuario, authenticatedLimiter, updateProfile);
router.patch('/:id/role', autenticarUsuario, authenticatedLimiter, updateUserRole);
router.post('/:id/section/:sectionKey', autenticarUsuario, authenticatedLimiter, createProfileSectionItem);
router.put('/:id/section/:sectionKey/:itemId', autenticarUsuario, authenticatedLimiter, updateProfileSectionItem);
router.delete('/:id/section/:sectionKey/:itemId', autenticarUsuario, authenticatedLimiter, deleteProfileSectionItem);
router.post('/:id/photo', autenticarUsuario, authenticatedLimiter, uploadOnboardingPhoto);
router.put('/:id/onboarding', autenticarUsuario, authenticatedLimiter, saveOnboardingStep);
router.put('/:id/onboarding/complete', autenticarUsuario, authenticatedLimiter, completeOnboarding);

export default router;
