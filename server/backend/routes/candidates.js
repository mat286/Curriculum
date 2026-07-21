import { Router } from 'express';
import { autenticarUsuario, autenticarUsuarioOpcional } from '../middlewares/authMiddleware.js';
import { chatLimiter, faqLimiter } from '../middlewares/rateLimiter.js';
import { getCandidates } from '../controllers/candidatesController.js';
import {
	listCandidateFaqs,
	createCandidateFaq,
	updateCandidateFaq,
	deleteCandidateFaq,
} from '../controllers/candidateFaqController.js';

const router = Router();

// GET /api/candidates — lista de candidatos públicos, accesible sin login
// (necesario para que un link de chat compartido funcione sin cuenta).
router.get('/', autenticarUsuarioOpcional, chatLimiter, getCandidates);

// CRUD FAQs por candidato (owner only)
router.get('/:id/faqs', autenticarUsuario, faqLimiter, listCandidateFaqs);
router.post('/:id/faqs', autenticarUsuario, faqLimiter, createCandidateFaq);
router.put('/:id/faqs/:faqId', autenticarUsuario, faqLimiter, updateCandidateFaq);
router.delete('/:id/faqs/:faqId', autenticarUsuario, faqLimiter, deleteCandidateFaq);

export default router;
