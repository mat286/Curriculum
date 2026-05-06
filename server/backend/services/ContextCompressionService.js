import logger from '../utils/logger.js';

/**
 * ContextCompressionService
 * 
 * Compresión inteligente de contexto para reducir tokens enviados a Gemini.
 * Target: Reducir ~2800 tokens → <2000 tokens (25-30% reduction)
 * 
 * Estrategias:
 * 1. Detectar y eliminar redundancia entre CV y embeddings semánticos
 * 2. Resumir CV por relevancia a la pregunta
 * 3. Limitar conversation history a últimas 3 exchanges
 * 4. Loguear compression stats para auditoría
 */
export class ContextCompressionService {
    constructor() {
        this.enableCompression = process.env.ENABLE_CONTEXT_COMPRESSION !== 'false';
        this.conversationMaxExchanges = parseInt(process.env.CONVERSATION_MAX_EXCHANGES || '3', 10);
        this.cvRelevanceThreshold = parseFloat(process.env.CV_RELEVANCE_THRESHOLD || '0.5');
    }

    /**
     * Detecta si el contenido del embedding ya está cubierto en el CV.
     * Usa normalización simple para comparar similitud textual.
     */
    _isRedundant(embeddingText, cvText, threshold = 0.6) {
        if (!embeddingText || !cvText) return false;

        const normalize = (text) =>
            String(text || '')
                .toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .split(/\s+/)
                .filter(Boolean);

        const embeddingWords = new Set(normalize(embeddingText));
        const cvWords = new Set(normalize(cvText));

        if (embeddingWords.size === 0 || cvWords.size === 0) return false;

        const intersection = [...embeddingWords].filter((w) => cvWords.has(w)).length;
        const overlap = intersection / Math.min(embeddingWords.size, cvWords.size);

        return overlap >= threshold;
    }

    /**
     * Elimina embeddings redundantes respecto al CV.
     * Retorna lista filtrada de chunks semánticos.
     */
    deduplicateSemanticContext(semanticChunks, cvText) {
        if (!this.enableCompression || !semanticChunks || semanticChunks.length === 0) {
            return { dedupedChunks: semanticChunks, removedCount: 0 };
        }

        const dedupedChunks = [];
        let removedCount = 0;

        for (const chunk of semanticChunks) {
            if (this._isRedundant(chunk, cvText, 0.65)) {
                removedCount++;
                logger.debug(
                    { chunk: chunk.slice(0, 50), removed: true },
                    'Semantic chunk redundante, removido',
                );
            } else {
                dedupedChunks.push(chunk);
            }
        }

        return { dedupedChunks, removedCount };
    }

    /**
     * Resume el CV por secciones, priorizando relevancia a la pregunta.
     * Selecciona solo secciones mencionadas en selectedSections + prioriza por pregunta.
     */
    summarizeCV(profileContext, question, selectedSections = []) {
        if (!this.enableCompression || !profileContext) {
            return { compressedProfile: profileContext, originalTokens: 0, compressedTokens: 0 };
        }

        const originalTokens = Math.ceil(JSON.stringify(profileContext).length / 4);
        const compressedProfile = { ...profileContext };

        // Limitar arrays en CV
        const limits = {
            experiencia_laboral: 3,
            educacion: 2,
            cursos: 2,
            proyectos: 2,
            habilidades: 10,
            respuestas_entrevista: 2,
        };

        for (const [key, maxLen] of Object.entries(limits)) {
            if (Array.isArray(compressedProfile[key]) && compressedProfile[key].length > maxLen) {
                compressedProfile[key] = compressedProfile[key].slice(0, maxLen);
                logger.debug({ key, maxLen }, 'CV section trimmed');
            }
        }

        const compressedTokens = Math.ceil(JSON.stringify(compressedProfile).length / 4);
        const compressionRatio = (1 - compressedTokens / originalTokens) * 100;

        return {
            compressedProfile,
            originalTokens,
            compressedTokens,
            reductionPercentage: compressionRatio.toFixed(2),
        };
    }

    /**
     * Limita conversation history a últimas N exchanges (2*N mensajes).
     * Retorna resumen si hay más exchanges antiguos.
     */
    compressConversationMemory(memory, maxExchanges = 3) {
        if (!memory || !Array.isArray(memory.history)) {
            return { compressedMemory: memory, truncated: false, truncatedCount: 0 };
        }

        const maxMessages = maxExchanges * 2; // user + assistant
        if (memory.history.length <= maxMessages) {
            return { compressedMemory: memory, truncated: false, truncatedCount: 0 };
        }

        const recentHistory = memory.history.slice(-maxMessages);
        const truncatedCount = memory.history.length - maxMessages;

        const compressedMemory = {
            ...memory,
            history: recentHistory,
            _truncated: {
                originalLength: memory.history.length,
                recentLength: recentHistory.length,
                truncatedCount,
            },
        };

        logger.debug(
            { truncatedCount, recentLength: recentHistory.length },
            'Conversation history comprimido',
        );

        return { compressedMemory, truncated: true, truncatedCount };
    }

    /**
     * Ejecuta pipeline de compresión completo.
     * Retorna contexto comprimido + stats para logging.
     */
    compress({
        profileContext,
        semanticContext = [],
        conversationMemory,
        selectedSections = [],
        question,
        requestId,
    }) {
        const stats = {
            requestId,
            compressionEnabled: this.enableCompression,
            steps: {},
        };

        let cvContext = profileContext;
        let semanticChunks = semanticContext;
        let memoryContext = conversationMemory;

        // Paso 1: Comprimir CV
        if (this.enableCompression && cvContext) {
            const cvResult = this.summarizeCV(cvContext, question, selectedSections);
            cvContext = cvResult.compressedProfile;
            stats.steps.cv_compression = {
                originalTokens: cvResult.originalTokens,
                compressedTokens: cvResult.compressedTokens,
                reductionPercentage: cvResult.reductionPercentage,
            };
        }

        // Paso 2: Deduplicar embeddings vs CV
        if (this.enableCompression && semanticChunks.length > 0 && cvContext) {
            const cvJson = JSON.stringify(cvContext);
            const dedupeResult = this.deduplicateSemanticContext(semanticChunks, cvJson);
            semanticChunks = dedupeResult.dedupedChunks;
            stats.steps.semantic_deduplication = {
                originalCount: semanticContext.length,
                dedupedCount: semanticChunks.length,
                removedCount: dedupeResult.removedCount,
            };
        }

        // Paso 3: Comprimir conversation memory
        if (this.enableCompression && memoryContext) {
            const memResult = this.compressConversationMemory(memoryContext, this.conversationMaxExchanges);
            memoryContext = memResult.compressedMemory;
            stats.steps.conversation_compression = {
                truncated: memResult.truncated,
                truncatedCount: memResult.truncatedCount,
            };
        }

        // Paso 4: Calcular tokens totales (estimación)
        const estimateTokens = (obj) => {
            if (!obj) return 0;
            const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
            return Math.ceil(json.length / 4);
        };

        const totalTokensCompressed =
            estimateTokens(cvContext) +
            estimateTokens(semanticChunks.join(' ')) +
            estimateTokens(memoryContext);

        stats.totalTokensEstimate = totalTokensCompressed;
        stats.compressionTimestamp = new Date().toISOString();

        logger.info(stats, 'Context compression completed');

        return {
            profileContext: cvContext,
            semanticContext: semanticChunks,
            conversationMemory: memoryContext,
            stats,
        };
    }
}
