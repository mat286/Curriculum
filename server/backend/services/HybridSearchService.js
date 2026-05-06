import logger from '../utils/logger.js';

/**
 * HybridSearchService
 * 
 * Combina búsqueda BM25 (keyword-based) y búsqueda semántica (embedding-based).
 * Objetivo: Mejorar recall y precision mediante cobertura dual.
 * 
 * Estrategia:
 * 1. BM25 search en CV structured fields (keywords, skills, companies)
 * 2. Semantic search en ChromaDB (embeddings)
 * 3. Merge results: semantic 60%, BM25 40% de peso
 * 4. Deduplicación por relevancia
 * 5. Return top-5 candidates with scores
 * 
 * Expected improvement: +15-25% precision vs semantic-only
 */
export class HybridSearchService {
    constructor() {
        this.semanticWeight = parseFloat(process.env.HYBRID_SEMANTIC_WEIGHT || '0.6');
        this.bm25Weight = parseFloat(process.env.HYBRID_BM25_WEIGHT || '0.4');
        this.maxResults = parseInt(process.env.HYBRID_MAX_RESULTS || '5', 10);
        this.dedupeThreshold = parseFloat(process.env.HYBRID_DEDUPE_THRESHOLD || '0.8');
    }

    /**
     * Implementación simplificada de BM25 scoring.
     * Busca keywords en CV fields (experiencia, habilidades, educación, etc).
     * 
     * BM25 components:
     * - IDF (inverse document frequency): penaliza palabras comunes
     * - Field length normalization
     * - Term frequency
     */
    _computeBM25Score(query, cvText, fieldWeight = 1.0) {
        const k1 = 1.5; // Term saturation parameter
        const b = 0.75; // Field length normalization parameter

        const normalize = (text) =>
            String(text || '')
                .toLowerCase()
                .split(/\s+/)
                .filter((w) => w.length > 2); // Ignorar palabras muy cortas

        const queryTerms = normalize(query);
        const fieldTerms = normalize(cvText);
        const fieldLength = fieldTerms.length;
        const avgFieldLength = 50; // Promedio estimado

        if (fieldLength === 0 || queryTerms.length === 0) return 0;

        let score = 0;
        const termFreq = new Map();

        // Contar frecuencia de términos en el field
        for (const term of fieldTerms) {
            termFreq.set(term, (termFreq.get(term) || 0) + 1);
        }

        // Calcular BM25 para cada query term
        for (const term of queryTerms) {
            const tf = termFreq.get(term) || 0;
            if (tf === 0) continue; // Término no presente

            // IDF simplificado (asume 100 documentos)
            const docFreq = Math.max(1, fieldTerms.filter((t) => t === term).length);
            const idf = Math.log((100 - docFreq + 0.5) / (docFreq + 0.5) + 1);

            // BM25 formula
            const numerator = idf * tf * (k1 + 1);
            const denominator = tf + k1 * (1 - b + b * (fieldLength / avgFieldLength));
            score += numerator / denominator;
        }

        return score * fieldWeight;
    }

    /**
     * BM25 search en CV: busca en experiencia, habilidades, educación.
     * Retorna array de { text, score, source } ordenados por score.
     */
    bm25Search(query, profileContext) {
        const results = [];

        if (!profileContext || !query) return results;

        // Definir fields a buscar con pesos
        const fields = [
            { key: 'sobre_mi', weight: 1.2, label: 'Sobre mí' },
            { key: 'habilidades', weight: 1.5, label: 'Habilidades' },
            { key: 'experiencia_laboral', weight: 1.0, label: 'Experiencia' },
            { key: 'educacion', weight: 0.8, label: 'Educación' },
            { key: 'proyectos', weight: 1.0, label: 'Proyectos' },
        ];

        for (const field of fields) {
            const value = profileContext[field.key];
            if (!value) continue;

            let fieldText = '';

            if (Array.isArray(value)) {
                // Para arrays de objects, concatenar campos relevantes
                fieldText = value
                    .map((item) => {
                        if (typeof item === 'string') return item;
                        // Object: concatenar main fields
                        return [
                            item.puesto || item.nombre || item.titulo || '',
                            item.empresa || item.institucion || '',
                            item.descripcion || '',
                            item.tecnologias || '',
                        ]
                            .filter(Boolean)
                            .join(' ');
                    })
                    .join(' ');
            } else if (typeof value === 'string') {
                fieldText = value;
            } else if (typeof value === 'object') {
                fieldText = JSON.stringify(value);
            }

            if (fieldText.length === 0) continue;

            const score = this._computeBM25Score(query, fieldText, field.weight);
            if (score > 0) {
                results.push({
                    text: `${field.label}: ${fieldText.slice(0, 200)}...`,
                    score,
                    source: field.key,
                    fieldLabel: field.label,
                });
            }
        }

        // Ordenar por score descendente
        return results.sort((a, b) => b.score - a.score);
    }

    /**
     * Normaliza scores a rango [0, 1] para comparación.
     * Usa min-max normalization.
     */
    _normalizeScores(results) {
        if (results.length === 0) return [];

        const scores = results.map((r) => r.score);
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const range = maxScore - minScore || 1;

        return results.map((r) => ({
            ...r,
            normalizedScore: (r.score - minScore) / range,
        }));
    }

    /**
     * Deduplica resultados por similitud textual.
     * Elimina resultados que son muy similares.
     */
    _deduplicateResults(results) {
        const dedupedResults = [];
        const seenTexts = new Map();

        for (const result of results) {
            const key = String(result.text || '')
                .toLowerCase()
                .replace(/[^\w\s]/g, '')
                .slice(0, 100); // Usar primeros 100 caracteres como clave

            const existing = seenTexts.get(key);
            if (existing) {
                // Si ya existe similar, mantener el de score más alto
                if (result.score > existing.score) {
                    const idx = dedupedResults.indexOf(existing);
                    dedupedResults[idx] = result;
                    seenTexts.set(key, result);
                }
            } else {
                dedupedResults.push(result);
                seenTexts.set(key, result);
            }
        }

        return dedupedResults;
    }

    /**
     * Merge de BM25 y semantic results.
     * Combina scores con pesos configurables.
     * Retorna merged results with final scores.
     */
    _mergeResults(bm25Results, semanticResults) {
        const merged = new Map();

        // Normalizar BM25 scores
        const normalizedBM25 = this._normalizeScores(bm25Results);
        for (const result of normalizedBM25) {
            const key = result.source || 'bm25';
            merged.set(key, {
                text: result.text,
                bm25Score: result.normalizedScore,
                semanticScore: 0,
                source: result.source || 'bm25',
            });
        }

        // Normalizar semantic scores y agregar/actualizar
        const normalizedSemantic = this._normalizeScores(
            semanticResults.map((text, idx) => ({
                text,
                score: 1 - idx * 0.1, // Ranking score: primer resultado = 1.0, segundo = 0.9, etc
            })),
        );

        for (let i = 0; i < normalizedSemantic.length; i++) {
            const result = normalizedSemantic[i];
            const key = `semantic_${i}`;
            if (merged.has(key)) {
                merged.get(key).semanticScore = result.normalizedScore;
            } else {
                merged.set(key, {
                    text: result.text,
                    bm25Score: 0,
                    semanticScore: result.normalizedScore,
                    source: 'semantic',
                });
            }
        }

        // Combinar scores finales
        const finalResults = [];
        for (const [, result] of merged) {
            const finalScore =
                result.bm25Score * this.bm25Weight + result.semanticScore * this.semanticWeight;
            finalResults.push({
                text: result.text,
                finalScore,
                bm25Score: result.bm25Score,
                semanticScore: result.semanticScore,
                source: result.source,
            });
        }

        // Ordenar por score final descendente
        return finalResults.sort((a, b) => b.finalScore - a.finalScore);
    }

    /**
     * Ejecuta pipeline híbrido completo.
     * Retorna { results, scores, method, stats }
     */
    search({
        query,
        profileContext,
        semanticResults = [],
        candidateId,
        requestId,
    }) {
        const started = Date.now();

        // Paso 1: BM25 search
        const bm25Results = this.bm25Search(query, profileContext);

        // Paso 2: Merge con semantic results
        const mergedResults = this._mergeResults(bm25Results, semanticResults);

        // Paso 3: Deduplicación
        const dedupedResults = this._deduplicateResults(mergedResults);

        // Paso 4: Top-5
        const topResults = dedupedResults.slice(0, this.maxResults);

        const stats = {
            requestId,
            candidateId,
            method: 'hybrid',
            totalResults: topResults.length,
            bm25Count: bm25Results.length,
            semanticCount: semanticResults.length,
            mergedCount: mergedResults.length,
            dedupedCount: dedupedResults.length,
            durationMs: Date.now() - started,
            weights: {
                semantic: this.semanticWeight,
                bm25: this.bm25Weight,
            },
        };

        logger.info(stats, 'Hybrid search completed');

        return {
            results: topResults.map((r) => r.text),
            scores: topResults.map((r) => r.finalScore),
            details: topResults,
            method: 'hybrid',
            stats,
        };
    }
}
