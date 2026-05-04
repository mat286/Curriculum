import { getOrCreateCollection } from '../../config/chroma.js';
import { getEmbedding } from '../../services/ollamaService.js';
import logger from '../../utils/logger.js';

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

export class TargetedSemanticRetriever {
    async retrieve({ candidateId, query, includeSections, topK = 3, timeoutMs = 500, minSimilarity = 0.68 }) {
        const started = Date.now();
        try {
            const allowedTypes = includeSections
                .flatMap((section) => SECTION_TO_METADATA_TYPES[section] || [])
                .filter(Boolean);
            const allowedDomains = includeSections
                .flatMap((section) => SECTION_TO_DOMAINS[section] || [])
                .filter(Boolean);

            const embedding = await withTimeout(getEmbedding(query), timeoutMs, null);
            if (!embedding) {
                return { chunks: [], reason: 'embedding-timeout', durationMs: Date.now() - started };
            }

            const collection = await getOrCreateCollection(candidateId);
            let result = null;

            if (allowedTypes.length > 0) {
                try {
                    result = await withTimeout(
                        collection.query({
                            queryEmbeddings: [embedding],
                            nResults: topK,
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
                    collection.query({ queryEmbeddings: [embedding], nResults: topK * 2 }),
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

            const chunks = [];
            for (let i = 0; i < docs.length; i++) {
                const type = metadatas[i]?.type;
                const domain = metadatas[i]?.embedding_domain;
                const similarity = 1 - (distances[i] || 1);
                if (allowedTypes.length > 0 && type && !allowedTypes.includes(type)) continue;
                if (allowedDomains.length > 0 && domain && !allowedDomains.includes(domain)) continue;
                if (similarity < minSimilarity) continue;
                chunks.push(docs[i]);
                if (chunks.length >= topK) break;
            }

            return { chunks, reason: 'ok', durationMs: Date.now() - started };
        } catch (error) {
            logger.warn({ err: error, candidateId }, 'Targeted semantic retriever fallback');
            return { chunks: [], reason: 'error', durationMs: Date.now() - started };
        }
    }
}
