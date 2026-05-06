import express from 'express';
import { autenticarUsuario } from '../middlewares/authMiddleware.js';
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

router.get('/:id', autenticarUsuario, getProfile);
router.get('/:id/data', autenticarUsuario, getBasicData);
router.put('/:id/data', autenticarUsuario, updateProfile);
router.patch('/:id/role', autenticarUsuario, updateUserRole);
router.post('/:id/section/:sectionKey', autenticarUsuario, createProfileSectionItem);
router.put('/:id/section/:sectionKey/:itemId', autenticarUsuario, updateProfileSectionItem);
router.delete('/:id/section/:sectionKey/:itemId', autenticarUsuario, deleteProfileSectionItem);
router.post('/:id/photo', autenticarUsuario, uploadOnboardingPhoto);
router.put('/:id/onboarding', autenticarUsuario, saveOnboardingStep);
router.put('/:id/onboarding/complete', autenticarUsuario, completeOnboarding);

export default router;
