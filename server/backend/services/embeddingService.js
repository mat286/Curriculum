import { getOrCreateCollection, getOrCreateGlobalCollection } from '../config/chroma.js';
import crypto from 'crypto';
import { getEmbedding, getEmbeddings } from './ollamaService.js';
import { getFullProfile } from './dataService.js';
import { embeddingMetadataRepository } from './EmbeddingMetadataRepository.js';
import logger from '../utils/logger.js';
import { HybridSearchService } from './HybridSearchService.js';

const hybridSearchService = new HybridSearchService();

function buildContentHash(content) {
    return crypto.createHash('sha256').update(String(content || '')).digest('hex');
}

function resolveSearchArgs(topKOrOptions, maybeOptions) {
    let topK = 3;
    let options = {};

    if (typeof topKOrOptions === 'number') {
        topK = topKOrOptions;
        options = maybeOptions && typeof maybeOptions === 'object' ? maybeOptions : {};
    } else if (topKOrOptions && typeof topKOrOptions === 'object') {
        options = topKOrOptions;
        topK = Number.parseInt(options.topKHint ?? options.topK ?? 3, 10);
    }

    if (!Number.isFinite(topK) || topK <= 0) {
        topK = 3;
    }

    return { topK, options };
}

/**
 * Convierte los datos del perfil en documentos para indexar.
 */
function profileToDocuments(profile) {
    const docs = [];
    const { usuario } = profile;

    if (profile.sobre_mi?.length > 0) {
        docs.push({
            id: 'sobre_mi',
            text: `Sobre mí: ${profile.sobre_mi[0].descripcion}`,
            metadata: { type: 'sobre_mi', embedding_domain: 'candidate_summary_embedding' },
        });
    }

    if (profile.experiencia_laboral?.length > 0) {
        profile.experiencia_laboral.forEach((exp, i) => {
            const actual = exp.actualmente ? ' (actualmente)' : '';
            docs.push({
                id: `exp_${i}`,
                text: `Experiencia laboral: ${exp.puesto} en ${exp.empresa}${actual}. ${exp.descripcion || ''}. Período: ${exp.fecha_inicio || '?'} - ${exp.fecha_fin || 'presente'}`,
                metadata: { type: 'experiencia_laboral', embedding_domain: 'candidate_experience_embedding' },
            });
        });
    }

    if (profile.educacion?.length > 0) {
        profile.educacion.forEach((edu, i) => {
            docs.push({
                id: `edu_${i}`,
                text: `Educación: ${edu.titulo} en ${edu.institucion}. Nivel: ${edu.nivel || 'N/A'}. Período: ${edu.fecha_inicio || '?'} - ${edu.fecha_fin || 'presente'}`,
                metadata: { type: 'educacion', embedding_domain: 'candidate_education_embedding' },
            });
        });
    }

    if (profile.cursos?.length > 0) {
        profile.cursos.forEach((c, i) => {
            docs.push({
                id: `curso_${i}`,
                text: `Curso: ${c.nombre} en ${c.institucion}. ${c.descripcion || ''}`,
                metadata: { type: 'cursos', embedding_domain: 'candidate_education_embedding' },
            });
        });
    }

    if (profile.proyectos?.length > 0) {
        profile.proyectos.forEach((p, i) => {
            docs.push({
                id: `proy_${i}`,
                text: `Proyecto: ${p.nombre}. ${p.descripcion || ''}. Tecnologías: ${p.tecnologias || 'N/A'}`,
                metadata: { type: 'proyectos', embedding_domain: 'candidate_projects_embedding' },
            });
        });
    }

    if (profile.habilidades?.length > 0) {
        const skills = profile.habilidades.map(h => h.nombre).join(', ');
        docs.push({
            id: 'habilidades',
            text: `Habilidades y tecnologías: ${skills}`,
            metadata: { type: 'habilidades', embedding_domain: 'candidate_skills_embedding' },
        });
    }

    if (profile.idiomas?.length > 0) {
        const langs = profile.idiomas.map(i => `${i.idioma} (${i.nivel || 'N/A'})`).join(', ');
        docs.push({
            id: 'idiomas',
            text: `Idiomas: ${langs}`,
            metadata: { type: 'idiomas', embedding_domain: 'candidate_languages_embedding' },
        });
    }

    if (profile.respuestas_entrevista?.length > 0) {
        profile.respuestas_entrevista.forEach((r, i) => {
            docs.push({
                id: `resp_${i}`,
                text: `Pregunta frecuente: "${r.pregunta}" - Respuesta: "${r.respuesta}"`,
                metadata: { type: 'respuestas_entrevista', embedding_domain: 'candidate_faq_embedding' },
            });
        });
    }

    if (usuario) {
        const parts = [];
        if (usuario.nombre || usuario.apellido) parts.push(`Nombre: ${usuario.nombre} ${usuario.apellido}`);
        if (usuario.email) parts.push(`Email: ${usuario.email}`);
        if (usuario.telefono) parts.push(`Teléfono: ${usuario.telefono}`);
        if (usuario.nacionalidad) parts.push(`Nacionalidad: ${usuario.nacionalidad}`);
        if (usuario.direccion) parts.push(`Dirección: ${usuario.direccion}`);
        if (usuario.resumen) parts.push(`Resumen: ${usuario.resumen}`);
        if (parts.length > 0) {
            docs.push({
                id: 'datos_personales',
                text: `Datos personales: ${parts.join('. ')}`,
                metadata: { type: 'datos_personales', embedding_domain: 'candidate_summary_embedding' },
            });
        }
    }

    return docs;
}

/**
 * Indexa todos los datos de un usuario en ChromaDB.
 * También actualiza la colección global 'all_candidates'.
 */
export async function indexUserData(userId) {
    try {
        const profile = await getFullProfile(userId);
        if (!profile) {
            logger.warn({ userId }, 'No se encontró perfil para indexar');
            return false;
        }

        const docs = profileToDocuments(profile);
        if (docs.length === 0) {
            logger.info({ userId }, 'Sin documentos para indexar');
            return false;
        }

        const docsWithHash = docs.map((doc) => ({
            ...doc,
            contentHash: buildContentHash(doc.text),
            charCount: String(doc.text || '').length,
        }));

        // Eliminar colección individual anterior y recrear
        await deleteUserIndex(userId);
        const collection = await getOrCreateCollection(userId);

        // Generar embeddings por lotes usando /api/embed para reducir overhead de red.
        const BATCH = Number.parseInt(process.env.EMBEDDING_INDEX_BATCH_SIZE || '12', 10);
        const batchSize = Number.isFinite(BATCH) && BATCH > 0 ? BATCH : 12;
        const embeddings = [];
        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = docsWithHash.slice(i, i + batchSize);
            const batchTexts = batch.map((doc) => doc.text);
            const batchEmbeddings = await getEmbeddings(batchTexts);
            embeddings.push(...batchEmbeddings);
        }

        await collection.add({
            ids: docsWithHash.map(d => d.id),
            documents: docsWithHash.map(d => d.text),
            metadatas: docsWithHash.map(d => d.metadata),
            embeddings,
        });

        // Actualizar colección global: upsert con IDs con prefijo de usuario
        try {
            const globalCollection = await getOrCreateGlobalCollection();
            const globalIds = docsWithHash.map(d => `u${userId}_${d.id}`);
            const globalMetadatas = docsWithHash.map(d => ({ ...d.metadata, user_id: userId }));

            await globalCollection.upsert({
                ids: globalIds,
                documents: docsWithHash.map(d => d.text),
                metadatas: globalMetadatas,
                embeddings,
            });
        } catch (globalErr) {
            logger.warn({ err: globalErr, userId }, 'No se pudo actualizar colección global, continuando');
        }

        try {
            await embeddingMetadataRepository.markCandidateDocsInactive(userId);
            const docsMetadata = docsWithHash.map((doc) => ({
                docId: doc.id,
                docType: doc.metadata?.type,
                embeddingDomain: doc.metadata?.embedding_domain,
                contentHash: doc.contentHash,
                charCount: doc.charCount,
                tokenEstimate: Math.ceil(doc.charCount / 4),
                sourceTable: 'profile_compiled',
                sourceRowId: null,
                contentPreview: String(doc.text || '').slice(0, 512),
                embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
                embeddingProvider: process.env.AI_PROVIDER || 'ollama',
                collectionName: `user_${userId}_cv`,
                chromaDocId: doc.id,
            }));
            await embeddingMetadataRepository.upsertDocumentsMetadata(userId, docsMetadata);
        } catch (metadataErr) {
            logger.warn({ err: metadataErr, userId }, 'No se pudo persistir metadata de embeddings, continuando');
        }

        logger.info({ userId, docCount: docsWithHash.length }, 'Datos indexados en ChromaDB');
        return true;
    } catch (error) {
        logger.error({ err: error, userId }, 'Error indexando datos en ChromaDB');
        return false;
    }
}

/**
 * Busca documentos semánticamente similares al query.
 */
export async function search(query, userId, topKOrOptions = 3, maybeOptions = {}) {
    const started = Date.now();
    const { topK, options } = resolveSearchArgs(topKOrOptions, maybeOptions);
    const requestId = options?.requestId || null;
    const method = options?.method || 'semantic';
    const profileContext = options?.profileContext || null;

    try {
        const collection = await getOrCreateCollection(userId);
        const queryEmbedding = await getEmbedding(query);

        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: topK,
        });

        const hits = results.documents?.[0] || [];

        // Si hay profileContext disponible, enriquecer con búsqueda híbrida BM25+semantic
        let finalHits = hits;
        let finalMethod = method;

        if (profileContext && hits.length > 0) {
            try {
                const hybridResult = hybridSearchService.search({
                    query,
                    profileContext,
                    semanticResults: hits,
                    candidateId: userId,
                    requestId,
                });
                finalHits = hybridResult.results;
                finalMethod = hybridResult.method;
            } catch (hybridErr) {
                logger.warn({ err: hybridErr, userId }, 'Hybrid search falló, usando solo resultados semánticos');
            }
        }

        try {
            await embeddingMetadataRepository.recordQueryTelemetry({
                requestId,
                candidateId: userId,
                method: finalMethod,
                query,
                topK,
                hits: finalHits.length,
                durationMs: Date.now() - started,
            });
        } catch (telemetryErr) {
            logger.warn({ err: telemetryErr, userId, requestId }, 'No se pudo registrar telemetry de búsqueda semántica');
        }

        return finalHits;
    } catch (error) {
        logger.warn({ err: error, userId }, 'Error en búsqueda semántica, continuando sin embeddings');

        try {
            await embeddingMetadataRepository.recordQueryTelemetry({
                requestId,
                candidateId: userId,
                method: finalMethod ?? method,
                query,
                topK,
                hits: 0,
                durationMs: Date.now() - started,
            });
        } catch {
            // Telemetry no crítica
        }

        return [];
    }
}

/**
 * Elimina el índice de embeddings de un usuario.
 */
export async function deleteUserIndex(userId) {
    try {
        const { getChromaClient } = await import('../config/chroma.js');
        const client = getChromaClient();
        await client.deleteCollection({ name: `user_${userId}_cv` });
    } catch {
        // La colección puede no existir
    }
}

/**
 * Busca candidatos semánticamente similares al query en la colección global.
 * Retorna lista de { userId, score } ordenados por relevancia.
 */
export async function searchCandidates(query, topK = 10) {
    try {
        const globalCollection = await getOrCreateGlobalCollection();
        const queryEmbedding = await getEmbedding(query);

        const results = await globalCollection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: topK,
        });

        const docs = results.documents?.[0] || [];
        const metadatas = results.metadatas?.[0] || [];
        const distances = results.distances?.[0] || [];

        // Agrupar por user_id, tomar el score más alto por usuario
        const userScores = new Map();
        for (let i = 0; i < metadatas.length; i++) {
            const uid = metadatas[i]?.user_id;
            if (!uid) continue;
            const score = 1 - (distances[i] || 0); // cosine distance → similarity
            if (!userScores.has(uid) || score > userScores.get(uid).score) {
                userScores.set(uid, { userId: uid, score, snippet: docs[i] });
            }
        }

        return Array.from(userScores.values()).sort((a, b) => b.score - a.score);
    } catch (error) {
        logger.warn({ err: error }, 'Error en búsqueda global de candidatos');
        return [];
    }
}
