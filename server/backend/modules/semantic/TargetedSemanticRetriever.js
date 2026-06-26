import { getOrCreateCollection } from '../../config/chroma.js';
import { getEmbedding } from '../../services/ollamaService.js';
import logger from '../../utils/logger.js';
import { HybridSearchService } from '../../services/HybridSearchService.js';
import { withTimeout } from '../../utils/chatHelpers.js';
import { normalizeText as normalizeForDedupe, toTokenSet, jaccardSimilarity } from '../../utils/textUtils.js';

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

const INTENT_TO_METADATA_TYPES = {
    work_experience: ['experiencia_laboral', 'proyectos'],
    education: ['educacion', 'cursos'],
    skills: ['habilidades', 'proyectos'],
    projects: ['proyectos', 'habilidades'],
    technologies: ['habilidades', 'proyectos', 'experiencia_laboral'],
    languages: ['idiomas'],
    contact: ['datos_personales'],
    social: ['datos_personales'],
    availability: ['datos_personales'],
    summary: ['sobre_mi', 'experiencia_laboral'],
    personal: ['datos_personales'],
    faq_candidate: ['respuestas_entrevista'],
};

const DEFAULT_QUERY_TYPE_SIMILARITY = {
    fact: 0.74,
    detail: 0.69,
    general: 0.66,
};

function truncateChunk(text, maxChars) {
    if (!text) return '';
    if (!Number.isFinite(maxChars) || maxChars <= 0) return String(text);
    if (text.length <= maxChars) return text;
    return `${text.slice(0, maxChars)}...`;
}

function parseSimilarityByTypeEnv() {
    const raw = process.env.SEMANTIC_MIN_SIMILARITY_BY_TYPE;
    if (!raw) return DEFAULT_QUERY_TYPE_SIMILARITY;

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return DEFAULT_QUERY_TYPE_SIMILARITY;
        }

        return {
            fact: Number.isFinite(parsed.fact)
                ? Math.max(0, Math.min(1, parsed.fact))
                : DEFAULT_QUERY_TYPE_SIMILARITY.fact,
            detail: Number.isFinite(parsed.detail)
                ? Math.max(0, Math.min(1, parsed.detail))
                : DEFAULT_QUERY_TYPE_SIMILARITY.detail,
            general: Number.isFinite(parsed.general)
                ? Math.max(0, Math.min(1, parsed.general))
                : DEFAULT_QUERY_TYPE_SIMILARITY.general,
        };
    } catch {
        return DEFAULT_QUERY_TYPE_SIMILARITY;
    }
}

export class TargetedSemanticRetriever {
    constructor() {
        this.enableHybridSearch = process.env.ENABLE_HYBRID_SEARCH !== 'false';
        this.similarityByType = parseSimilarityByTypeEnv();
        this.semanticNearDuplicateThreshold = parseFloat(
            process.env.SEMANTIC_NEAR_DUPLICATE_THRESHOLD || '0.9',
        );
        this.hybridService = new HybridSearchService();
    }

    resolveEffectiveSimilarity({ minSimilarity, queryType, intent, intentConfidence }) {
        const normalizedType = String(queryType || 'general').toLowerCase();
        const typeThreshold = this.similarityByType[normalizedType] ?? this.similarityByType.general;

        let threshold = Number.isFinite(minSimilarity)
            ? Math.max(minSimilarity, typeThreshold)
            : typeThreshold;

        // Consultas factuales o de alta confianza requieren chunks más precisos.
        const factualIntents = new Set(['contact', 'social', 'availability', 'faq_candidate', 'personal']);
        if (factualIntents.has(intent)) {
            threshold += 0.04;
        }
        if (typeof intentConfidence === 'number' && intentConfidence >= 0.9) {
            threshold += 0.02;
        }

        return Math.max(0, Math.min(0.95, threshold));
    }

    async retrieve({
        candidateId,
        query,
        includeSections = [],
        topK = 3,
        timeoutMs = 500,
        minSimilarity = 0.68,
        intent = 'general',
        intentConfidence = null,
        queryType = 'general',
        profileContext = null,
        requestId = null,
    }) {
        const started = Date.now();

        try {
            const chunkMaxChars = parseInt(process.env.SEMANTIC_CHUNK_MAX_CHARS || '420', 10);
            const normalizedTopK = Number.isFinite(topK) && topK > 0 ? topK : 3;
            const expandedTopK = Math.max(normalizedTopK * 3, normalizedTopK);
            const sectionTypes = includeSections
                .flatMap((section) => SECTION_TO_METADATA_TYPES[section] || [])
                .filter(Boolean);
            const intentTypes = INTENT_TO_METADATA_TYPES[intent] || [];
            const allowedTypes = [...new Set([...sectionTypes, ...intentTypes])];
            const allowedDomains = includeSections
                .flatMap((section) => SECTION_TO_DOMAINS[section] || [])
                .filter(Boolean);
            const effectiveMinSimilarity = this.resolveEffectiveSimilarity({
                minSimilarity,
                queryType,
                intent,
                intentConfidence,
            });

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
            let droppedBySimilarity = 0;
            let droppedByNearDuplicate = 0;

            for (let i = 0; i < docs.length; i++) {
                const type = metadatas[i]?.type;
                const domain = metadatas[i]?.embedding_domain;
                const similarity = 1 - (distances[i] ?? 1);

                if (allowedTypes.length > 0 && type && !allowedTypes.includes(type)) continue;
                if (allowedDomains.length > 0 && domain && !allowedDomains.includes(domain)) continue;
                if (similarity < effectiveMinSimilarity) {
                    droppedBySimilarity += 1;
                    continue;
                }
                preDedupeCount += 1;

                const rawChunk = docs[i] || '';
                const dedupeKey = normalizeForDedupe(rawChunk);
                if (dedupeKey.length > 0 && dedupeSeen.has(dedupeKey)) continue;

                let isNearDuplicate = false;
                for (const existingChunk of semanticChunks) {
                    const overlap = jaccardSimilarity(rawChunk, existingChunk);
                    if (overlap >= this.semanticNearDuplicateThreshold) {
                        isNearDuplicate = true;
                        break;
                    }
                }
                if (isNearDuplicate) {
                    droppedByNearDuplicate += 1;
                    continue;
                }

                if (dedupeKey.length > 0) dedupeSeen.add(dedupeKey);

                semanticChunks.push(truncateChunk(rawChunk, chunkMaxChars));
            }

            let finalChunks = semanticChunks;
            let hybridStats = null;
            let method = 'semantic';

            if (this.enableHybridSearch && profileContext) {
                const hybridResult = this.hybridService.search({
                    query,
                    profileContext,
                    semanticResults: semanticChunks,
                    includeSections,
                    queryType,
                    candidateId,
                    requestId,
                });
                finalChunks = hybridResult.results;
                hybridStats = hybridResult.stats;
                method = 'hybrid';

            }

            return {
                chunks: finalChunks.slice(0, normalizedTopK),
                reason: 'ok',
                durationMs: Date.now() - started,
                topKRequested: normalizedTopK,
                chunkStats: {
                    beforeDedupe: preDedupeCount,
                    afterDedupe: semanticChunks.length,
                    droppedBySimilarity,
                    droppedByNearDuplicate,
                    effectiveMinSimilarity,
                    chunkMaxChars,
                },
                method,
                hybridStats,
            };
        } catch (error) {
            logger.warn({ err: error, candidateId, requestId }, 'Targeted semantic retriever fallback');
            return { chunks: [], reason: 'error', durationMs: Date.now() - started };
        }
    }
}
