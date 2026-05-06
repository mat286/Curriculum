import { getOrCreateCollection } from '../../config/chroma.js';
import { getEmbedding } from '../../services/ollamaService.js';
import logger from '../../utils/logger.js';
import { HybridSearchService } from '../../services/HybridSearchService.js';
import { ReRankingService } from '../../services/ReRankingService.js';

const SECTION_TO_METADATA_TYPES = {
    usuario: ['datos_personales'],
    sobre_mi: ['sobre_mi'],
    experiencia_laboral: ['experiencia_laboral'],
    educacion: ['educacion'],
    cursos: ['cursos'],
    proyectos: ['proyectos'],
    habilidades: ['habilidades'],
    idiomas: ['idiomas'],
    respuestas_entrevista: ['respuestas_entrevista'],
};

const SECTION_TO_DOMAINS = {
    usuario: ['candidate_summary_embedding'],
    sobre_mi: ['candidate_summary_embedding'],
    experiencia_laboral: ['candidate_experience_embedding'],
    educacion: ['candidate_education_embedding'],
    cursos: ['candidate_education_embedding'],
    proyectos: ['candidate_projects_embedding'],
    habilidades: ['candidate_skills_embedding'],
    idiomas: ['candidate_languages_embedding'],
    respuestas_entrevista: ['candidate_faq_embedding'],
};

function withTimeout(promise, ms, fallback) {
    let timer;
    return Promise.race([
        promise,
        new Promise((resolve) => {
            timer = setTimeout(() => resolve(fallback), ms);
        }),
    ]).finally(() => clearTimeout(timer));
}

function normalizeForDedupe(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function truncateChunk(text, maxChars) {
    if (!text) return '';
    if (!Number.isFinite(maxChars) || maxChars <= 0) return String(text);
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}...`;
}

export class TargetedSemanticRetriever {
    constructor() {
        this.enableHybridSearch = process.env.ENABLE_HYBRID_SEARCH !== 'false';
        this.enableReranking = process.env.ENABLE_RERANKING !== 'false';
        this.hybridService = new HybridSearchService();
        this.rerankingService = new ReRankingService();
    }

    async retrieve({
        candidateId,
        query,
        includeSections = [],
        topK = 3,
        timeoutMs = 500,
        minSimilarity = 0.68,
        profileContext = null,
        requestId = null,
    }) {
        const started = Date.now();

        try {
            const chunkMaxChars = parseInt(process.env.SEMANTIC_CHUNK_MAX_CHARS || '420', 10);
            const normalizedTopK = Number.isFinite(topK) && topK > 0 ? topK : 3;
            const expandedTopK = Math.max(normalizedTopK * 3, normalizedTopK);
            const allowedTypes = includeSections
                .flatMap((section) => SECTION_TO_METADATA_TYPES[section] || [])
                .filter(Boolean);
            const allowedDomains = includeSections
                .flatMap((section) => SECTION_TO_DOMAINS[section] || [])
                .filter(Boolean);

            const collection = await getOrCreateCollection(candidateId);
            const embedding = await getEmbedding(query);

            let result = null;
            if (allowedTypes.length > 0) {
                try {
                    result = await withTimeout(
                        collection.query({
                            queryEmbeddings: [embedding],
                            nResults: expandedTopK,
                            where: { type: { $in: allowedTypes } },
                        }),
                        timeoutMs,
                        null,
                    );
                } catch {
                    result = null;
                }
            }

            if (!result) {
                result = await withTimeout(
                    collection.query({ queryEmbeddings: [embedding], nResults: expandedTopK }),
                    timeoutMs,
                    null,
                );
            }

            if (!result) {
                return { chunks: [], reason: 'semantic-timeout', durationMs: Date.now() - started };
            }

            const docs = result.documents?.[0] || [];
            const metadatas = result.metadatas?.[0] || [];
            const distances = result.distances?.[0] || [];

            const semanticChunks = [];
            const dedupeSeen = new Set();
            let preDedupeCount = 0;

            for (let i = 0; i < docs.length; i++) {
                const type = metadatas[i]?.type;
                const domain = metadatas[i]?.embedding_domain;
                const similarity = 1 - (distances[i] ?? 1);

                if (allowedTypes.length > 0 && type && !allowedTypes.includes(type)) continue;
                if (allowedDomains.length > 0 && domain && !allowedDomains.includes(domain)) continue;
                if (similarity < minSimilarity) continue;
                preDedupeCount += 1;

                const rawChunk = docs[i] || '';
                const dedupeKey = normalizeForDedupe(rawChunk);
                if (dedupeKey.length > 0 && dedupeSeen.has(dedupeKey)) continue;
                if (dedupeKey.length > 0) dedupeSeen.add(dedupeKey);

                semanticChunks.push(truncateChunk(rawChunk, chunkMaxChars));
            }

            let finalChunks = semanticChunks;
            let hybridStats = null;
            let rerankingStats = null;
            let method = 'semantic';

            if (this.enableHybridSearch && profileContext) {
                const hybridResult = this.hybridService.search({
                    query,
                    profileContext,
                    semanticResults: semanticChunks,
                    candidateId,
                    requestId,
                });
                finalChunks = hybridResult.results;
                hybridStats = hybridResult.stats;
                method = 'hybrid';

                if (this.enableReranking) {
                    const rerankingResult = this.rerankingService.rerankWithoutEmbeddings({
                        results: finalChunks,
                        question: query,
                        candidateId,
                        requestId,
                    });

                    finalChunks = rerankingResult.rankedResults.map((r) => r.text);
                    rerankingStats = rerankingResult.stats;
                }
            }

            return {
                chunks: finalChunks.slice(0, normalizedTopK),
                reason: 'ok',
                durationMs: Date.now() - started,
                topKRequested: normalizedTopK,
                chunkStats: {
                    beforeDedupe: preDedupeCount,
                    afterDedupe: semanticChunks.length,
                    chunkMaxChars,
                },
                method,
                hybridStats,
                rerankingStats,
            };
        } catch (error) {
            logger.warn({ err: error, candidateId, requestId }, 'Targeted semantic retriever fallback');
            return { chunks: [], reason: 'error', durationMs: Date.now() - started };
        }
    }
}
