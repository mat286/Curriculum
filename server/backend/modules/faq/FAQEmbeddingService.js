import { getEmbedding } from '../../services/ollamaService.js';

export class FAQEmbeddingService {
    async buildEmbedding(text) {
        const embedding = await getEmbedding(text);
        return {
            embedding,
            model: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
        };
    }
}
