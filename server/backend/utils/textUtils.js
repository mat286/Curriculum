/**
 * utils/textUtils.js
 *
 * Utilidades de texto compartidas en todo el pipeline RAG.
 * Centraliza normalización, tokenización, similitud de Jaccard y coseno
 * que antes estaban duplicadas en 5+ archivos.
 */

/**
 * Normaliza texto para comparación: minúsculas, sin acentos, sin puntuación.
 * Variante "estricta" usada en deduplicación semántica.
 */
export function normalizeText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')   // quita diacríticos
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Tokeniza texto normalizado filtrando tokens de longitud <= 2.
 */
export function tokenize(text) {
    return normalizeText(text)
        .split(' ')
        .filter((t) => t.length > 2);
}

/**
 * Convierte texto en un Set de tokens (para operaciones de conjunto).
 */
export function toTokenSet(text) {
    return new Set(tokenize(text));
}

/**
 * Similitud de Jaccard entre dos textos (via sets de tokens).
 * Retorna [0, 1].
 */
export function jaccardSimilarity(a, b) {
    const aSet = toTokenSet(a);
    const bSet = toTokenSet(b);
    if (aSet.size === 0 || bSet.size === 0) return 0;
    let intersection = 0;
    for (const token of aSet) {
        if (bSet.has(token)) intersection += 1;
    }
    const union = aSet.size + bSet.size - intersection;
    return union > 0 ? intersection / union : 0;
}

/**
 * Similitud coseno entre dos vectores de embeddings.
 * Retorna [0, 1] o 0 si los vectores son inválidos.
 */
export function cosineSimilarity(a, b) {
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
    return den ? dot / den : 0;
}

/**
 * Overlap léxico simple entre query y texto de un chunk.
 * Retorna ratio [0, 1] de tokens del chunk presentes en la query.
 */
export function lexicalOverlapScore(chunk, query) {
    const queryTokens = toTokenSet(query);
    const chunkTokens = tokenize(chunk);
    if (queryTokens.size === 0 || chunkTokens.length === 0) return 0;
    let overlap = 0;
    for (const token of chunkTokens) {
        if (queryTokens.has(token)) overlap += 1;
    }
    return overlap / Math.max(1, chunkTokens.length);
}

/**
 * Elimina valores nulos/vacíos de objetos y arrays de forma recursiva.
 * Usado para compactar perfiles antes de enviarlos al LLM.
 */
export function compact(value) {
    if (Array.isArray(value)) {
        const out = value.map(compact).filter((v) => v !== null && v !== '' && (!Array.isArray(v) || v.length > 0));
        return out.length > 0 ? out : null;
    }
    if (value && typeof value === 'object') {
        const out = Object.entries(value)
            .map(([k, v]) => [k, compact(v)])
            .filter(([, v]) => v !== null && v !== '');
        return out.length > 0 ? Object.fromEntries(out) : null;
    }
    return value === undefined ? null : value;
}
