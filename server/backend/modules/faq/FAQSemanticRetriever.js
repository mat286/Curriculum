import { createCache } from '../../utils/chatHelpers.js';
import logger from '../../utils/logger.js';
import { FAQService } from './FAQService.js';
import { FAQEmbeddingService } from './FAQEmbeddingService.js';

function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const den = Math.sqrt(normA) * Math.sqrt(normB);
    if (!den) return 0;
    return dot / den;
}

function lexicalOverlapBoost(query, faqQuestion) {
    const qTokens = new Set((query || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);
    const fTokens = new Set((faqQuestion || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);
    if (!qTokens.size || !fTokens.size) return 0;

    let overlap = 0;
    for (const token of qTokens) {
        if (fTokens.has(token)) overlap += 1;
    }

    const ratio = overlap / Math.max(1, qTokens.size);
    if (ratio >= 0.5) return 0.05;
    if (ratio >= 0.3) return 0.03;
    return 0;
}

export class FAQSemanticRetriever {
    constructor() {
        this.faqService = new FAQService();
        this.embeddingService = new FAQEmbeddingService();
        this.cache = createCache(5 * 60 * 1000, 1000);
        this.threshold = parseFloat(process.env.FAQ_SIMILARITY_THRESHOLD || '0.72');
    }

    async findBestMatch({ candidateId, question }) {
        const normalized = question.trim().toLowerCase();
        const key = `faq:${candidateId}:${normalized}`;
        const cached = this.cache.get(key);
        if (cached) return cached;

        try {
            const faqs = await this.faqService.list(candidateId, false);
            if (!faqs.length) {
                const nohit = { hit: false, similarity: 0, faq: null };
                this.cache.set(key, nohit);
                return nohit;
            }

            const { embedding: queryEmbedding } = await this.embeddingService.buildEmbedding(normalized);

            let best = null;
            for (const faq of faqs) {
                const base = cosineSimilarity(queryEmbedding, faq.embedding);
                const boost = lexicalOverlapBoost(normalized, faq.question) + (faq.priority >= 90 ? 0.03 : 0);
                const sim = Math.min(1, base + boost);
                if (!best || sim > best.similarity) {
                    best = { faq, similarity: sim };
                }
            }

            if (!best || best.similarity < this.threshold) {
                const nohit = { hit: false, similarity: best?.similarity || 0, faq: null };
                this.cache.set(key, nohit);
                return nohit;
            }

            const hit = {
                hit: true,
                similarity: best.similarity,
                faq: {
                    id: best.faq.id,
                    question: best.faq.question,
                    answer: best.faq.answer,
                    priority: best.faq.priority,
                },
            };
            this.cache.set(key, hit);
            return hit;
        } catch (error) {
            logger.warn({ err: error, candidateId }, 'FAQ retriever error, fallback sin FAQ');
            return { hit: false, similarity: 0, faq: null };
        }
    }
}
