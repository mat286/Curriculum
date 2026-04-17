import { ChromaClient } from 'chromadb';

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';

let client = null;

export function getChromaClient() {
    if (!client) {
        client = new ChromaClient({ path: CHROMA_URL });
    }
    return client;
}

export async function getOrCreateCollection(userId) {
    const chroma = getChromaClient();
    return chroma.getOrCreateCollection({
        name: `user_${userId}_cv`,
        metadata: { 'hnsw:space': 'cosine' },
    });
}

export async function getOrCreateGlobalCollection() {
    const chroma = getChromaClient();
    return chroma.getOrCreateCollection({
        name: 'all_candidates',
        metadata: { 'hnsw:space': 'cosine' },
    });
}

export { CHROMA_URL };
