import { pool } from '../../config/db.js';
import { ValidationError, AuthError, NotFoundError } from '../../middlewares/errorHandler.js';
import { FAQEmbeddingService } from './FAQEmbeddingService.js';

const faqEmbedding = new FAQEmbeddingService();

function parseEmbedding(value) {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

export class FAQService {
    async assertOwnership(candidateId, requesterId) {
        if (!requesterId || requesterId !== candidateId) {
            throw new AuthError('Solo puedes gestionar tus propias FAQs');
        }
    }

    async list(candidateId, includeInactive = false) {
        const sql = includeInactive
            ? `SELECT id, candidate_id, question, answer, embedding, embedding_model, is_active, priority, created_at, updated_at
               FROM candidate_faqs WHERE candidate_id = ? ORDER BY priority DESC, updated_at DESC`
            : `SELECT id, candidate_id, question, answer, embedding, embedding_model, is_active, priority, created_at, updated_at
               FROM candidate_faqs WHERE candidate_id = ? AND is_active = 1 ORDER BY priority DESC, updated_at DESC`;

        const [rows] = await pool.query(sql, [candidateId]);
        return rows.map((r) => ({
            id: r.id,
            candidateId: r.candidate_id,
            question: r.question,
            answer: r.answer,
            embedding: parseEmbedding(r.embedding),
            embeddingModel: r.embedding_model,
            isActive: !!r.is_active,
            priority: r.priority,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }));
    }

    async create({ candidateId, question, answer, priority = 50 }) {
        if (!question?.trim() || !answer?.trim()) {
            throw new ValidationError('question y answer son obligatorios');
        }

        const payload = `${question.trim()}\n${answer.trim()}`;
        const { embedding, model } = await faqEmbedding.buildEmbedding(payload);

        const [result] = await pool.query(
            `INSERT INTO candidate_faqs (candidate_id, question, answer, embedding, embedding_model, is_active, priority)
             VALUES (?, ?, ?, ?, ?, 1, ?)`,
            [candidateId, question.trim(), answer.trim(), JSON.stringify(embedding), model, priority],
        );

        return { id: result.insertId, candidateId, question: question.trim(), answer: answer.trim(), priority, isActive: true };
    }

    async update({ candidateId, faqId, question, answer, priority, isActive }) {
        const [rows] = await pool.query('SELECT * FROM candidate_faqs WHERE id = ? AND candidate_id = ? LIMIT 1', [faqId, candidateId]);
        if (rows.length === 0) throw new NotFoundError('FAQ no encontrada');

        const current = rows[0];
        const nextQuestion = question?.trim() ?? current.question;
        const nextAnswer = answer?.trim() ?? current.answer;
        const nextPriority = Number.isFinite(priority) ? priority : current.priority;
        const nextIsActive = typeof isActive === 'boolean' ? (isActive ? 1 : 0) : current.is_active;

        let nextEmbedding = current.embedding;
        let nextModel = current.embedding_model;
        if (nextQuestion !== current.question || nextAnswer !== current.answer) {
            const payload = `${nextQuestion}\n${nextAnswer}`;
            const { embedding, model } = await faqEmbedding.buildEmbedding(payload);
            nextEmbedding = JSON.stringify(embedding);
            nextModel = model;
        }

        await pool.query(
            `UPDATE candidate_faqs
             SET question = ?, answer = ?, embedding = ?, embedding_model = ?, is_active = ?, priority = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND candidate_id = ?`,
            [nextQuestion, nextAnswer, nextEmbedding, nextModel, nextIsActive, nextPriority, faqId, candidateId],
        );

        return {
            id: faqId,
            candidateId,
            question: nextQuestion,
            answer: nextAnswer,
            priority: nextPriority,
            isActive: !!nextIsActive,
        };
    }

    async remove({ candidateId, faqId }) {
        const [result] = await pool.query('UPDATE candidate_faqs SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND candidate_id = ?', [faqId, candidateId]);
        if (!result.affectedRows) throw new NotFoundError('FAQ no encontrada');
        return { success: true };
    }
}
