import { ValidationError } from '../middlewares/errorHandler.js';
import { FAQService } from '../modules/faq/FAQService.js';

const faqService = new FAQService();

function parseCandidateId(param) {
    const candidateId = parseInt(param, 10);
    if (isNaN(candidateId) || candidateId <= 0) {
        throw new ValidationError('ID de candidato inválido');
    }
    return candidateId;
}

function parseFaqId(param) {
    const faqId = parseInt(param, 10);
    if (isNaN(faqId) || faqId <= 0) {
        throw new ValidationError('ID de FAQ inválido');
    }
    return faqId;
}

export async function listCandidateFaqs(req, res, next) {
    try {
        const candidateId = parseCandidateId(req.params.id);
        await faqService.assertOwnership(candidateId, req.user?.id);
        const includeInactive = String(req.query.includeInactive || 'false').toLowerCase() === 'true';
        const faqs = await faqService.list(candidateId, includeInactive);
        res.json(faqs);
    } catch (error) {
        next(error);
    }
}

export async function createCandidateFaq(req, res, next) {
    try {
        const candidateId = parseCandidateId(req.params.id);
        await faqService.assertOwnership(candidateId, req.user?.id);

        const { question, answer, priority } = req.body || {};
        const created = await faqService.create({ candidateId, question, answer, priority });
        res.status(201).json(created);
    } catch (error) {
        next(error);
    }
}

export async function updateCandidateFaq(req, res, next) {
    try {
        const candidateId = parseCandidateId(req.params.id);
        const faqId = parseFaqId(req.params.faqId);
        await faqService.assertOwnership(candidateId, req.user?.id);

        const { question, answer, priority, isActive } = req.body || {};
        const updated = await faqService.update({ candidateId, faqId, question, answer, priority, isActive });
        res.json(updated);
    } catch (error) {
        next(error);
    }
}

export async function deleteCandidateFaq(req, res, next) {
    try {
        const candidateId = parseCandidateId(req.params.id);
        const faqId = parseFaqId(req.params.faqId);
        await faqService.assertOwnership(candidateId, req.user?.id);

        const result = await faqService.remove({ candidateId, faqId });
        res.json(result);
    } catch (error) {
        next(error);
    }
}
