import { getOrCreateCollection, getOrCreateGlobalCollection } from '../config/chroma.js';
import { getEmbedding } from './ollamaService.js';
import { getFullProfile } from './dataService.js';
import logger from '../utils/logger.js';

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
            metadata: { type: 'sobre_mi' },
        });
    }

    if (profile.experiencia_laboral?.length > 0) {
        profile.experiencia_laboral.forEach((exp, i) => {
            const actual = exp.actualmente ? ' (actualmente)' : '';
            docs.push({
                id: `exp_${i}`,
                text: `Experiencia laboral: ${exp.puesto} en ${exp.empresa}${actual}. ${exp.descripcion || ''}. Período: ${exp.fecha_inicio || '?'} - ${exp.fecha_fin || 'presente'}`,
                metadata: { type: 'experiencia_laboral' },
            });
        });
    }

    if (profile.educacion?.length > 0) {
        profile.educacion.forEach((edu, i) => {
            docs.push({
                id: `edu_${i}`,
                text: `Educación: ${edu.titulo} en ${edu.institucion}. Nivel: ${edu.nivel || 'N/A'}. Período: ${edu.fecha_inicio || '?'} - ${edu.fecha_fin || 'presente'}`,
                metadata: { type: 'educacion' },
            });
        });
    }

    if (profile.cursos?.length > 0) {
        profile.cursos.forEach((c, i) => {
            docs.push({
                id: `curso_${i}`,
                text: `Curso: ${c.nombre} en ${c.institucion}. ${c.descripcion || ''}`,
                metadata: { type: 'cursos' },
            });
        });
    }

    if (profile.proyectos?.length > 0) {
        profile.proyectos.forEach((p, i) => {
            docs.push({
                id: `proy_${i}`,
                text: `Proyecto: ${p.nombre}. ${p.descripcion || ''}. Tecnologías: ${p.tecnologias || 'N/A'}`,
                metadata: { type: 'proyectos' },
            });
        });
    }

    if (profile.habilidades?.length > 0) {
        const skills = profile.habilidades.map(h => h.nombre).join(', ');
        docs.push({
            id: 'habilidades',
            text: `Habilidades y tecnologías: ${skills}`,
            metadata: { type: 'habilidades' },
        });
    }

    if (profile.idiomas?.length > 0) {
        const langs = profile.idiomas.map(i => `${i.idioma} (${i.nivel || 'N/A'})`).join(', ');
        docs.push({
            id: 'idiomas',
            text: `Idiomas: ${langs}`,
            metadata: { type: 'idiomas' },
        });
    }

    if (profile.respuestas_entrevista?.length > 0) {
        profile.respuestas_entrevista.forEach((r, i) => {
            docs.push({
                id: `resp_${i}`,
                text: `Pregunta frecuente: "${r.pregunta}" - Respuesta: "${r.respuesta}"`,
                metadata: { type: 'respuestas_entrevista' },
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
                metadata: { type: 'datos_personales' },
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

        // Eliminar colección individual anterior y recrear
        await deleteUserIndex(userId);
        const collection = await getOrCreateCollection(userId);

        // Generar embeddings para cada documento
        const embeddings = [];
        for (const doc of docs) {
            const embedding = await getEmbedding(doc.text);
            embeddings.push(embedding);
        }

        await collection.add({
            ids: docs.map(d => d.id),
            documents: docs.map(d => d.text),
            metadatas: docs.map(d => d.metadata),
            embeddings,
        });

        // Actualizar colección global: upsert con IDs con prefijo de usuario
        try {
            const globalCollection = await getOrCreateGlobalCollection();
            const globalIds = docs.map(d => `u${userId}_${d.id}`);
            const globalMetadatas = docs.map(d => ({ ...d.metadata, user_id: userId }));

            await globalCollection.upsert({
                ids: globalIds,
                documents: docs.map(d => d.text),
                metadatas: globalMetadatas,
                embeddings,
            });
        } catch (globalErr) {
            logger.warn({ err: globalErr, userId }, 'No se pudo actualizar colección global, continuando');
        }

        logger.info({ userId, docCount: docs.length }, 'Datos indexados en ChromaDB');
        return true;
    } catch (error) {
        logger.error({ err: error, userId }, 'Error indexando datos en ChromaDB');
        return false;
    }
}

/**
 * Busca documentos semánticamente similares al query.
 */
export async function search(query, userId, topK = 3) {
    try {
        const collection = await getOrCreateCollection(userId);
        const queryEmbedding = await getEmbedding(query);

        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: topK,
        });

        return results.documents?.[0] || [];
    } catch (error) {
        logger.warn({ err: error, userId }, 'Error en búsqueda semántica, continuando sin embeddings');
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
